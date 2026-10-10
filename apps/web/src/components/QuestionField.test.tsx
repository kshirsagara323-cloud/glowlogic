import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { QuizQuestion } from '../features/assessment/api';
import { QuestionField } from './QuestionField';

const single: QuizQuestion = {
  id: 'shine', section: 's', prompt: 'How shiny?', hint: 'Think midday.', type: 'single',
  options: [{ id: 'none', label: 'Not shiny' }, { id: 'lots', label: 'Very shiny' }],
};
const multi: QuizQuestion = {
  id: 'flags', section: 's', prompt: 'Any of these?', hint: null, type: 'multi',
  options: [{ id: 'a', label: 'Thing A' }, { id: 'none', label: 'None of these' }],
};

describe('QuestionField', () => {
  it('is a labelled radio group and reports the chosen option', async () => {
    const onChange = vi.fn();
    render(<QuestionField question={single} value={undefined} onChange={onChange} />);
    expect(screen.getByRole('group', { name: 'How shiny?' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: 'Very shiny' }));
    expect(onChange).toHaveBeenCalledWith('lots');
  });
  it('lets the user clear a single answer', async () => {
    const onChange = vi.fn();
    render(<QuestionField question={single} value="lots" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /clear answer/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
  it('keeps "none" exclusive for multi-choice questions', async () => {
    const onChange = vi.fn();
    render(<QuestionField question={multi} value={['a']} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'None of these' }));
    expect(onChange).toHaveBeenCalledWith(['none']);
  });
});
