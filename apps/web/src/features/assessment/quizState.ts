import type { Answers } from './api';

const DRAFT_KEY = 'glowlogic.quizDraft.v1';

/** Multi-choice toggle where "none" is exclusive: picking it clears the rest, picking anything else clears it. */
export function toggleMulti(current: string[] | undefined, optionId: string): string[] {
  const list = current ?? [];
  if (optionId === 'none') return list.includes('none') ? [] : ['none'];
  const without = list.filter((id) => id !== 'none');
  return without.includes(optionId) ? without.filter((id) => id !== optionId) : [...without, optionId];
}

/** priorities[0] = main concern (required), [1] = secondary, [2] = long-term. */
export function prioritiesError(priorities: string[]): string | null {
  if (!priorities[0]) return 'Choose your main concern.';
  const chosen = priorities.filter(Boolean);
  if (new Set(chosen).size !== chosen.length) return 'Each priority must be different.';
  return null;
}

export interface Draft { answers: Answers; priorities: string[]; step: number }

// sessionStorage: survives a refresh, disappears when the tab closes. Answers are personal, so never persisted longer.
export function loadDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Draft> | null;
    if (!parsed || typeof parsed.answers !== 'object' || parsed.answers === null || Array.isArray(parsed.answers)) return null;
    if (!Array.isArray(parsed.priorities) || typeof parsed.step !== 'number') return null;
    return { answers: parsed.answers, priorities: parsed.priorities.map(String).slice(0, 3), step: Math.max(0, Math.floor(parsed.step)) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage unavailable (private mode, quota): the quiz still works, just without refresh recovery
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}
