# Recommendation engine (Phase 6)

Location: `apps/api/src/recommend/` (pure TypeScript, no database, no network, no randomness, **no machine learning**).
Why no ML: there is no legitimate, labelled dataset of product outcomes to learn from. A transparent rule
system is honest, testable and explainable. Version: `recs-2026-10-v1`.

## Score (0 to 100, a "recommendation score", not a probability or medical measure)
```
score = 35*ConcernMatch + 25*SkinFit + 15*PreferenceFit + 15*BudgetFit + 10*RoutineFit - RiskPenalty
```
Each component is 0 to 1. RiskPenalty is capped at 40. Weights are design choices, not measured optima.

| Component | How it is calculated |
|---|---|
| ConcernMatch | Your concerns with score 34+ count. Importance = score/100 x (1 + boost), boost 0.5 / 0.3 / 0.15 for your main / secondary / long-term priority. Product benefit per concern comes from its ingredients' "helps" (full) and "supports" (60%) links. Weighted average. Cleansers, moisturisers and sunscreens get a 0.5 base (everyone needs them); treatments need a real match |
| SkinFit | Product's listed skin types vs yours (primary type counts double). Unknown = 0.5 |
| PreferenceFit | Fragrance preference (prefer fragrance-free: 1 if known free, 0 if fragranced, 0.4 if unknown) |
| BudgetFit | At or under your tier 1, one tier over 0.4, more 0. Unknown 0.5. A soft preference, never a filter |
| RoutineFit | Starts at 1; loses 0.3 / 0.6 / 0.9 per "use caution" / "potential irritation" / "avoid" rule against actives you already use (x1.3 if sensitive) |
| RiskPenalty | 14 x your concern level x (relevance/3) for each ingredient that "may worsen" a concern you have |

## Hard exclusions (safety and your own rules, applied before scoring; each is shown to the user with its reason)
- Sunscreen with SPF below 30 or no SPF stated (AAD: broad-spectrum, SPF 30+, water resistant).
- Retinoids when pregnancy/breastfeeding = yes (regulator guidance: avoided in pregnancy as a precaution).
  If you did not say, the product shows with a caution and a notice.
- Fragrance when you chose "avoid fragrance". Anything matching your allergies/avoid text.
- Products with no ingredient list.

## Routine
Levels: minimal (0 actives), beginner (1), moderate (2), advanced (3). Actives that clash are not combined
(moderate and below skip the second one and say so; advanced allows it on alternate nights with a warning).
Retinoids, acids and benzoyl peroxide go in the evening, vitamin C in the morning, sunscreen is always last in the morning.

## Draft status (read this)
- All ingredient-concern links, irritation levels and compatibility rules are `needs_verification`.
  Only two references are recorded so far (AAD sunscreen FAQ; Malta Medicines Authority retinoid notice), and
  `verified_by_human` is false until you open the links and confirm them. Phase 7 completes this.
- **All products in this phase are fictional DEMO DATA** (brand "Demo Labs"). Real data comes in Phase 8.
- Accuracy has not been measured. Phase 14 adds persona tests and a usability study.

## API
| Method | Path | Notes |
|---|---|---|
| POST | `/api/v1/assessments/:id/recommendations` | body `{complexity?}`; 201 with routine, products, reasons, exclusions. Limited to 30/hour |
| GET | `/api/v1/assessments/:id/recommendations/latest` | 404 `no_recommendations` if none yet |
