import { ButtonLink } from '../components/Button';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { usePageTitle } from '../hooks/usePageTitle';

export function Landing() {
  usePageTitle('Explainable skincare guidance');
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <span className="eyebrow">In development</span>
        <h1 id="hero-title">Skincare guidance that shows its work.</h1>
        <p className="lead">
          Answer a short assessment and get a routine, products and shade guidance, each with
          the reasons behind it. No black box, no medical claims.
        </p>
        <div className="btn-row">
          <ButtonLink to="/register">Create a free account</ButtonLink>
          <a className="btn btn-secondary" href="#how-it-works">See how it works</a>
        </div>
      </section>

      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How it works</h2>
        <ol className="steps">
          <li className="card">
            <h3>Tell us about your skin</h3>
            <p>A step-by-step assessment captures mixed traits, such as oily and dehydrated at once, instead of forcing one skin type.</p>
          </li>
          <li className="card">
            <h3>Optionally add a photo</h3>
            <p>Photo checks are planned to run on your device and are never required. You can always correct the result yourself.</p>
          </li>
          <li className="card">
            <h3>Get explained recommendations</h3>
            <p>Every routine step and product comes with a plain-language &ldquo;why&rdquo;, plus cautions where ingredients may not mix well.</p>
          </li>
        </ol>
      </section>

      <section className="section" aria-labelledby="principles-title">
        <h2 id="principles-title">How GlowLogic is designed</h2>
        <div className="grid">
          <div className="card">
            <h3>Explainable</h3>
            <p>Scores come from transparent rules you can inspect, not a mystery model.</p>
          </div>
          <div className="card">
            <h3>Private by default</h3>
            <p>Photo analysis is designed to happen in your browser. Deleting your account deletes your data.</p>
          </div>
          <div className="card">
            <h3>Honest about data</h3>
            <p>Every product fact records its source. Unknown information is shown as unknown, never guessed.</p>
          </div>
          <div className="card">
            <h3>Fair across skin tones</h3>
            <p>Tone and undertone estimates are tested across depths and lighting, and their limits are published.</p>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="confidence-title">
        <h2 id="confidence-title">Confidence is always visible</h2>
        <p>Estimates such as undertone or shade matches carry a confidence label. Examples of the labels you will see:</p>
        <div className="badge-row">
          <ConfidenceBadge level="high" />
          <ConfidenceBadge level="medium" />
          <ConfidenceBadge level="low" />
        </div>
        <p className="muted" style={{ marginTop: '1rem' }}>Example labels only. No analysis has been run on this page.</p>
      </section>
    </>
  );
}
