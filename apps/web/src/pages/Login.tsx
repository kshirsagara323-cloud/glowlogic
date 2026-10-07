import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../features/account/useAuth';
import { validateLogin } from '../features/account/validation';
import { usePageTitle } from '../hooks/usePageTitle';

export function Login() {
  usePageTitle('Log in');
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateLogin(email, password);
    setErrors(found);
    setStatus('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = await signIn(email.trim(), password);
    setBusy(false);
    if (result.error) setStatus(result.error);
    else navigate(from, { replace: true });
  }

  return (
    <div className="card form-card">
      <h1>Log in</h1>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field id="login-email" label="Email address" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" disabled={busy}>{busy ? 'Logging in\u2026' : 'Log in'}</Button>
      </form>
      <p className="status" role="status">{status}</p>
      <p><Link to="/forgot-password">Forgot your password?</Link></p>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}
