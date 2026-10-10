import { TRAIT_LABELS } from '../engine/index.js';
import { LEVEL_PENALTY, isConcerning, rulesBetween } from './compat.js';
import type { Breakdown, Catalog, CatalogProduct, Exclusion, ProductSummary, Reason, ScoredProduct, UserContext } from './types.js';

/** Maximum points per component. Documented in docs/recommendation-engine.md. */
export const WEIGHTS = { concern: 35, skin: 25, preference: 15, budget: 15, routine: 10, maxRisk: 40 } as const;
export const ACTIONABLE_FROM = 34; // a concern counts once its score is "moderate" or higher
const PRIORITY_BOOST = [0.5, 0.3, 0.15];
const PRIORITY_NAME = ['main', 'secondary', 'long-term'];
const FOUNDATIONAL = new Set(['cleanser', 'moisturizer', 'sunscreen']);
const OUT_OF_SCOPE = new Set(['foundation', 'concealer', 'primer', 'blush', 'bronzer', 'highlighter', 'powder', 'setting_spray', 'lip_product', 'makeup_remover']);
const FRAGRANCE_WORDS = ['fragrance', 'perfume', 'parfum', 'scent'];
const CURRENT: Record<string, { label: string; families: string[] }> = {
  vitamin_c: { label: 'a vitamin C serum', families: ['vitamin-c'] },
  retinoid: { label: 'a retinoid', families: ['retinoid'] },
  exfoliating_acid: { label: 'an exfoliating acid', families: ['aha', 'bha', 'pha'] },
  benzoyl_peroxide: { label: 'benzoyl peroxide', families: ['benzoyl-peroxide'] },
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const label = (code: string) => (TRAIT_LABELS as Record<string, string>)[code]?.toLowerCase() ?? code;

export type Evaluation =
  | { kind: 'scored'; scored: ScoredProduct }
  | { kind: 'excluded'; exclusion: Exclusion }
  | { kind: 'skipped' };

export function parseRestrictions(text: string | null): string[] {
  if (!text) return [];
  return text.toLowerCase().split(/[,;\n]| and /).map((t) => t.trim()).filter((t) => t.length >= 3 && t.length <= 40);
}

function summary(product: CatalogProduct, catalog: Catalog): ProductSummary {
  const key = product.ingredients
    .filter((i) => i.slug && (catalog.ingredientConcerns.get(i.slug) ?? []).some((l) => l.relation !== 'may_worsen'))
    .slice(0, 4)
    .map((i) => i.inci ?? i.rawName);
  return {
    id: product.id, slug: product.slug, name: product.name, brand: product.brand, category: product.category,
    priceTier: product.priceTier, spf: product.spf, fragranceFree: product.fragranceFree, isDemo: product.isDemo,
    keyIngredients: key,
  };
}

export function evaluateProduct(product: CatalogProduct, ctx: UserContext, catalog: Catalog): Evaluation {
  if (OUT_OF_SCOPE.has(product.category)) return { kind: 'skipped' };
  const exclude = (reason: string): Evaluation => ({ kind: 'excluded', exclusion: { productId: product.id, name: product.name, reason } });

  // ---------- Hard exclusions (safety and your own rules come first) ----------
  if (product.ingredients.length === 0) return exclude('Its ingredient list is missing, so we cannot check it for you.');
  if (product.category === 'sunscreen' && (product.spf === null || product.spf < 30)) {
    return exclude(product.spf === null ? 'Its SPF is not stated.' : `Its SPF is ${product.spf}. Dermatologists recommend SPF 30 or higher.`);
  }
  const families = [...new Set(product.ingredients.map((i) => i.family).filter((f): f is string => f !== null))];
  if (ctx.pregnancyOrNursing === true && families.includes('retinoid')) {
    return exclude('Contains a retinoid, which health authorities advise avoiding in pregnancy, when planning a pregnancy, and (as a precaution) while breastfeeding.');
  }
  const fragranced = product.fragranceFree === false || product.ingredients.some((i) => i.isFragrance);
  if (ctx.fragrancePreference === 'avoid_fragrance' && fragranced) return exclude('Contains fragrance, which you said you want to avoid.');
  for (const token of parseRestrictions(ctx.restrictionsText)) {
    const hit = product.ingredients.find((i) => {
      const hay = [i.rawName, i.inci ?? '', i.slug ?? ''].join(' ').toLowerCase();
      return hay.includes(token) || (i.isFragrance && FRAGRANCE_WORDS.includes(token));
    });
    if (hit) return exclude(`Contains ${hit.inci ?? hit.rawName}, which matches "${token}" in your allergies or avoid list.`);
  }

  // ---------- Needs (what the user's own results say they care about) ----------
  const needs = Object.entries(ctx.traits)
    .filter(([, score]) => score >= ACTIONABLE_FROM)
    .map(([code, score]) => {
      const rank = ctx.priorities.indexOf(code);
      const need = score / 100;
      return { code, score, rank, need, importance: need * (1 + (rank >= 0 ? (PRIORITY_BOOST[rank] ?? 0) : 0)) };
    });

  const seen = new Set<string>();
  const unique = product.ingredients.filter((i) => i.slug && !seen.has(i.slug) && seen.add(i.slug));
  const linksOf = (slug: string) => catalog.ingredientConcerns.get(slug) ?? [];

  // ---------- Concern match ----------
  const reasons: Reason[] = [];
  const warnings: string[] = [];
  let weightedBenefit = 0;
  const totalImportance = needs.reduce((s, n) => s + n.importance, 0);
  const concernReasons: { importance: number; text: string }[] = [];
  for (const n of needs) {
    let benefit = 0;
    const names: string[] = [];
    for (const ing of unique) {
      for (const l of linksOf(ing.slug as string)) {
        if (l.concern !== n.code || l.relation === 'may_worsen') continue;
        benefit += (l.relevance * (l.relation === 'helps' ? 1 : 0.6)) / 3;
        names.push(ing.inci ?? ing.rawName);
      }
    }
    benefit = Math.min(1, benefit);
    weightedBenefit += n.importance * benefit;
    if (benefit >= 0.3) {
      const priority = n.rank >= 0 ? ` and it is your ${PRIORITY_NAME[n.rank]} priority` : '';
      concernReasons.push({
        importance: n.importance * benefit,
        text: `Contains ${[...new Set(names)].join(' and ')}, which may help with ${label(n.code)} (your score is ${n.score}/100${priority}).`,
      });
    }
  }
  const rawConcern = totalImportance > 0 ? weightedBenefit / totalImportance : null;
  const foundational = FOUNDATIONAL.has(product.category);
  if (!foundational && (rawConcern === null || rawConcern < 0.2)) return { kind: 'skipped' }; // treatments only when they target a real need
  const concernMatch = foundational ? 0.5 + 0.5 * (rawConcern ?? 0) : (rawConcern ?? 0);
  concernReasons.sort((a, b) => b.importance - a.importance);
  for (const r of concernReasons.slice(0, 2)) reasons.push({ code: 'concern_match', message: r.text });

  // ---------- Risk: ingredients that may worsen something the user already has ----------
  let risk = 0;
  for (const n of needs) {
    for (const ing of unique) {
      for (const l of linksOf(ing.slug as string)) {
        if (l.concern !== n.code || l.relation !== 'may_worsen') continue;
        risk += 14 * n.need * (l.relevance / 3);
        warnings.push(`Contains ${ing.inci ?? ing.rawName}, which may worsen ${label(n.code)}. Your ${label(n.code)} score is ${n.score}/100.`);
      }
    }
  }
  risk = Math.min(WEIGHTS.maxRisk, risk);

  // ---------- Skin fit ----------
  const userTypes: { name: string; weight: number }[] = [];
  if (ctx.skinTypes.primary) userTypes.push({ name: ctx.skinTypes.primary, weight: 2 });
  if (ctx.skinTypes.dehydrated) userTypes.push({ name: 'dehydrated', weight: 1 });
  if (ctx.skinTypes.sensitive) userTypes.push({ name: 'sensitive', weight: 1 });
  let skinFit = 0.5;
  if (userTypes.length > 0 && product.skinTypes.length > 0) {
    const total = userTypes.reduce((s, t) => s + t.weight, 0);
    const matched = userTypes.filter((t) => product.skinTypes.includes(t.name));
    skinFit = matched.reduce((s, t) => s + t.weight, 0) / total;
    if (matched.length > 0) reasons.push({ code: 'skin_fit', message: `Suited to ${matched.map((t) => t.name).join(', ')} skin, matching your results.` });
  }

  // ---------- Preferences ----------
  const knownFragranceFree = product.fragranceFree === true && !fragranced;
  let preferenceFit = 1;
  if (ctx.fragrancePreference === 'prefer_fragrance_free') {
    preferenceFit = knownFragranceFree ? 1 : fragranced ? 0 : 0.4;
    if (knownFragranceFree) reasons.push({ code: 'fragrance', message: 'Fragrance-free, as you prefer.' });
  } else if (ctx.fragrancePreference === 'avoid_fragrance' && knownFragranceFree) {
    reasons.push({ code: 'fragrance', message: 'Fragrance-free, as you asked.' });
  }

  // ---------- Budget ----------
  let budgetFit = 0.5;
  if (ctx.budgetTier !== null && product.priceTier !== null) {
    const over = product.priceTier - ctx.budgetTier;
    budgetFit = over <= 0 ? 1 : over === 1 ? 0.4 : 0;
    if (over <= 0) reasons.push({ code: 'budget', message: 'Fits the budget you chose.' });
  }

  // ---------- Fit with what you already use ----------
  let routineLoss = 0;
  for (const id of ctx.currentProducts) {
    const current = CURRENT[id];
    if (!current) continue;
    for (const rule of rulesBetween(families, current.families, catalog.compat)) {
      routineLoss += LEVEL_PENALTY[rule.level];
      if (isConcerning(rule.level)) {
        warnings.push(`You already use ${current.label}. ${rule.reason}${rule.suggestion ? ' ' + rule.suggestion : ''}`);
      }
    }
  }
  const routineFit = Math.max(0, 1 - routineLoss * (ctx.skinTypes.sensitive ? 1.3 : 1));
  if (ctx.currentProducts.some((id) => CURRENT[id]) && routineLoss === 0) {
    reasons.push({ code: 'routine', message: 'No known conflicts with the active products you already use.' });
  }

  // ---------- Extra context ----------
  if (product.category === 'sunscreen') {
    reasons.push({ code: 'foundation', message: 'Daily sunscreen is the most consistently recommended skincare step. Dermatologists advise SPF 30 or higher (AAD).' });
    warnings.push('Check the label says "broad spectrum" and "water resistant" (the AAD recommendation); this data does not record them.');
  }
  if (families.includes('retinoid') && ctx.pregnancyOrNursing === null) {
    warnings.push('Retinoids are usually avoided in pregnancy, when planning a pregnancy and while breastfeeding. Skip this if that applies to you.');
  }
  const unmatched = product.ingredients.filter((i) => i.slug === null).length;
  if (unmatched / product.ingredients.length > 0.4) warnings.push('Many ingredients are not in our knowledge base yet, so this check may be incomplete.');

  const breakdown: Breakdown = {
    concernMatch: round1(WEIGHTS.concern * concernMatch),
    skinFit: round1(WEIGHTS.skin * skinFit),
    preferenceFit: round1(WEIGHTS.preference * preferenceFit),
    budgetFit: round1(WEIGHTS.budget * budgetFit),
    routineFit: round1(WEIGHTS.routine * routineFit),
    riskPenalty: round1(risk),
  };
  const raw = breakdown.concernMatch + breakdown.skinFit + breakdown.preferenceFit + breakdown.budgetFit + breakdown.routineFit - breakdown.riskPenalty;
  return {
    kind: 'scored',
    scored: {
      product: summary(product, catalog),
      score: round1(Math.max(0, Math.min(100, raw))),
      breakdown, reasons, warnings: [...new Set(warnings)], families,
      introduceSlowly: product.ingredients.some((i) => i.introduceSlowly),
    },
  };
}
