import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { SelectField } from '../components/Field';
import { RoutineView } from '../components/RoutineView';
import { createRecommendations, getLatestRecommendations } from '../features/recommend/api';
import type { Recommendations, RoutineLevel } from '../features/recommend/api';
import { usePageTitle } from '../hooks/usePageTitle';

const LEVELS = [
  { value: 'minimal', label: 'Minimal (fewest steps, no actives)' },
  { value: 'beginner', label: 'Beginner (at most 1 active)' },
  { value: 'moderate', label: 'Moderate (up to 2 actives)' },
  { value: 'advanced', label: 'Advanced (up to 3 actives)' },
];

export function RoutinePage() {
  usePageTitle('Your routine');
  const { id = '' } = useParams();
  const [data, setData] = useState<Recommendations | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [level, setLevel] = useState<RoutineLevel>('beginner');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getLatestRecommendations(id)
      .then((latest) => {
        if (cancelled) return;
        if (latest) {
          setData(latest);
          setLevel(latest.routine.level);
        }
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function build() {
    setBusy(true);
    setError('');
    try {
      setData(await createRecommendations(id, level));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  if (state === 'loading') return <p role="status">Loading&hellip;</p>;
  if (state === 'error') return <p role="alert">We couldn&rsquo;t load this page. Please refresh and try again.</p>;

  return (
    <div className="stack">
      <h1>Your routine and products</h1>
      <p><Link to={`/assessment/${id}`}>&larr; Back to your skin report</Link></p>

      <section className="card" aria-labelledby="build-title">
        <h2 id="build-title">{data ? 'Rebuild with a different size' : 'Build your routine'}</h2>
        <p className="muted">Pick how many steps and active ingredients you are comfortable with. You can change this any time.</p>
        <SelectField id="routine-level" label="Routine size" placeholder="Choose" options={LEVELS}
          value={level} onChange={(e) => setLevel(e.target.value as RoutineLevel)} />
        <Button onClick={() => void build()} disabled={busy}>{busy ? 'Working it out\u2026' : data ? 'Rebuild' : 'Build my routine'}</Button>
        {error && <p className="error-text" role="alert">{error}</p>}
      </section>

      {data && <RoutineView data={data} />}
    </div>
  );
}
