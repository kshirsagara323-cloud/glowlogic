# Assessment engine (Phase 5)

Location: `apps/api/src/engine/` (pure TypeScript, no database or network). It is kept inside the API
for now; it moves to its own package when the browser needs it.

## How a score is calculated
1. Each quiz option says how strongly it points to a trait (0 to 1). No entry = "no information".
2. Trait score = weighted average of the answers that carry information about that trait, times 100.
   Skipped questions are **not** zeros; they only lower confidence.
3. Confidence = (weight answered / weight available) x 0.85. The 0.85 ceiling exists because these are
   self-reported answers and are never treated as certain.
4. Category: low below 34, moderate 34-66, high 67 and above. **These cut-offs and all weights are design
   choices (rules of thumb), not clinical values, and have not been validated against dermatologists.**
5. Every score keeps its evidence: which answers contributed how many points.
   The "Why?" text is generated from that same evidence, so explanation and score cannot disagree.

## Skin type
One primary type (dry, oily, combination, normal) plus separate `dehydrated` and `sensitive` flags, so
oily + dehydrated + sensitive is valid. Combination = shine mainly on forehead/nose (unless oiliness is
very high), or clear signs of both oiliness and dryness.

## Tone and undertone
- Depth: self-picked from 10 described bins (our own scale). Confidence fixed at 0.5 ("medium" at best).
- Undertone: votes from three folk-test questions (wrist veins, jewellery metal, colour cast).
  Maximum confidence 0.6. Conflicting answers give "neutral" with low confidence. "Not sure" never counts.
- Both can be corrected by the user (stored as `user_override`, which always wins; the original is kept).

## Safety
A "skin changes" question produces calm referral notices (never a diagnosis). Severe reaction
(face/lip swelling, trouble breathing) shows an urgent "seek emergency help" notice.

## Reproducibility
Every assessment stores its answers, the full result and `rules-2026-10-v1`. Changing any weight or
threshold means bumping the version in `engine/index.ts`. Old reports never change.

## Not done yet (honest list)
- Photo evidence (Phase 9) will be added as source `photo`, then combined.
- Climate and lifestyle are not used in scoring because we have no evidence-based rule for them.
- Makeup preferences are collected in Phase 10.
- Accuracy has NOT been measured. Phase 14 adds persona tests and a usability study.
