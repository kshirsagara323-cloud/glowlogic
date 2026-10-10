import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('assessment routes are protected', () => {
  it.each(['/assessment', '/assessment/new', '/assessment/abc'])('redirects signed-out visitors from %s to login', async (path) => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
    expect(await screen.findByRole('heading', { name: /log in/i, level: 1 })).toBeInTheDocument();
  });
});
