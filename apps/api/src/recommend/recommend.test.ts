import { describe, expect, it } from 'vitest';
import { recommend } from './index.js';
import type { Catalog, CatalogIngredient, CatalogProduct, UserContext } from './types.js';

const FAMILY: Record<string, string | null> = {
  'sodium-hyaluronate': 'humectant', niacinamide: 'niacinamide', 'salicylic-acid': 'bha', retinol: 'retinoid',
  'glycolic-acid': 'aha', parfum: 'fragrance', 'zinc-oxide': 'mineral-sunscreen', water: null, glycerin: 'humectant',
};
const ing = (slug: string, position: number): CatalogIngredient => ({
  position, rawName: slug, slug, inci: slug[0]?.toUpperCase() + slug.slice(1), family: FAMILY[slug] ?? null,
  irritation: slug === 'retinol' || slug === 'glycolic-acid' ? 3 : 0, isFragrance: slug === 'parfum',
  introduceSlowly: slug === 'retinol' || slug === 'glycolic-acid',
});
let nextId = 1;
const prod = (slug: string, category: string, slugs: string[], extra: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: nextId++, slug, name: `Test ${slug}`, brand: 'Test', category, priceTier: 1, spf: null, fragranceFree: true,
  isDemo: false, skinTypes: [], ingredients: slugs.map((s, i) => ing(s, i + 1)), ...extra,
});

const catalog: Catalog = {
  products: [
    prod('gentle', 'cleanser', ['water', 'glycerin'], { skinTypes: ['oily', 'sensitive'] }),
    prod('scented', 'cleanser', ['water', 'parfum'], { fragranceFree: false, skinTypes: ['oily'] }),
    prod('gel', 'moisturizer', ['water', 'sodium-hyaluronate', 'niacinamide']),
    prod('spf30', 'sunscreen', ['water', 'zinc-oxide'], { spf: 30 }),
    prod('spf15', 'sunscreen', ['water', 'zinc-oxide'], { spf: 15 }),
    prod('ha-serum', 'serum', ['water', 'sodium-hyaluronate']),
    prod('retinol-serum', 'serum', ['water', 'retinol']),
    prod('aha-exfoliant', 'exfoliant', ['water', 'glycolic-acid']),
    prod('empty', 'serum', []),
  ],
  ingredientConcerns: new Map([
    ['niacinamide', [{ concern: 'oiliness', relation: 'helps', relevance: 2 }, { concern: 'visible_pores', relation: 'helps', relevance: 1 }]],
    ['sodium-hyaluronate', [{ concern: 'dehydration', relation: 'helps', relevance: 3 }]],
    ['salicylic-acid', [{ concern: 'blackheads', relation: 'helps', relevance: 3 }, { concern: 'sensitivity', relation: 'may_worsen', relevance: 2 }]],
    ['retinol', [{ concern: 'fine_lines', relation: 'helps', relevance: 3 }, { concern: 'sensitivity', relation: 'may_worsen', relevance: 3 }]],
    ['glycolic-acid', [{ concern: 'texture', relation: 'helps', relevance: 2 }, { concern: 'dullness', relation: 'helps', relevance: 2 }, { concern: 'sensitivity', relation: 'may_worsen', relevance: 3 }]],
    ['parfum', [{ concern: 'sensitivity', relation: 'may_worsen', relevance: 3 }]],
  ] as [string, { concern: string; relation: 'helps' | 'supports' | 'may_worsen'; relevance: number }[]][]),
  compat: [{ a: 'aha', b: 'retinoid', level: 'potential_irritation', reason: 'Both can irritate.', suggestion: 'Use on different nights.', basePenalty: 40 }],
};

const base: UserContext = {
  traits: {}, priorities: [], skinTypes: { primary: null, dehydrated: false, sensitive: false },
  pregnancyOrNursing: false, currentProducts: [], restrictionsText: null, fragrancePreference: 'no_preference',
  budgetTier: null, routineComplexity: 'beginner',
};
const ctx = (over: Partial<UserContext>): UserContext => ({ ...base, ...over });
const sensitiveOily = ctx({
  traits: { oiliness: 90, dehydration: 100, sensitivity: 72 }, priorities: ['oiliness', 'dehydration'],
  skinTypes: { primary: 'oily', dehydrated: true, sensitive: true },
});
const names = (out: ReturnType<typeof recommend>, category: string) =>
  out.categories.find((c) => c.category === category)?.items.map((i) => i.product.slug) ?? [];
