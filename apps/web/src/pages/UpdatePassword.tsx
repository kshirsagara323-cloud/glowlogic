import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { useAuth } from '../features/account/useAuth';
import { PASSWORD_MIN_LENGTH } from '../features/account/validation';
import { usePageTitle } from '../hooks/usePageTitle';

export function UpdatePassword() {
  usePageTitle('Choose a new password');
  const { status: authStatus, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
    if (password !== confirm) return setError('Passwords do not match.');
    setError(undefined);
    const result = await updatePassword(password);
    if (result.error) setStatus(result.error);
    else navigate('/account');
  }

  if (authStatus === 'loading') return <p role="status">Loading&hellip;</p>;
  if (authStatus === 'signedOut') {
    return (
      <div className="card form-card">
        <h1>Choose a new password</h1>
        <p>This page works from the link in your reset email. That link may have expired.</p>
        <p><Link to="/forgot-password">Request a new link</Link></p>
      </div>
    );
  }
  return (
    <div className="card form-card">
      <h1>Choose a new password</h1>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field id="new-password" label="New password" type="password" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Field id="new-password-confirm" label="Confirm new password" type="password" autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <Button type="submit">Save new password</Button>
      </form>
      <p className="status" role="status">{status}</p>
    </div>
  );
}
