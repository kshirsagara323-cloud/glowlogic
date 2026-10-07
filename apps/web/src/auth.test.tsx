import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(<RouterProvider router={router} />);
}

describe('auth wiring (no Supabase keys in tests)', () => {
  it('redirects a signed-out visitor from /account to the login page', async () => {
    renderAt('/account');
    expect(await screen.findByRole('heading', { name: /log in/i, level: 1 })).toBeInTheDocument();
  });

  it('shows Log in and Sign up links when signed out', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: /^log in$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^sign up$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log out/i })).not.toBeInTheDocument();
  });

  it('validates the forgot-password email before sending', async () => {
    renderAt('/forgot-password');
    await userEvent.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/email/i);
  });

  it('explains an unconfigured app instead of crashing on sign-in', async () => {
    renderAt('/login');
    await userEvent.type(screen.getByLabelText(/email address/i), 'a@b.co');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'whatever');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();
  });
});
