import type { InputHTMLAttributes } from 'react';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ id, label, hint, error, ...input }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {hint && <p id={hintId} className="hint">{hint}</p>}
      <input
        id={id}
        className="input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      {error && (
        <p id={errorId} className="error-text" role="alert">
          <span aria-hidden="true">{'\u26a0 '}</span>
          {error}
        </p>
      )}
    </div>
  );
}

interface CheckFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
}

export function CheckField({ id, label, error, ...input }: CheckFieldProps) {
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div>
      <div className="check">
        <input id={id} type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={errorId} {...input} />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && (
        <p id={errorId} className="error-text" role="alert">
          <span aria-hidden="true">{'\u26a0 '}</span>
          {error}
        </p>
      )}
    </div>
  );
}
