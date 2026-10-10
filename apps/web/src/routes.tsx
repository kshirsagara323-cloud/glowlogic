import type { RouteObject } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './features/account/AuthProvider';
import { Account } from './pages/Account';
import { AssessmentHome } from './pages/AssessmentHome';
import { AssessmentQuiz } from './pages/AssessmentQuiz';
import { AssessmentReport } from './pages/AssessmentReport';
import { ForgotPassword } from './pages/ForgotPassword';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';
import { Register } from './pages/Register';
import { RouteError } from './pages/RouteError';
import { RoutinePage } from './pages/RoutinePage';
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
      { element: <ProtectedRoute />, children: [
        { path: 'account', element: <Account /> },
        { path: 'assessment', element: <AssessmentHome /> },
        { path: 'assessment/new', element: <AssessmentQuiz /> },
        { path: 'assessment/:id', element: <AssessmentReport /> },
        { path: 'assessment/:id/routine', element: <RoutinePage /> },
      ],
    },
      { path: '*', element: <NotFound /> },
    ],
  },
];
