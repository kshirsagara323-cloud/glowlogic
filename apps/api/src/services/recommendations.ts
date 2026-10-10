import type { Pool } from 'pg';
import { categoryFor, confidenceLevelFor } from '../engine/score.js';
import { deriveSkinType } from '../engine/skinType.js';
import type { Answers, AssessmentResult, TraitCode, TraitResult } from '../engine/index.js';
import { AppError } from '../errors.js';
import type { Catalog, CatalogIngredient, CatalogProduct, CompatLevel, ConcernLink, RecommendationOutput, Relation, RoutineLevel, UserContext } from '../recommend/index.js';

export async function loadCatalog(pool: Pool): Promise<Catalog> {
  const [products, ingredients, links, rules] = await Promise.all([
    pool.query(
      `SELECT p.id, p.slug, p.name, b.name AS brand, p.category, p.price_tier, p.spf, p.fragrance_free, ds.is_demo,
              COALESCE((SELECT array_agg(st.skin_type) FROM product_skin_type st WHERE st.product_id = p.id), '{}') AS skin_types
       FROM product p
       JOIN brand b ON b.id = p.brand_id
       JOIN data_source ds ON ds.id = p.data_source_id
       WHERE p.status = 'active'`,
    ),
    pool.query(
      `SELECT pi.product_id, pi.position, pi.raw_name, i.slug, i.inci_name, f.slug AS family,
              COALESCE(i.irritation_potential, 0) AS irritation,
              COALESCE(i.is_fragrance_related, false) AS is_fragrance,
              COALESCE(i.introduce_slowly, false) AS introduce_slowly
       FROM product_ingredient pi
       JOIN product p ON p.id = pi.product_id AND p.status = 'active'
       LEFT JOIN ingredient i ON i.id = pi.ingredient_id
       LEFT JOIN ingredient_family f ON f.id = i.family_id
       ORDER BY pi.product_id, pi.position`,
    ),
    pool.query('SELECT i.slug, c.concern_code, c.relation, c.relevance FROM ingredient_concern c JOIN ingredient i ON i.id = c.ingredient_id'),
    pool.query(
      `SELECT fa.slug AS a, fb.slug AS b, c.level, c.reason, c.suggestion, c.base_penalty
       FROM ingredient_compatibility c
       JOIN ingredient_family fa ON fa.id = c.family_a_id
       JOIN ingredient_family fb ON fb.id = c.family_b_id`,
    ),
  ]);

  const byProduct = new Map<number, CatalogIngredient[]>();
  for (const r of ingredients.rows as Record<string, unknown>[]) {
    const list = byProduct.get(r.product_id as number) ?? [];
    list.push({
      position: r.position as number, rawName: r.raw_name as string, slug: (r.slug as string | null) ?? null,
      inci: (r.inci_name as string | null) ?? null, family: (r.family as string | null) ?? null,
      irritation: r.irritation as number, isFragrance: r.is_fragrance as boolean, introduceSlowly: r.introduce_slowly as boolean,
    });
    byProduct.set(r.product_id as number, list);
  }

  const ingredientConcerns = new Map<string, ConcernLink[]>();
  for (const r of links.rows as { slug: string; concern_code: string; relation: Relation; relevance: number }[]) {
    const list = ingredientConcerns.get(r.slug) ?? [];
    list.push({ concern: r.concern_code, relation: r.relation, relevance: r.relevance });
    ingredientConcerns.set(r.slug, list);
  }

  return {
    products: (products.rows as Record<string, unknown>[]).map(
      (r): CatalogProduct => ({
        id: r.id as number, slug: r.slug as string, name: r.name as string, brand: r.brand as string,
        category: r.category as string, priceTier: (r.price_tier as number | null) ?? null, spf: (r.spf as number | null) ?? null,
        fragranceFree: (r.fragrance_free as boolean | null) ?? null, isDemo: r.is_demo as boolean,
        skinTypes: r.skin_types as string[], ingredients: byProduct.get(r.id as number) ?? [],
      }),
    ),
    ingredientConcerns,
    compat: (rules.rows as { a: string; b: string; level: CompatLevel; reason: string; suggestion: string | null; base_penalty: number }[]).map((r) => {
      const [a, b] = r.a <= r.b ? [r.a, r.b] : [r.b, r.a];
      return { a, b, level: r.level, reason: r.reason, suggestion: r.suggestion, basePenalty: r.base_penalty };
    }),
  };
}