const scoreOf = (out: ReturnType<typeof recommend>, category: string, slug: string) =>
  out.categories.find((c) => c.category === category)?.items.find((i) => i.product.slug === slug)?.score ?? -1;

describe('exclusions (safety and your own rules)', () => {
  it('never recommends a sunscreen below SPF 30 and explains why', () => {
    const out = recommend(base, catalog);
    expect(names(out, 'sunscreen')).toEqual(['spf30']);
    expect(out.excluded.find((e) => e.name.includes('spf15'))?.reason).toContain('SPF is 15');
  });
  it('excludes retinoids when pregnant or breastfeeding', () => {
    const out = recommend(ctx({ traits: { fine_lines: 100 }, pregnancyOrNursing: true }), catalog);
    expect(names(out, 'serum')).toEqual([]);
    expect(out.excluded.find((e) => e.name.includes('retinol'))?.reason).toContain('pregnancy');
  });
  it('shows a retinoid with a caution when pregnancy is unknown, and adds a notice', () => {
    const out = recommend(ctx({ traits: { fine_lines: 100 }, pregnancyOrNursing: null }), catalog);
    const item = out.categories.find((c) => c.category === 'serum')?.items.find((i) => i.product.slug === 'retinol-serum');
    expect(item?.warnings.join(' ')).toContain('pregnancy');
    expect(out.notices.length).toBe(1);
  });
  it('removes fragranced products when the user avoids fragrance', () => {
    const out = recommend(ctx({ fragrancePreference: 'avoid_fragrance' }), catalog);
    expect(names(out, 'cleanser')).toEqual(['gentle']);
    expect(out.excluded.some((e) => e.name.includes('scented'))).toBe(true);
  });
  it('honours the free-text avoid list', () => {
    const out = recommend(ctx({ restrictionsText: 'niacinamide, peanuts' }), catalog);
    expect(names(out, 'moisturizer')).toEqual([]);
    expect(out.excluded.some((e) => e.reason.includes('niacinamide'))).toBe(true);
  });
  it('treats the word "fragrance" in the avoid list as all fragrance ingredients', () => {
    const out = recommend(ctx({ restrictionsText: 'Fragrance' }), catalog);
    expect(names(out, 'cleanser')).toEqual(['gentle']);
  });
  it('refuses to judge a product with no ingredient list', () => {
    const out = recommend(ctx({ traits: { dehydration: 100 } }), catalog);
    expect(out.excluded.find((e) => e.name.includes('empty'))?.reason).toContain('missing');
  });
});

describe('scoring', () => {
  it('ranks a hydrating serum first for a dehydrated user and explains it', () => {
    const out = recommend(sensitiveOily, catalog);
    const serum = out.categories.find((c) => c.category === 'serum')?.items[0];
    expect(serum?.product.slug).toBe('ha-serum');
    expect(serum?.reasons.some((r) => r.message.includes('dehydration'))).toBe(true);
  });
  it('scores a fragranced product lower for a sensitive user', () => {
    const out = recommend(sensitiveOily, catalog);
    expect(scoreOf(out, 'cleanser', 'scented')).toBeLessThan(scoreOf(out, 'cleanser', 'gentle'));
    const scented = out.categories.find((c) => c.category === 'cleanser')?.items.find((i) => i.product.slug === 'scented');
    expect(scented?.warnings.join(' ')).toContain('may worsen sensitivity');
  });
  it('keeps every score between 0 and 100 and the breakdown adds up', () => {
    const out = recommend(sensitiveOily, catalog);
    for (const item of out.categories.flatMap((c) => c.items)) {
      expect(item.score).toBeGreaterThanOrEqual(0);
      expect(item.score).toBeLessThanOrEqual(100);
      const b = item.breakdown;
      const sum = b.concernMatch + b.skinFit + b.preferenceFit + b.budgetFit + b.routineFit - b.riskPenalty;
      expect(Math.abs(Math.max(0, sum) - item.score)).toBeLessThanOrEqual(0.5);
    }
  });
  it('gives every recommended product at least one reason', () => {
    const out = recommend(sensitiveOily, catalog);
    for (const item of out.categories.flatMap((c) => c.items)) expect(item.reasons.length).toBeGreaterThan(0);
  });
  it('recommends no treatments when the user has no actionable concern', () => {
    const out = recommend(ctx({ traits: { oiliness: 10 } }), catalog);
    expect(names(out, 'serum')).toEqual([]);
    expect(names(out, 'exfoliant')).toEqual([]);
    expect(names(out, 'cleanser').length).toBeGreaterThan(0);
  });
  it('lowers fit and warns when a product clashes with something already used', () => {
    const traits = { texture: 100, dullness: 100 };
    const without = recommend(ctx({ traits }), catalog);
    const withRetinoid = recommend(ctx({ traits, currentProducts: ['retinoid'] }), catalog);
    const item = withRetinoid.categories.find((c) => c.category === 'exfoliant')?.items[0];
    expect(item?.breakdown.routineFit).toBeLessThan(without.categories.find((c) => c.category === 'exfoliant')?.items[0]?.breakdown.routineFit ?? 0);
    expect(item?.warnings.join(' ')).toContain('already use a retinoid');
  });
  it('uses the budget as a soft preference, not a filter', () => {
    const out = recommend(ctx({ budgetTier: 1 }), catalog);
    expect(names(out, 'cleanser').length).toBe(2);
  });
  it('is deterministic', () => {
    const a = recommend(sensitiveOily, catalog);
    const b = recommend(sensitiveOily, catalog);
    expect({ ...a, generatedAt: '' }).toEqual({ ...b, generatedAt: '' });
  });
});

