import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { SelectField } from '../components/Field';
import { QuestionField } from '../components/QuestionField';
import { createAssessment, getQuiz } from '../features/assessment/api';
import type { Answers, Quiz } from '../features/assessment/api';
import { clearDraft, loadDraft, prioritiesError, saveDraft } from '../features/assessment/quizState';
import { usePageTitle } from '../hooks/usePageTitle';
import '../styles/assessment.css';

const PRIORITY_LABELS = ['Main concern', 'Secondary concern (optional)', 'Long-term goal (optional)'];

export function AssessmentQuiz() {
  usePageTitle('Skin assessment');
  const navigate = useNavigate();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [answers, setAnswers] = useState<Answers>(() => loadDraft()?.answers ?? {});
  const [priorities, setPriorities] = useState<string[]>(() => {
    const saved = loadDraft()?.priorities ?? [];
    return [saved[0] ?? '', saved[1] ?? '', saved[2] ?? ''];
  });
  const [step, setStep] = useState(() => loadDraft()?.step ?? 0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getQuiz()
      .then((q) => {
        if (!cancelled) setQuiz(q);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveDraft({ answers, priorities, step });
  }, [answers, priorities, step]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, quiz]);

  if (loadError) return <p role="alert">We couldn&rsquo;t load the assessment. Please refresh and try again.</p>;
  if (!quiz) return <p role="status">Loading the assessment&hellip;</p>;

  const total = quiz.sections.length + 1;
  const step0 = Math.min(step, total - 1);
  const onPriorities = step0 === quiz.sections.length;
  const section = quiz.sections[step0];
  const title = onPriorities ? 'Your priorities' : (section?.title ?? '');
  const description = onPriorities
    ? 'Tell us what matters most. We use this order when we rank advice.'
    : (section?.description ?? '');

  function setAnswer(id: string, value: string | string[] | undefined) {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[id];
      else next[id] = value;
      return next;
    });
  }

  function setPriority(index: number, value: string) {
    setPriorities((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function submit() {
    const problem = prioritiesError(priorities);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const detail = await createAssessment({ answers, priorities: priorities.filter(Boolean) });
      clearDraft();
      navigate(`/assessment/${detail.id}`);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="quiz">
      <h1>Skin assessment</h1>
      <p className="muted">Step {step0 + 1} of {total}</p>
      <div className="progress" role="progressbar" aria-label="Assessment progress"
        aria-valuemin={1} aria-valuemax={total} aria-valuenow={step0 + 1}>
        <div className="progress-fill" style={{ width: `${((step0 + 1) / total) * 100}%` }} />
      </div>

      <section className="card" aria-labelledby="step-title">
        <h2 id="step-title" ref={headingRef} tabIndex={-1}>{title}</h2>
        <p className="muted">{description}</p>

        {!onPriorities &&
          quiz.questions
            .filter((q) => q.section === section?.id)
            .map((q) => <QuestionField key={q.id} question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />)}

        {onPriorities &&
          PRIORITY_LABELS.map((label, index) => (
            <SelectField key={label} id={`priority-${index}`} label={label}
              placeholder={index === 0 ? 'Choose\u2026' : 'None'}
              options={quiz.concerns
                .filter((c) => c.code === priorities[index] || !priorities.includes(c.code))
                .map((c) => ({ value: c.code, label: c.label }))}
              value={priorities[index] ?? ''} onChange={(e) => setPriority(index, e.target.value)} />
          ))}

        {error && <p className="error-text" role="alert">{error}</p>}

        <div className="btn-row">
          {step0 > 0 && <Button variant="secondary" onClick={() => setStep(step0 - 1)}>Back</Button>}
          {!onPriorities && <Button onClick={() => setStep(step0 + 1)}>Next</Button>}
          {onPriorities && <Button onClick={() => void submit()} disabled={busy}>{busy ? 'Working it out\u2026' : 'See my results'}</Button>}
        </div>
      </section>
    </div>
  );
}
