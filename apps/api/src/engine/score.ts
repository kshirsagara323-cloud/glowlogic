import { QUESTIONS } from './quiz.js';
import { TRAIT_CODES } from './types.js';
import type { Answers, Category, ConfidenceLevel, Evidence, QuizOption, QuizQuestion, TraitCode, TraitResult } from './types.js';

/** Self-reported answers are never treated as certain. Confidence can never exceed this. */
export const CONFIDENCE_CEILING = 0.85;
/** Score cut-offs. These are design choices (rules of thumb), not clinical values. */
export const MODERATE_FROM = 34;
export const HIGH_FROM = 67;

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export function categoryFor(score: number): Category {
  if (score >= HIGH_FROM) return 'high';
  if (score >= MODERATE_FROM) return 'moderate';
  return 'low';
}

export function confidenceLevelFor(confidence: number): ConfidenceLevel {
  if (confidence >= 0.7) return 'high';
  if (confidence >= 0.4) return 'medium';
  return 'low';
}

const PHRASE: Record<TraitCode, string> = {
  acne: 'breakout-prone skin', blackheads: 'blackheads', whiteheads: 'whiteheads', dryness: 'dryness',
  dehydration: 'dehydration-related concerns', oiliness: 'oiliness', redness: 'redness',
  uneven_tone: 'uneven tone', dark_spots: 'dark spots', hyperpigmentation: 'hyperpigmentation',
  dullness: 'dullness', texture: 'uneven texture', visible_pores: 'visible pores',
  fine_lines: 'fine lines', under_eye: 'under-eye concerns', sensitivity: 'sensitivity',
};

export function chosenOptions(question: QuizQuestion, answers: Answers): QuizOption[] {
  const value = answers[question.id];
  if (value === undefined) return [];
  const ids = Array.isArray(value) ? value : [value];
  return question.options.filter((option) => ids.includes(option.id));
}

function explain(code: TraitCode, category: Category, evidence: Evidence[], confidence: number): string {
  const label = PHRASE[code];
  const lead =
    category === 'high' ? `Your answers show strong signs of ${label}`
    : category === 'moderate' ? `Your answers show some signs of ${label}`
    : `Your answers show few signs of ${label}`;
  const reasons = evidence.slice(0, 3).map((e) => `you answered \u201c${e.answer}\u201d for \u201c${e.question}\u201d`);
  const because = reasons.length > 0 ? `, because ${reasons.join('; ')}.` : '.';
  const caution = confidence < 0.4 ? ' This is based on few answers, so treat it as a rough guide.' : '';
  return `${lead}${because}${caution}`;
}

/**
 * Score for one trait = weighted average of the answers that carry information about it, scaled 0-100.
 * Skipped questions do not count as zero: they only lower the confidence.
 */
export function scoreTraits(answers: Answers, questions: QuizQuestion[] = QUESTIONS): TraitResult[] {
  const results: TraitResult[] = [];
  for (const code of TRAIT_CODES) {
    const relevant = questions.filter(
      (q) => q.weight > 0 && q.options.some((option) => option.signals?.[code] !== undefined),
    );
    const relevantWeight = relevant.reduce((sum, q) => sum + q.weight, 0);
    if (relevantWeight === 0) continue;

    let answeredWeight = 0;
    let weightedSum = 0;
    const used: { q: QuizQuestion; signal: number; labels: string[] }[] = [];
    for (const q of relevant) {
      const chosen = chosenOptions(q, answers).filter((option) => option.signals?.[code] !== undefined);
      if (chosen.length === 0) continue;
      const signal = Math.max(...chosen.map((option) => option.signals?.[code] ?? 0));
      answeredWeight += q.weight;
      weightedSum += q.weight * signal;
      used.push({ q, signal, labels: chosen.map((option) => option.label) });
    }
    if (answeredWeight === 0) continue;

    const score = Math.round((100 * weightedSum) / answeredWeight);
    const confidence = round2((answeredWeight / relevantWeight) * CONFIDENCE_CEILING);
    const category = categoryFor(score);
    const evidence: Evidence[] = used
      .filter((u) => u.signal > 0)
      .map((u) => ({
        questionId: u.q.id,
        question: u.q.short,
        answer: u.labels.join(', '),
        points: Math.round((100 * u.q.weight * u.signal) / answeredWeight),
      }))
      .sort((a, b) => b.points - a.points);

    results.push({
      code, score, category, confidence,
      confidenceLevel: confidenceLevelFor(confidence),
      evidence,
      explanation: explain(code, category, evidence, confidence),
    });
  }
  return results;
}