describe('routine', () => {
  const concerns = ctx({ traits: { fine_lines: 100, texture: 100, dullness: 100 } });
  it('minimal has no active ingredients and no extra steps', () => {
    const r = recommend(concerns, catalog, { complexity: 'minimal' }).routine;
    expect(r.activeCount).toBe(0);
    expect(r.am.map((s) => s.category)).toEqual(['cleanser', 'sunscreen']);
    expect(r.pm.map((s) => s.category)).toEqual(['cleanser', 'moisturizer']);
  });
  it('beginner uses at most one active and always ends the morning with sunscreen', () => {
    const r = recommend(concerns, catalog, { complexity: 'beginner' }).routine;
    expect(r.activeCount).toBeLessThanOrEqual(1);
    expect(r.am[r.am.length - 1]?.category).toBe('sunscreen');
    expect(r.am[r.am.length - 1]?.product.slug).toBe('spf30');
  });
  it('moderate refuses to combine clashing actives and says so', () => {
    const r = recommend(concerns, catalog, { complexity: 'moderate' }).routine;
    expect(r.activeCount).toBe(1);
    expect(r.notes.join(' ')).toContain('left out');
  });
  it('advanced may combine them but only on different nights, with a warning', () => {
    const r = recommend(concerns, catalog, { complexity: 'advanced' }).routine;
    expect(r.activeCount).toBe(2);
    expect(r.warnings.join(' ')).toContain('different nights');
    expect(r.pm.some((s) => s.frequency === 'every_other_day')).toBe(true);
  });
  it('numbers steps from 1 and gives every step a why, how-to and caution list', () => {
    const r = recommend(concerns, catalog, { complexity: 'advanced' }).routine;
    for (const list of [r.am, r.pm]) {
      list.forEach((s, i) => {
        expect(s.order).toBe(i + 1);
        expect(s.why.length).toBeGreaterThan(0);
        expect(s.howToUse.length).toBeGreaterThan(0);
      });
    }
  });
  it('flags actives that must be introduced slowly', () => {
    const r = recommend(concerns, catalog, { complexity: 'beginner' }).routine;
    const active = [...r.am, ...r.pm].find((s) => s.category !== 'cleanser' && s.category !== 'moisturizer' && s.category !== 'sunscreen');
    expect(active?.cautions.join(' ')).toContain('Introduce slowly');
  });
});

describe('data labelling', () => {
  it('adds a DEMO DATA note when demo products are used', () => {
    const demoCatalog: Catalog = { ...catalog, products: catalog.products.map((p) => ({ ...p, isDemo: true })) };
    expect(recommend(base, demoCatalog).dataNote).toContain('DEMO DATA');
    expect(recommend(base, catalog).dataNote).toBeNull();
  });
});
