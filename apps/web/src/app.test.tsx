import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('app shell', () => {
  it('has a skip link, one main landmark and the medical disclaimer', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /skip to main content/i })).toBeInTheDocument();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByText(/cannot diagnose medical conditions/i)).toBeInTheDocument();
  });

  it('landing page has exactly one h1', () => {
  renderAt('/');
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
});

  it('shows a friendly page for unknown routes', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
  });
});

describe('register form', () => {
  it('announces errors when submitted empty and labels every field', async () => {
    renderAt('/register');
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(0);
  });
});
