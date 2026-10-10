import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { SelectField } from '../components/Field';
import { ApiError } from '../lib/api';
import { deleteAssessment, getAssessment, getQuiz, overrideAssessment } from '../features/assessment/api';
import type { AssessmentDetail, Category, Quiz } from '../features/assessment/api';
import { usePageTitle } from '../hooks/usePageTitle';
import '../styles/assessment.css';

const CATEGORY_LABEL: Record<Category, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
const NOTICE_PREFIX = { urgent: 'Urgent: ', consult: 'Worth a professional opinion: ', info: 'Note: ' } as const;
const UNDERTONES = [['warm', 'Warm'], ['cool', 'Cool'], ['neutral', 'Neutral'], ['olive', 'Olive']];

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="bar" aria-hidden="true">
      <div className="bar-fill" style={{ width: `${score}%` }} />
    </div>
  );
}

export function AssessmentReport() {
  usePageTitle('Your skin report');
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AssessmentDetail | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'missing'>('loading');
  const [status, setStatus] = useState('');
  const [depth, setDepth] = useState('');
  const [undertone, setUndertone] = useState('');

  function apply(next: AssessmentDetail) {
    setDetail(next);
    setDepth(next.effectiveTone?.depthBin ? String(next.effectiveTone.depthBin) : '');
    setUndertone(next.effectiveTone?.undertone ?? '');
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAssessment(id), getQuiz()])
      .then(([d, q]) => {
        if (cancelled) return;
        apply(d);
        setQuiz(q);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (!cancelled) setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function run(action: () => Promise<void>, failure: string) {
    setStatus('');
    try {
      await action();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : failure);
    }
  }

  const adjustTrait = (code: string, level: string) =>
    run(async () => apply(await overrideAssessment(id, { traits: { [code]: (level || null) as Category | null } })), 'Could not save your change.');

  const saveTone = () =>
    run(async () => {
      apply(await overrideAssessment(id, { tone: { depthBin: depth ? Number(depth) : null, undertone: undertone || null } }));
      setStatus('Saved.');
    }, 'Could not save your change.');

  const remove = () =>
    run(async () => {
      await deleteAssessment(id);
      navigate('/assessment');
    }, 'Could not delete this assessment.');

  if (state === 'loading') return <p role="status">Loading your report&hellip;</p>;
  if (state === 'missing') return <p>We couldn&rsquo;t find that assessment. <Link to="/assessment">Back to assessments</Link></p>;
  if (state === 'error' || !detail || !quiz) return <p role="alert">We couldn&rsquo;t load your report. Please refresh and try again.</p>;

  const { result } = detail;
  const labelOf = (code: string) => quiz.concerns.find((c) => c.code === code)?.label ?? code;
  const depthOptions = quiz.questions.find((q) => q.id === 'skin_depth')?.options ?? [];
  const traits = [...detail.effectiveTraits].sort((a, b) => b.score - a.score);

  return (
    <div className="stack">
      <h1>Your skin report</h1>
      <p className="muted">
        Based on your own answers on {new Date(detail.createdAt).toLocaleDateString()}. Everything here is an
        estimate you can correct.
      </p>

      {result.notices.length > 0 && (
        <section aria-label="Important notices" className="stack">
          {result.notices.map((n) => (
            <div key={n.code} className={`notice notice-${n.level}`} role={n.level === 'urgent' ? 'alert' : 'note'}>
              <strong>{NOTICE_PREFIX[n.level]}</strong>{n.message}
            </div>
          ))}
        </section>
      )}

      {result.skinType && (
        <section className="card" aria-labelledby="type-title">
          <h2 id="type-title">Skin type</h2>
          <p className="big">
            {result.skinType.primary[0]?.toUpperCase()}{result.skinType.primary.slice(1)}
            {result.skinType.dehydrated && ' + dehydrated'}
            {result.skinType.sensitive && ' + sensitive'}
          </p>
          <ConfidenceBadge level={result.skinType.confidenceLevel} />
          <p>{result.skinType.explanation}</p>
        </section>
      )}

      {detail.priorities.length > 0 && (
        <section className="card" aria-labelledby="prio-title">
          <h2 id="prio-title">Your priorities</h2>
          <ol>
            {detail.priorities.map((code, index) => (
              <li key={code}>
                {labelOf(code)} <span className="muted">({['main concern', 'secondary', 'long-term goal'][index]})</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="traits-title">
        <h2 id="traits-title">What your answers show</h2>
        {traits.length === 0 && <p className="muted">You skipped the scored questions, so there is nothing to show yet. Retake the assessment any time.</p>}
        <ul className="traits">
          {traits.map((t) => {
            const original = result.traits.find((r) => r.code === t.code);
            const adjusted = t.source === 'user_override';
            return (
              <li key={t.code} className="card trait">
                <h3>{labelOf(t.code)}</h3>
                <p>
                  <strong>{CATEGORY_LABEL[t.category]}</strong> &middot; {t.score}/100
                  {adjusted && <span className="muted"> (adjusted by you)</span>}
                </p>
                <ScoreBar score={t.score} />
                {original && !adjusted && <ConfidenceBadge level={original.confidenceLevel} />}
                {original && (
                  <details>
                    <summary>Why?</summary>
                    <p>{original.explanation}</p>
                    {original.evidence.length > 0 && (
                      <ul>
                        {original.evidence.map((e) => (
                          <li key={e.questionId}>{e.question}: &ldquo;{e.answer}&rdquo; ({e.points} points)</li>
                        ))}
                      </ul>
                    )}
                  </details>
                )}
                <SelectField id={`adjust-${t.code}`} label="This doesn't look right? Adjust it" placeholder="Use my answers"
                  options={[{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }]}
                  value={adjusted ? t.category : ''} onChange={(e) => void adjustTrait(t.code, e.target.value)} />
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card" aria-labelledby="tone-title">
        <h2 id="tone-title">Skin tone and undertone</h2>
        {result.tone.depthBin === null && result.tone.undertone === null && <p className="muted">You skipped these questions. You can set them below.</p>}
        <div className="badge-row">
          {result.tone.depthBin !== null && <span>Depth: <ConfidenceBadge level={result.tone.depthConfidenceLevel} /></span>}
          {result.tone.undertone !== null && <span>Undertone: <ConfidenceBadge level={result.tone.undertoneConfidenceLevel} /></span>}
        </div>
        {result.tone.notes.map((n) => <p key={n} className="muted">{n}</p>)}
        <SelectField id="tone-depth" label="Skin depth" options={depthOptions.map((o) => ({ value: o.id.slice(1), label: o.label }))}
          value={depth} onChange={(e) => setDepth(e.target.value)} />
        <SelectField id="tone-undertone" label="Undertone" options={UNDERTONES.map(([value, label]) => ({ value, label: label as string }))}
          value={undertone} onChange={(e) => setUndertone(e.target.value)} />
        <Button variant="secondary" onClick={() => void saveTone()}>Save my correction</Button>
      </section>

      <p className="note">{result.disclaimer}</p>
      <p className="muted">Routine and product recommendations arrive in the next phase.</p>

      <section className="danger-zone" aria-labelledby="del-title">
        <h2 id="del-title">Delete this assessment</h2>
        <p>Permanently removes these answers and results.</p>
        <Button variant="secondary" className="btn-danger" onClick={() => void remove()}>Delete assessment</Button>
      </section>
      <p className="status" role="status">{status}</p>
      <p><Link to="/assessment">Back to assessments</Link></p>
    </div>
  );
}
