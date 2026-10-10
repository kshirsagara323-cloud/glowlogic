import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ButtonLink } from '../components/Button';
import { listAssessments } from '../features/assessment/api';
import { usePageTitle } from '../hooks/usePageTitle';

export function AssessmentHome() {
  usePageTitle('Skin assessment');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<{ id: string; createdAt: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    listAssessments()
      .then((r) => {
        if (cancelled) return;
        setItems(r.assessments);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="stack">
      <h1>Skin assessment</h1>
      <p>A short, step-by-step quiz about how your skin behaves. It takes about 5 minutes, every question is optional, and you can correct any result afterwards.</p>
      <ButtonLink to="/assessment/new">{items.length > 0 ? 'Take a new assessment' : 'Start the assessment'}</ButtonLink>

      <section aria-labelledby="past-title">
        <h2 id="past-title">Your past results</h2>
        {state === 'loading' && <p role="status">Loading&hellip;</p>}
        {state === 'error' && <p role="alert">We couldn&rsquo;t load your past results. Please refresh.</p>}
        {state === 'ready' && items.length === 0 && <p className="muted">No assessments yet.</p>}
        {state === 'ready' && items.length > 0 && (
          <ul>
            {items.map((a) => (
              <li key={a.id}>
                <Link to={`/assessment/${a.id}`}>Assessment from {new Date(a.createdAt).toLocaleDateString()}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
