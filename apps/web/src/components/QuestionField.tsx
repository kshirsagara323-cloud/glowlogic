import { toggleMulti } from '../features/assessment/quizState';
import type { QuizQuestion } from '../features/assessment/api';
import { Field } from './Field';

interface Props {
  question: QuizQuestion;
  value: string | string[] | undefined;
  onChange: (value: string | string[] | undefined) => void;
}

export function QuestionField({ question, value, onChange }: Props) {
  if (question.type === 'text') {
    return (
      <Field
        id={`q-${question.id}`}
        label={question.prompt}
        hint={question.hint ?? undefined}
        maxLength={200}
        autoComplete="off"
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      />
    );
  }
  const multi = question.type === 'multi';
  const hintId = question.hint ? `q-${question.id}-hint` : undefined;
  return (
    <fieldset className="question" aria-describedby={hintId}>
      <legend>{question.prompt}</legend>
      {question.hint && <p id={hintId} className="hint">{question.hint}</p>}
      {question.options.map((option) => {
        const checked = multi ? Array.isArray(value) && value.includes(option.id) : value === option.id;
        return (
          <label className="option" key={option.id}>
            <input
              type={multi ? 'checkbox' : 'radio'}
              name={question.id}
              value={option.id}
              checked={checked}
              onChange={() => onChange(multi ? toggleMulti(Array.isArray(value) ? value : undefined, option.id) : option.id)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
      {!multi && value !== undefined && (
        <button type="button" className="link-button" onClick={() => onChange(undefined)}>Clear answer</button>
      )}
    </fieldset>
  );
}
