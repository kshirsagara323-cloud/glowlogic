import { QUESTIONS } from './quiz.js';
import { InvalidInputError, TRAIT_CODES } from './types.js';
import type { Answers, QuizQuestion, TraitCode } from './types.js';

export const MAX_TEXT_LENGTH = 200;

/** Checks raw input against the quiz definition and returns a clean copy. Throws InvalidInputError. */
export function validateAnswers(raw: unknown, questions: QuizQuestion[] = QUESTIONS): Answers {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new InvalidInputError(['Answers must be an object.']);

  const byId = new Map(questions.map((q) => [q.id, q]));
  const issues: string[] = [];
  const clean: Answers = {};

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const q = byId.get(key);
    if (!q) {
      issues.push(`Unknown question "${key.slice(0, 40)}".`);
      continue;
    }
    if (q.type === 'text') {
      if (typeof value !== 'string') {
        issues.push(`${q.id}: expected text.`);
        continue;
      }
      const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
      if (text.length > MAX_TEXT_LENGTH) issues.push(`${q.id}: at most ${MAX_TEXT_LENGTH} characters.`);
      else if (text) clean[key] = text;
      continue;
    }
    const validIds = new Set(q.options.map((option) => option.id));
    if (q.type === 'single') {
      if (value === '' || value === null || value === undefined) continue;
      if (typeof value !== 'string' || !validIds.has(value)) issues.push(`${q.id}: invalid choice.`);
      else clean[key] = value;
      continue;
    }
    if (!Array.isArray(value)) {
      issues.push(`${q.id}: expected a list of choices.`);
      continue;
    }
    const unique = [...new Set(value)];
    if (unique.length === 0) continue;
    if (!unique.every((v): v is string => typeof v === 'string' && validIds.has(v))) {
      issues.push(`${q.id}: invalid choice.`);
    } else if (unique.includes('none') && unique.length > 1) {
      issues.push(`${q.id}: "none" cannot be combined with other choices.`);
    } else {
      clean[key] = unique;
    }
  }
  if (issues.length > 0) throw new InvalidInputError(issues);
  return clean;
}

/** Priorities: 1 to 3 distinct concerns, in order (main, secondary, long-term). */
export function parsePriorities(raw: unknown): TraitCode[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) {
    throw new InvalidInputError(['Choose between 1 and 3 priorities.']);
  }
  const valid = new Set<string>(TRAIT_CODES);
  if (!raw.every((v): v is TraitCode => typeof v === 'string' && valid.has(v))) {
    throw new InvalidInputError(['Unknown priority.']);
  }
  if (new Set(raw).size !== raw.length) throw new InvalidInputError(['Each priority must be different.']);
  return raw;
}
