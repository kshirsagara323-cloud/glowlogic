import type { Answers, Notice } from './types.js';

const FLAG_NOTICES: Record<string, Notice> = {
  changing_mole: {
    level: 'consult', code: 'redflag_changing_mole',
    message: 'A mole or spot that is changing or bleeding is worth showing to a dermatologist or doctor soon. GlowLogic cannot diagnose anything.',
  },
  non_healing: {
    level: 'consult', code: 'redflag_non_healing',
    message: 'A sore or patch that has not healed in a few weeks is worth having checked by a doctor or dermatologist.',
  },
  painful_rash: {
    level: 'consult', code: 'redflag_painful_rash',
    message: 'A painful, blistering or fast-spreading rash, or skin symptoms with a fever, should be checked by a doctor promptly.',
  },
  severe_reaction: {
    level: 'urgent', code: 'redflag_severe_reaction',
    message: 'Swelling of the face or lips, or trouble breathing, needs urgent medical care. Please seek emergency help now rather than using this app.',
  },
};

export function buildNotices(answers: Answers): Notice[] {
  const notices: Notice[] = [];

  const flags = answers['red_flags'];
  for (const id of Array.isArray(flags) ? flags : []) {
    const notice = FLAG_NOTICES[id];
    if (notice) notices.push(notice);
  }
  // Most serious first.
  const order = { urgent: 0, consult: 1, info: 2 } as const;
  notices.sort((a, b) => order[a.level] - order[b.level]);

  const breakoutTypes = answers['breakout_types'];
  if (Array.isArray(breakoutTypes) && breakoutTypes.includes('deep')) {
    notices.push({
      level: 'consult', code: 'deep_breakouts',
      message: 'Deep, painful breakouts can leave marks. A dermatologist can offer treatments that skincare products cannot.',
    });
  }
  if (answers['lasting_redness'] === 'noticeable') {
    notices.push({
      level: 'consult', code: 'lasting_redness',
      message: 'Redness that lasts for days can have several causes. If it is new, spreading or bothers you, consider asking a dermatologist.',
    });
  }
  return notices;
}
