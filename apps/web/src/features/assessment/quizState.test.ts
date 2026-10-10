import { beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, loadDraft, prioritiesError, saveDraft, toggleMulti } from './quizState';

describe('toggleMulti', () => {
  it('adds and removes choices', () => {
    expect(toggleMulti(undefined, 'a')).toEqual(['a']);
    expect(toggleMulti(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleMulti(['a', 'b'], 'a')).toEqual(['b']);
  });
  it('makes "none" exclusive in both directions', () => {
    expect(toggleMulti(['a', 'b'], 'none')).toEqual(['none']);
    expect(toggleMulti(['none'], 'a')).toEqual(['a']);
    expect(toggleMulti(['none'], 'none')).toEqual([]);
  });
});

describe('prioritiesError', () => {
  it('needs a main concern', () => {
    expect(prioritiesError(['', '', ''])).not.toBeNull();
  });
  it('rejects duplicates and accepts valid lists', () => {
    expect(prioritiesError(['acne', 'acne', ''])).not.toBeNull();
    expect(prioritiesError(['acne', '', ''])).toBeNull();
    expect(prioritiesError(['acne', 'dryness', 'redness'])).toBeNull();
  });
});

describe('draft storage', () => {
  beforeEach(() => sessionStorage.clear());
  it('round-trips and clears', () => {
    saveDraft({ answers: { a: 'b' }, priorities: ['acne', '', ''], step: 2 });
    expect(loadDraft()).toEqual({ answers: { a: 'b' }, priorities: ['acne', '', ''], step: 2 });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
  it('ignores corrupted data instead of crashing', () => {
    sessionStorage.setItem('glowlogic.quizDraft.v1', '{not json');
    expect(loadDraft()).toBeNull();
    sessionStorage.setItem('glowlogic.quizDraft.v1', JSON.stringify({ answers: [], priorities: [], step: 0 }));
    expect(loadDraft()).toBeNull();
  });
});
