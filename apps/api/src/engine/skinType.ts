import { confidenceLevelFor, round2 } from './score.js';
import type { Answers, SkinTypeName, SkinTypeResult, TraitResult } from './types.js';

/**
 * Skin types are NOT exclusive: one primary type plus separate "dehydrated" and "sensitive" flags,
 * so oily + dehydrated + sensitive is a valid result.
 */
export function deriveSkinType(traits: TraitResult[], answers: Answers): SkinTypeResult | null {
  const find = (code: string) => traits.find((t) => t.code === code);
  const oil = find('oiliness');
  const dry = find('dryness');
  if (!oil && !dry) return null;

  const oilScore = oil?.score ?? 0;
  const dryScore = dry?.score ?? 0;
  const tzoneShine = answers['shine_midday'] === 'tzone_slight' || answers['shine_midday'] === 'tzone_clear';

  let primary: SkinTypeName;
  let reason: string;
  if (tzoneShine && oilScore < 85) {
    primary = 'combination';
    reason = 'you reported shine mainly on the forehead and nose';
  } else if (oilScore >= 60 && dryScore < 40) {
    primary = 'oily';
    reason = `your oiliness score is ${oilScore} and your dryness score is ${dryScore}`;
  } else if (dryScore >= 60 && oilScore < 40) {
    primary = 'dry';
    reason = `your dryness score is ${dryScore} and your oiliness score is ${oilScore}`;
  } else if (oilScore >= 40 && dryScore >= 40) {
    primary = 'combination';
    reason = `you have signs of both oiliness (${oilScore}) and dryness (${dryScore})`;
  } else {
    primary = 'normal';
    reason = 'neither oiliness nor dryness stands out';
  }

  const dehydration = find('dehydration');
  const sensitivity = find('sensitivity');
  const dehydrated = (dehydration?.score ?? 0) >= 50;
  const sensitive = (sensitivity?.score ?? 0) >= 50;

  const confidences = [oil?.confidence, dry?.confidence].filter((c): c is number => c !== undefined);
  const confidence = round2(confidences.reduce((a, b) => a + b, 0) / confidences.length);

  const extras = [dehydrated ? 'dehydration-related concerns' : '', sensitive ? 'sensitivity' : ''].filter(Boolean);
  const explanation =
    `Your skin looks ${primary} because ${reason}.` +
    (extras.length > 0 ? ` You also show signs of ${extras.join(' and ')}, which can happen alongside any skin type.` : '');

  return { primary, dehydrated, sensitive, confidence, confidenceLevel: confidenceLevelFor(confidence), explanation };
}