/** Builds the engine input from the user's stored assessment (including their own corrections) and profile. */
export async function loadContext(pool: Pool, userId: string, assessmentId: string, complexity?: RoutineLevel): Promise<{ ctx: UserContext; rulesVersion: string }> {
  const found = await pool.query(
    `SELECT answers, result, rules_version FROM skin_assessment WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
    [assessmentId, userId],
  );
  const row = found.rows[0] as { answers: Answers; result: AssessmentResult; rules_version: string } | undefined;
  if (!row) throw new AppError(404, 'not_found', 'Assessment not found.');

  const [traitRows, priorityRows, profileRows] = await Promise.all([
    pool.query('SELECT concern_code, score, confidence FROM effective_skin_trait WHERE assessment_id = $1', [assessmentId]),
    pool.query('SELECT concern_code FROM skin_concern_priority WHERE assessment_id = $1 ORDER BY rank', [assessmentId]),
    pool.query('SELECT budget_tier, fragrance_preference, routine_complexity FROM user_profile WHERE user_id = $1', [userId]),
  ]);

  const traits: Record<string, number> = {};
  const traitResults: TraitResult[] = [];
  for (const t of traitRows.rows as { concern_code: string; score: number; confidence: string }[]) {
    traits[t.concern_code] = t.score;
    const confidence = Number(t.confidence);
    traitResults.push({
      code: t.concern_code as TraitCode, score: t.score, category: categoryFor(t.score), confidence,
      confidenceLevel: confidenceLevelFor(confidence), evidence: [], explanation: '',
    });
  }
  // Skin type is re-derived from the EFFECTIVE traits, so the user's corrections are respected.
  const skinType = deriveSkinType(traitResults, row.answers);
  const profile = profileRows.rows[0] as { budget_tier: number | null; fragrance_preference: UserContext['fragrancePreference']; routine_complexity: RoutineLevel } | undefined;

  return {
    rulesVersion: row.rules_version,
    ctx: {
      traits,
      priorities: (priorityRows.rows as { concern_code: string }[]).map((p) => p.concern_code),
      skinTypes: { primary: skinType?.primary ?? null, dehydrated: skinType?.dehydrated ?? false, sensitive: skinType?.sensitive ?? false },
      pregnancyOrNursing: row.result.flags.pregnancyOrNursing,
      currentProducts: row.result.flags.currentProducts,
      restrictionsText: row.result.flags.restrictionsText,
      fragrancePreference: profile?.fragrance_preference ?? 'no_preference',
      budgetTier: profile?.budget_tier ?? null,
      routineComplexity: complexity ?? profile?.routine_complexity ?? 'beginner',
    },
  };
}

export async function saveRun(pool: Pool, userId: string, assessmentId: string, rulesVersion: string, ctx: UserContext, output: RecommendationOutput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query(
      `INSERT INTO recommendation_run (user_id, assessment_id, engine_version, rules_version, input_snapshot, output)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`,
      [userId, assessmentId, output.engineVersion, rulesVersion, JSON.stringify(ctx), JSON.stringify(output)],
    );
    const { id: runId, created_at: createdAt } = run.rows[0] as { id: string; created_at: Date };
    for (const group of output.categories) {
      for (const [index, item] of group.items.entries()) {
        const rec = await client.query(
          `INSERT INTO recommendation (run_id, product_id, rank, score, score_breakdown, warnings)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [runId, item.product.id, index + 1, item.score, JSON.stringify(item.breakdown), JSON.stringify(item.warnings)],
        );
        const recId = (rec.rows[0] as { id: number }).id;
        for (const reason of item.reasons) {
          await client.query('INSERT INTO recommendation_reason (recommendation_id, code, message) VALUES ($1, $2, $3)', [recId, reason.code, reason.message]);
        }
      }
    }
    await client.query('COMMIT');
    return { runId, createdAt, ...output };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
