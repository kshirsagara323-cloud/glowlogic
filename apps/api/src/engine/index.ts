import { buildNotices } from './notices.js';
import { QUESTIONS, SECTIONS, TRAIT_LABELS } from './quiz.js';
import { scoreTraits } from './score.js';
import { deriveSkinType } from './skinType.js';
import { estimateTone } from './tone.js';
import type { Answers, AssessmentResult, TraitCode } from './types.js';

export { QUESTIONS, QUESTION_BY_ID, SECTIONS, TRAIT_LABELS } from './quiz.js';
export { parsePriorities, validateAnswers } from './validate.js';
export { InvalidInputError, TRAIT_CODES, UNDERTONES } from './types.js';
export type * from './types.js';

/** Bump this whenever any rule, weight or threshold changes. Stored with every assessment. */
export const RULES_VERSION = 'rules-2026-10-v1';

export const DISCLAIMER =
  'This is cosmetic guidance based on your own answers. It is not a medical diagnosis. If you are worried about your skin, please consult a qualified dermatologist or healthcare professional.';

/** Pure function: same answers in, same result out. No database, no network, no randomness. */
export function evaluateAssessment(answers: Answers, priorities: TraitCode[]): AssessmentResult {
  const traits = scoreTraits(answers);
  const pregnancy = answers['pregnancy'];
  const current = answers['current_products'];
  const sunscreen = answers['sunscreen_habit'];
  const restrictions = answers['restrictions'];
  return {
    rulesVersion: RULES_VERSION,
    traits,
    skinType: deriveSkinType(traits, answers),
    tone: estimateTone(answers),
    priorities,
    notices: buildNotices(answers),
    flags: {
      pregnancyOrNursing: pregnancy === 'yes' ? true : pregnancy === 'no' ? false : null,
      currentProducts: Array.isArray(current) ? current : [],
      sunscreenHabit: typeof sunscreen === 'string' ? sunscreen : null,
      restrictionsText: typeof restrictions === 'string' ? restrictions : null,
    },
    disclaimer: DISCLAIMER,
  };
}

/** The quiz as the browser needs it: no scoring weights or signals. */
export function publicQuiz() {
  return {
    rulesVersion: RULES_VERSION,
    sections: SECTIONS,
    questions: QUESTIONS.map((q) => ({
      id: q.id,
      section: q.section,
      prompt: q.prompt,
      hint: q.hint ?? null,
      type: q.type,
      options: q.options.map((option) => ({ id: option.id, label: option.label })),
    })),
    concerns: Object.entries(TRAIT_LABELS).map(([code, label]) => ({ code, label })),
  };
}
