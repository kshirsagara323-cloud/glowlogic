import { useEffect } from 'react';
import { Link, useRouteError } from 'react-router-dom';
import { usePageTitle } from '../hooks/usePageTitle';

// Shown if something crashes while rendering. Users see a friendly message; the real
// error goes to the developer console only (never shown on screen).
export function RouteError() {
  const error = useRouteError();
  usePageTitle('Something went wrong');
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container" style={{ paddingBlock: '4rem' }}>
      <h1>Something went wrong</h1>
      <p>Sorry, that page failed to load. Please try again.</p>
      <p><Link to="/">Back to home</Link></p>
    </div>
  );
}
