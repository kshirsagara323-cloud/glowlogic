import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './routes';

describe('routine page', () => {
  it('is protected: signed-out visitors are sent to log in', async () => {
    render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/assessment/abc/routine'] })} />);
    expect(await screen.findByRole('heading', { name: /log in/i, level: 1 })).toBeInTheDocument();
  });
});
