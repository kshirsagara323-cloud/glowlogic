import { DISCLAIMER } from '../engine/index.js';
import { evaluateProduct } from './score.js';
import { buildRoutine } from './routine.js';
import type { Catalog, Exclusion, RecommendationOutput, RoutineLevel, ScoredProduct, UserContext } from './types.js';

export type * from './types.js';
export { WEIGHTS } from './score.js';

/** Bump when any weight, rule or threshold changes. Stored with every recommendation run. */
export const ENGINE_VERSION = 'recs-2026-10-v1';

/**
 * Pure function: same user context + same catalog = same output.
 * No database, no network, no randomness, no machine learning. Every number can be traced to a rule.
 */
export function recommend(
  ctx: UserContext,
  catalog: Catalog,
  options: { complexity?: RoutineLevel; perCategory?: number } = {},
): RecommendationOutput {
  const level = options.complexity ?? ctx.routineComplexity;
  const perCategory = options.perCategory ?? 4;

  const byCategory = new Map<string, ScoredProduct[]>();
  const excluded: Exclusion[] = [];
  for (const product of catalog.products) {
    const result = evaluateProduct(product, ctx, catalog);
    if (result.kind === 'excluded') excluded.push(result.exclusion);
    if (result.kind !== 'scored') continue;
    const list = byCategory.get(product.category) ?? [];
    list.push(result.scored);
    byCategory.set(product.category, list);
  }
  for (const [category, list] of byCategory) {
    list.sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    byCategory.set(category, list.slice(0, perCategory));
  }

  const routine = buildRoutine(byCategory, level, catalog.compat);
  const categories = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items }));

  const all = categories.flatMap((c) => c.items);
  const notices: string[] = [];
  if (ctx.pregnancyOrNursing === null && all.some((s) => s.families.includes('retinoid'))) {
    notices.push('Retinoids are usually avoided in pregnancy, when planning a pregnancy and while breastfeeding. You did not tell us either way, so please skip them if that applies to you.');
  }
  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
    routine,
    categories,
    excluded: excluded.sort((a, b) => a.name.localeCompare(b.name)),
    notices,
    dataNote: all.some((s) => s.product.isDemo)
      ? 'DEMO DATA: these products are fictional and exist only to demonstrate the recommendation engine. Real product data arrives in a later phase.'
      : null,
    disclaimer: DISCLAIMER,
  };
}
