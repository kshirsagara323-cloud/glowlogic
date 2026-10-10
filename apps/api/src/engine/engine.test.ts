import { describe, expect, it } from 'vitest';
import { QUESTIONS, QUESTION_BY_ID, TRAIT_CODES, evaluateAssessment, parsePriorities, validateAnswers } from './index.js';
import type { Answers, TraitCode } from './index.js';
import { scoreTraits } from './score.js';
import { estimateTone } from './tone.js';

const trait = (answers: Answers, code: TraitCode) => scoreTraits(answers).find((t) => t.code === code);
const run = (answers: Answers) => evaluateAssessment(answers, ['oiliness']);

const oilyDehydratedSensitive: Answers = {
  shine_midday: 'all_over', after_cleanse: 'oily_soon', flaking: 'never', oily_but_tight: 'often',
  product_sting: 'often', flushing: 'sometimes', lasting_redness: 'mild', fragrance_reaction: 'yes',
};
const dryCalm: Answers = {
  shine_midday: 'none', after_cleanse: 'tight', flaking: 'often', oily_but_tight: 'no', product_sting: 'never',
};

describe('quiz definition integrity', () => {
  it('has unique question ids and unique option ids inside each question', () => {
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    for (const q of QUESTIONS) expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
  });
  it('feeds every trait from at least one scored question', () => {
    for (const code of TRAIT_CODES) {
      const fed = QUESTIONS.some((q) => q.weight > 0 && q.options.some((o) => o.signals?.[code] !== undefined));
      expect(fed, `no question feeds ${code}`).toBe(true);
    }
  });
  it('keeps every signal between 0 and 1 and only uses real trait codes', () => {
    for (const q of QUESTIONS) {
      for (const o of q.options) {
        for (const [code, value] of Object.entries(o.signals ?? {})) {
          expect(TRAIT_CODES).toContain(code);
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
  it('has exactly ten depth options numbered 1 to 10', () => {
    const bins = (QUESTION_BY_ID.get('skin_depth')?.options ?? []).map((o) => o.depthBin);
    expect(bins).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});

describe('trait scoring', () => {
  it('returns nothing (and does not crash) for empty answers', () => {
    const result = run({});
    expect(result.traits).toEqual([]);
    expect(result.skinType).toBeNull();
    expect(result.tone.depthBin).toBeNull();
    expect(result.tone.undertone).toBeNull();
  });
  it('increases oiliness monotonically with shinier answers', () => {
    const scores = ['none', 'tzone_slight', 'tzone_clear', 'all_over'].map((a) => trait({ shine_midday: a }, 'oiliness')?.score ?? -1);
    expect(scores).toEqual([0, 35, 70, 100]);
  });
  it('lowers confidence when fewer relevant questions are answered', () => {
    const one = trait({ shine_midday: 'all_over' }, 'oiliness');
    const both = trait({ shine_midday: 'all_over', after_cleanse: 'oily_soon' }, 'oiliness');
    expect(one?.confidence).toBeLessThan(both?.confidence ?? 0);
    expect(both?.confidence).toBe(0.85);
    expect(one?.confidenceLevel).toBe('medium');
    expect(trait({ flaking: 'often' }, 'dryness')?.confidenceLevel).toBe('low');
  });
  it('does not treat a skipped question as a zero', () => {
    expect(trait({ shine_midday: 'all_over' }, 'oiliness')?.score).toBe(100);
  });
  it('ignores a question that carries no information about a trait', () => {
    // "Already getting oily" says nothing about dehydration, so dehydration only uses the other question.
    const t = trait({ after_cleanse: 'oily_soon', oily_but_tight: 'often' }, 'dehydration');
    expect(t?.score).toBe(100);
    expect(t?.evidence).toHaveLength(1);
  });
  it('explains results using the user\'s own answers', () => {
    const t = trait(oilyDehydratedSensitive, 'oiliness');
    expect(t?.evidence[0]?.question).toBe('Shine by midday');
    expect(t?.explanation).toContain('Shine by midday');
    expect(t?.explanation).toContain('strong signs of oiliness');
  });
  it('is deterministic', () => {
    expect(run(oilyDehydratedSensitive)).toEqual(run(oilyDehydratedSensitive));
  });
});

describe('skin type', () => {
  it('allows oily + dehydrated + sensitive at the same time', () => {
    const type = run(oilyDehydratedSensitive).skinType;
    expect(type?.primary).toBe('oily');
    expect(type?.dehydrated).toBe(true);
    expect(type?.sensitive).toBe(true);
  });
  it('finds dry skin', () => {
    const result = run(dryCalm);
    expect(result.skinType?.primary).toBe('dry');
    expect(result.skinType?.sensitive).toBe(false);
  });
  it('finds combination skin from T-zone shine', () => {
    expect(run({ shine_midday: 'tzone_clear', after_cleanse: 'slightly_tight' }).skinType?.primary).toBe('combination');
  });
});

describe('tone and undertone', () => {
  it('reads depth', () => {
    expect(estimateTone({ skin_depth: 'd7' }).depthBin).toBe(7);
  });
  it('agrees across three answers with medium confidence at most', () => {
    const tone = estimateTone({ undertone_veins: 'blue_purple', undertone_jewellery: 'silver', undertone_cast: 'pink' });
    expect(tone.undertone).toBe('cool');
    expect(tone.undertoneConfidence).toBe(0.6);
    expect(tone.undertoneConfidenceLevel).toBe('medium');
  });
  it('treats conflicting answers as neutral with low confidence', () => {
    const tone = estimateTone({ undertone_veins: 'blue_purple', undertone_jewellery: 'gold', undertone_cast: 'neutral' });
    expect(tone.undertone).toBe('neutral');
    expect(tone.undertoneConfidenceLevel).toBe('low');
  });
  it('gives low confidence for a single answer and none for "not sure"', () => {
    expect(estimateTone({ undertone_veins: 'green' }).undertoneConfidenceLevel).toBe('low');
    expect(estimateTone({ undertone_veins: 'unsure' }).undertone).toBeNull();
  });
});

describe('safety notices', () => {
  it('shows no notices when nothing is flagged', () => {
    expect(run({ red_flags: ['none'], shine_midday: 'none' }).notices).toEqual([]);
  });
  it('recommends professional help for a changing mole, calmly and without diagnosing', () => {
    const n = run({ red_flags: ['changing_mole'] }).notices[0];
    expect(n?.level).toBe('consult');
    expect(n?.message).toContain('cannot diagnose');
  });
  it('marks a severe reaction as urgent and sorts it first', () => {
    const notices = run({ red_flags: ['non_healing', 'severe_reaction'] }).notices;
    expect(notices[0]?.level).toBe('urgent');
  });
  it('suggests a dermatologist for deep painful breakouts', () => {
    expect(run({ breakout_types: ['deep'] }).notices.map((n) => n.code)).toContain('deep_breakouts');
  });
});

describe('input validation', () => {
  it('accepts valid answers and drops empty ones', () => {
    expect(validateAnswers({ shine_midday: 'none', flaking: '', breakout_types: [] })).toEqual({ shine_midday: 'none' });
  });
  it('rejects unknown questions and options', () => {
    expect(() => validateAnswers({ made_up: 'x' })).toThrow();
    expect(() => validateAnswers({ shine_midday: 'sparkly' })).toThrow();
  });
  it('rejects "none" combined with other choices', () => {
    expect(() => validateAnswers({ red_flags: ['none', 'changing_mole'] })).toThrow();
  });
  it('rejects wrong shapes and long text', () => {
    expect(() => validateAnswers({ breakout_types: 'blackheads' })).toThrow();
    expect(() => validateAnswers({ restrictions: 'x'.repeat(201) })).toThrow();
    expect(() => validateAnswers([])).toThrow();
  });
  it('validates priorities', () => {
    expect(parsePriorities(['acne', 'dryness'])).toEqual(['acne', 'dryness']);
    expect(() => parsePriorities([])).toThrow();
    expect(() => parsePriorities(['acne', 'acne'])).toThrow();
    expect(() => parsePriorities(['acne', 'dryness', 'redness', 'texture'])).toThrow();
    expect(() => parsePriorities(['not_a_concern'])).toThrow();
  });
});
