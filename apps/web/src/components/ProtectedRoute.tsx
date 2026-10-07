import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/account/useAuth';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <p role="status">Loading&hellip;</p>;
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
