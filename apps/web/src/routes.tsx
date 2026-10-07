import type { RouteObject } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './features/account/AuthProvider';
import { Account } from './pages/Account';
import { ForgotPassword } from './pages/ForgotPassword';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';
import { Register } from './pages/Register';
import { RouteError } from './pages/RouteError';
import { UpdatePassword } from './pages/UpdatePassword';

// Kept separate from main.tsx so tests can build an in-memory router from the same routes.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: (
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Landing /> },
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'update-password', element: <UpdatePassword /> },
      { path: 'privacy', element: <Privacy /> },
      { element: <ProtectedRoute />, children: [{ path: 'account', element: <Account /> }] },
      { path: '*', element: <NotFound /> },
    ],
  },
];
