import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/account/useAuth';
import { Disclaimer } from './Disclaimer';

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status, signOut } = useAuth();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // After client-side navigation, move focus to <main> so keyboard and screen-reader users
  // start at the new page instead of staying on the old link.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    mainRef.current?.focus();
  }, [pathname]);

  async function onSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="site-header">
        <div className="container">
          <Link to="/" className="brand">GlowLogic</Link>
          <nav className="site-nav" aria-label="Main">
            <ul>
              <li><NavLink to="/" end>Home</NavLink></li>
              <li><NavLink to="/privacy">Privacy</NavLink></li>
              {status === 'signedIn' ? (
                <>
                  <li><NavLink to="/assessment">Assessment</NavLink></li>
                  <li><NavLink to="/account">Account</NavLink></li>
                  <li><button type="button" className="nav-button" onClick={() => void onSignOut()}>Log out</button></li>
                </>
              ) : (
                <>
                  <li><NavLink to="/login">Log in</NavLink></li>
                  <li><NavLink to="/register">Sign up</NavLink></li>
                </>
              )}
            </ul>
          </nav>
        </div>
      </header>
      <main id="main-content" ref={mainRef} tabIndex={-1}>
        <div className="container">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer">
        <div className="container">
          <Disclaimer />
          <p>GlowLogic is an in-development portfolio project.</p>
        </div>
      </footer>
    </>
  );
}
