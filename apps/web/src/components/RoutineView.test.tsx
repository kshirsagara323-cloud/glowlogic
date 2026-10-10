import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Recommendations, ScoredProduct } from '../features/recommend/api';
import { RoutineView } from './RoutineView';

const product = { id: 1, slug: 'demo-x', name: 'Demo Gel Cleanser', brand: 'Demo Labs', category: 'cleanser', priceTier: 1, spf: null, fragranceFree: true, isDemo: true, keyIngredients: ['Glycerin'] };
const scored: ScoredProduct = {
  product, score: 71.5, reasons: [{ code: 'skin_fit', message: 'Suited to oily skin, matching your results.' }], warnings: [],
  breakdown: { concernMatch: 20, skinFit: 25, preferenceFit: 15, budgetFit: 15, routineFit: 10, riskPenalty: 3.5 },
};
const sample: Recommendations = {
  runId: 'r1', createdAt: '2026-10-10T00:00:00Z', engineVersion: 'recs-test',
  routine: {
    level: 'beginner', activeCount: 0, warnings: ['Do not combine these.'], notes: [],
    am: [{ order: 1, category: 'cleanser', product, frequency: 'daily', why: 'A core step.', howToUse: 'Massage gently.', cautions: ['Be careful.'] }],
    pm: [],
  },
  categories: [{ category: 'cleanser', items: [scored] }],
  excluded: [{ productId: 9, name: 'Demo Light Sunscreen SPF 15', reason: 'Its SPF is 15.' }],
  notices: [], dataNote: 'DEMO DATA: these products are fictional.', disclaimer: 'Not a medical diagnosis.',
};

describe('RoutineView', () => {
  it('labels demo data prominently and never hides it', () => {
    render(<RoutineView data={sample} />);
    expect(screen.getByRole('note')).toHaveTextContent(/DEMO DATA/);
  });
  it('shows ordered steps with how-to and cautions', () => {
    render(<RoutineView data={sample} />);
    expect(screen.getByRole('heading', { name: /1\. Cleanser: Demo Gel Cleanser/ })).toBeInTheDocument();
    expect(screen.getByText(/Massage gently/)).toBeInTheDocument();
    expect(screen.getByText('Be careful.')).toBeInTheDocument();
  });
  it('explains scores honestly and lists what was filtered out', () => {
    render(<RoutineView data={sample} />);
    expect(screen.getAllByText(/not a medical\s+measure/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Its SPF is 15\./)).toBeInTheDocument();
    expect(screen.getAllByText('Why this product?').length).toBeGreaterThan(0);
  });
});
