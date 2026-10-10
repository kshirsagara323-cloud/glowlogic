import { isConcerning, rulesBetween } from './compat.js';
import type { CompatRule, Routine, RoutineLevel, RoutineStep, ScoredProduct } from './types.js';

const ACTIVE_BUDGET: Record<RoutineLevel, number> = { minimal: 0, beginner: 1, moderate: 2, advanced: 3 };
const ACTIVE_FAMILIES = new Set(['retinoid', 'aha', 'bha', 'pha', 'benzoyl-peroxide', 'vitamin-c', 'azelaic-acid', 'tranexamic-acid', 'kojic-acid']);
const NIGHT_FAMILIES = new Set(['retinoid', 'aha', 'bha', 'pha', 'benzoyl-peroxide']);
const TREATMENT_CATEGORIES = ['serum', 'acne_treatment', 'exfoliant'];

const HOW_TO: Record<string, string> = {
  cleanser: 'Massage gently onto damp skin for about 30 seconds, then rinse with lukewarm water.',
  moisturizer: 'Apply a thin, even layer after any serum.',
  sunscreen: 'Apply generously as the last morning step, and reapply about every 2 hours when you are outdoors.',
  serum: 'Apply a few drops to clean skin, before moisturiser.',
  acne_treatment: 'Apply a thin layer only to the areas you want to treat.',
  exfoliant: 'Use after cleansing, then moisturise. Start with once a week and watch for irritation.',
};

const isActive = (p: ScoredProduct) => p.families.some((f) => ACTIVE_FAMILIES.has(f));
const hasFamily = (p: ScoredProduct, set: Set<string>) => p.families.some((f) => set.has(f));

function frequencyFor(p: ScoredProduct, level: RoutineLevel): string {
  if (p.families.includes('retinoid')) return level === 'advanced' ? 'every_other_day' : 'two_three_per_week';
  if (p.product.category === 'exfoliant') return level === 'beginner' ? 'weekly' : 'two_three_per_week';
  if (p.families.includes('benzoyl-peroxide')) return level === 'beginner' ? 'every_other_day' : 'daily';
  return 'daily';
}

function toStep(order: number, p: ScoredProduct, frequency: string, why?: string): RoutineStep {
  const cautions = p.warnings.slice(0, 2);
  if (p.introduceSlowly) cautions.push('Introduce slowly: patch test first, start a few times a week, and stop if irritation is significant.');
  return {
    order, category: p.product.category, product: p.product, frequency,
    why: why ?? p.reasons[0]?.message ?? 'A core step for most routines.',
    howToUse: HOW_TO[p.product.category] ?? 'Follow the label directions.',
    cautions,
  };
}

/** Picks a small routine. Fewer active ingredients for lower levels; conflicting actives are not combined. */
export function buildRoutine(byCategory: Map<string, ScoredProduct[]>, level: RoutineLevel, rules: CompatRule[]): Routine {
  const top = (category: string) => byCategory.get(category)?.[0];
  const cleanser = top('cleanser');
  const moisturizer = top('moisturizer');
  const sunscreen = top('sunscreen');
  const warnings: string[] = [];
  const notes: string[] = [];
  if (!sunscreen) notes.push('We could not find a suitable sunscreen (SPF 30 or higher) in the current product data.');
  if (!cleanser) notes.push('No suitable cleanser was found in the current product data.');
  if (!moisturizer) notes.push('No suitable moisturiser was found in the current product data.');

  const chosen: { p: ScoredProduct; when: 'am' | 'pm'; frequency: string }[] = [];
  const amExtra: ScoredProduct[] = [];
  const skipped: string[] = [];

  if (level !== 'minimal') {
    const candidates = TREATMENT_CATEGORIES.flatMap((c) => byCategory.get(c) ?? []).sort((a, b) => b.score - a.score);
    for (const p of candidates) {
      if (!isActive(p)) {
        if ((level === 'moderate' || level === 'advanced') && amExtra.length < 1) amExtra.push(p);
        continue;
      }
      if (chosen.length >= ACTIVE_BUDGET[level]) continue;
      const when = hasFamily(p, NIGHT_FAMILIES) ? 'pm' : p.families.includes('vitamin-c') ? 'am' : 'pm';
      let frequency = frequencyFor(p, level);
      const clash = chosen.find((c) => c.when === when && rulesBetween(c.p.families, p.families, rules).some((r) => isConcerning(r.level)));
      if (clash) {
        if (level !== 'advanced') {
          skipped.push(`${p.product.name} was left out so it is not combined with ${clash.p.product.name}.`);
          continue;
        }
        frequency = 'every_other_day';
        warnings.push(`${p.product.name} and ${clash.p.product.name} can be irritating together. Use them on different nights.`);
      }
      chosen.push({ p, when, frequency });
    }
  }
  notes.push(...skipped);
  if (chosen.length > 0) notes.push('Some active ingredients can make skin more sun-sensitive, so daily sunscreen matters even more.');

  const am: RoutineStep[] = [];
  const pm: RoutineStep[] = [];
  const push = (list: RoutineStep[], p: ScoredProduct | undefined, frequency = 'daily', why?: string) => {
    if (p) list.push(toStep(list.length + 1, p, frequency, why));
  };

  push(am, cleanser);
  if (level !== 'minimal') {
    for (const c of chosen.filter((x) => x.when === 'am')) push(am, c.p, c.frequency);
    for (const p of amExtra) push(am, p);
    push(am, moisturizer);
  }
  push(am, sunscreen);

  push(pm, cleanser);
  for (const c of chosen.filter((x) => x.when === 'pm')) push(pm, c.p, c.frequency);
  push(pm, moisturizer);

  return { level, am, pm, warnings, notes, activeCount: chosen.length };
}
