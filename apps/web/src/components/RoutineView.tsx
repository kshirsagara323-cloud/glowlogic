import type { Recommendations, RoutineStep, ScoredProduct } from '../features/recommend/api';
import '../styles/assessment.css';
import '../styles/routine.css';

const CATEGORY: Record<string, string> = {
  cleanser: 'Cleanser', moisturizer: 'Moisturiser', sunscreen: 'Sunscreen', serum: 'Serum',
  acne_treatment: 'Acne treatment', exfoliant: 'Exfoliant', toner: 'Toner', mask: 'Mask', eye_product: 'Eye product',
};
const FREQUENCY: Record<string, string> = {
  daily: 'Every day', every_other_day: 'Every other day', two_three_per_week: '2 to 3 times a week',
  weekly: 'Once a week', as_needed: 'As needed',
};
const TIER = ['', 'Budget-friendly', 'Mid-range', 'Higher-end', 'Luxury'];
const catLabel = (c: string) => CATEGORY[c] ?? c;

function Breakdown({ item }: { item: ScoredProduct }) {
  const b = item.breakdown;
  return (
    <>
      <p className="muted">
        Recommendation score: <strong>{item.score}/100</strong>. This is a score from transparent rules, not a medical
        measure or a chance of success.
      </p>
      <dl className="breakdown">
        <dt>Matches your concerns (max 35)</dt><dd>+{b.concernMatch}</dd>
        <dt>Suits your skin type (max 25)</dt><dd>+{b.skinFit}</dd>
        <dt>Your preferences (max 15)</dt><dd>+{b.preferenceFit}</dd>
        <dt>Budget (max 15)</dt><dd>+{b.budgetFit}</dd>
        <dt>Fits what you already use (max 10)</dt><dd>+{b.routineFit}</dd>
        <dt>Possible irritation or risk</dt><dd>&minus;{b.riskPenalty}</dd>
      </dl>
    </>
  );
}

function WhyDetails({ item }: { item: ScoredProduct }) {
  return (
    <details>
      <summary>Why this product?</summary>
      <ul>{item.reasons.map((r) => <li key={r.message}>{r.message}</li>)}</ul>
      {item.product.keyIngredients.length > 0 && <p>Key ingredients: {item.product.keyIngredients.join(', ')}</p>}
      <Breakdown item={item} />
    </details>
  );
}

function ProductTags({ step }: { step: RoutineStep }) {
  const p = step.product;
  return (
    <p className="muted">
      {p.brand}
      {p.priceTier ? ` \u00b7 ${TIER[p.priceTier]}` : ''}
      {p.spf ? ` \u00b7 SPF ${p.spf}` : ''}
      {p.fragranceFree === true ? ' \u00b7 Fragrance-free' : ''}
      {p.isDemo && ' \u00b7 '}
      {p.isDemo && <span className="tag">DEMO DATA</span>}
    </p>
  );
}

function Steps({ title, steps, all }: { title: string; steps: RoutineStep[]; all: Recommendations }) {
  const scoredFor = (step: RoutineStep) =>
    all.categories.flatMap((c) => c.items).find((i) => i.product.id === step.product.id);
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      {steps.length === 0 && <p className="muted">No steps for this routine.</p>}
      <ol className="routine-list">
        {steps.map((step) => {
          const scored = scoredFor(step);
          return (
            <li key={`${title}-${step.order}`} className="card">
              <div className="step-head">
                <h3>{step.order}. {catLabel(step.category)}: {step.product.name}</h3>
                <span className="tag">{FREQUENCY[step.frequency] ?? step.frequency}</span>
              </div>
              <ProductTags step={step} />
              <p>{step.why}</p>
              <p><strong>How to use:</strong> {step.howToUse}</p>
              {step.cautions.length > 0 && (
                <ul className="cautions">{step.cautions.map((c) => <li key={c}>{c}</li>)}</ul>
              )}
              {scored && <WhyDetails item={scored} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function RoutineView({ data }: { data: Recommendations }) {
  const { routine } = data;
  return (
    <div className="stack">
      {data.dataNote && <p className="demo-banner" role="note">{data.dataNote}</p>}

      {data.notices.map((n) => <p key={n} className="notice notice-consult"><strong>Please note: </strong>{n}</p>)}

      <p className="muted">
        {routine.activeCount} active ingredient{routine.activeCount === 1 ? '' : 's'} in this {routine.level} routine.
        We keep routines small on purpose: introduce one new active at a time.
      </p>

      <div className="two-col">
        <Steps title="Morning" steps={routine.am} all={data} />
        <Steps title="Night" steps={routine.pm} all={data} />
      </div>

      {routine.warnings.length > 0 && (
        <section aria-label="Routine warnings">
          <h2>Things to be careful with</h2>
          <ul className="cautions">{routine.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </section>
      )}
      {routine.notes.length > 0 && <ul>{routine.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

      <section aria-labelledby="alt-title">
        <h2 id="alt-title">Other options</h2>
        {data.categories.map((group) => (
          <details key={group.category}>
            <summary>{catLabel(group.category)} ({group.items.length})</summary>
            <ul>
              {group.items.map((item) => (
                <li key={item.product.id}>
                  <strong>{item.product.name}</strong> &middot; score {item.score}/100
                  <WhyDetails item={item} />
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>

      <section aria-labelledby="excluded-title">
        <h2 id="excluded-title">Products we filtered out</h2>
        {data.excluded.length === 0 ? (
          <p className="muted">Nothing was filtered out for you.</p>
        ) : (
          <details>
            <summary>{data.excluded.length} filtered out for safety or your own rules</summary>
            <ul>{data.excluded.map((e) => <li key={e.productId}><strong>{e.name}</strong>: {e.reason}</li>)}</ul>
          </details>
        )}
      </section>

      <p className="note">{data.disclaimer}</p>
      <p className="muted">Engine version {data.engineVersion}. Ingredient guidance in this version is draft and awaiting expert review.</p>
    </div>
  );
}
