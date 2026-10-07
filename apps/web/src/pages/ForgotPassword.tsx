import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../features/account/useAuth';
import { validateLogin } from '../features/account/validation';
import { usePageTitle } from '../hooks/usePageTitle';

export function ForgotPassword() {
  usePageTitle('Reset your password');
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    const found = validateLogin(email, 'x').email;
    setError(found);
    if (found) return;
    setBusy(true);
    const result = await requestPasswordReset(email.trim());
    setBusy(false);
    setStatus(result.error ?? 'If an account exists for that email, a reset link is on its way.');
  }

  return (
    <div className="card form-card">
      <h1>Reset your password</h1>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field id="forgot-email" label="Email address" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <Button type="submit" disabled={busy}>Send reset link</Button>
      </form>
      <p className="status" role="status">{status}</p>
      <p><Link to="/login">Back to log in</Link></p>
    </div>
  );
}
