import type { CompatLevel, CompatRule } from './types.js';

/** Share of the "routine fit" score lost for each kind of conflict. Draft values. */
export const LEVEL_PENALTY: Record<CompatLevel, number> = {
  compatible: 0, generally_compatible: 0, use_caution: 0.3, potential_irritation: 0.6, avoid_unless_advised: 0.9,
};
const ORDER: CompatLevel[] = ['compatible', 'generally_compatible', 'use_caution', 'potential_irritation', 'avoid_unless_advised'];
export const isConcerning = (level: CompatLevel): boolean => ORDER.indexOf(level) >= ORDER.indexOf('use_caution');

export function findRule(rules: CompatRule[], x: string, y: string): CompatRule | undefined {
  const [a, b] = x <= y ? [x, y] : [y, x];
  return rules.find((r) => r.a === a && r.b === b);
}

/** Every rule that applies between two groups of ingredient families. */
export function rulesBetween(familiesA: string[], familiesB: string[], rules: CompatRule[]): CompatRule[] {
  const found = new Map<string, CompatRule>();
  for (const a of familiesA) {
    for (const b of familiesB) {
      const rule = findRule(rules, a, b);
      if (rule) found.set(`${rule.a}|${rule.b}`, rule);
    }
  }
  return [...found.values()];
}
