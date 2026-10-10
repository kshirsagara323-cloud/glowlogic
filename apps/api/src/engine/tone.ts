import { QUESTION_BY_ID } from './quiz.js';
import { chosenOptions, confidenceLevelFor, round2 } from './score.js';
import type { Answers, ToneResult, Undertone } from './types.js';

export const DEPTH_CONFIDENCE = 0.5; // self-reported depth: at best "medium"
export const UNDERTONE_CEILING = 0.6; // folk tests: even full agreement stays "medium"
const UNDERTONE_QUESTIONS = ['undertone_veins', 'undertone_jewellery', 'undertone_cast'];

export function estimateTone(answers: Answers): ToneResult {
  const notes: string[] = [];

  // Depth
  const depthQuestion = QUESTION_BY_ID.get('skin_depth');
  const depthOption = depthQuestion ? chosenOptions(depthQuestion, answers)[0] : undefined;
  const depthBin = depthOption?.depthBin ?? null;
  const depthConfidence = depthBin === null ? 0 : DEPTH_CONFIDENCE;
  if (depthBin !== null) notes.push('Depth is self-reported and approximate. Screens and lighting change how colours look.');

  // Undertone: each answered question casts one vote.
  const totals: Record<Undertone, number> = { warm: 0, cool: 0, neutral: 0, olive: 0 };
  let answered = 0;
  for (const id of UNDERTONE_QUESTIONS) {
    const question = QUESTION_BY_ID.get(id);
    const option = question ? chosenOptions(question, answers)[0] : undefined;
    if (!option?.votes) continue;
    answered += 1;
    for (const [tone, count] of Object.entries(option.votes) as [Undertone, number][]) totals[tone] += count;
  }

  let undertone: Undertone | null = null;
  let undertoneConfidence = 0;
  if (answered > 0) {
    const ranked = (Object.entries(totals) as [Undertone, number][]).sort((a, b) => b[1] - a[1]);
    const [topTone, top] = ranked[0] as [Undertone, number];
    const second = (ranked[1] as [Undertone, number])[1];
    if (top === second) {
      undertone = 'neutral';
      notes.push('Your undertone answers pointed in different directions, which often means a neutral undertone. Low confidence.');
    } else {
      undertone = topTone;
    }
    undertoneConfidence = round2(UNDERTONE_CEILING * (answered / UNDERTONE_QUESTIONS.length) * ((top - second) / answered));
    notes.push('Undertone is estimated from simple rules of thumb and is only approximate. You can correct it.');
  }

  return {
    depthBin, undertone, depthConfidence, undertoneConfidence,
    depthConfidenceLevel: confidenceLevelFor(depthConfidence),
    undertoneConfidenceLevel: confidenceLevelFor(undertoneConfidence),
    notes,
  };
}
