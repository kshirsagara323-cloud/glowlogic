import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field } from '../components/Field';
import { usePageTitle } from '../hooks/usePageTitle';
import { validateLogin } from '../features/account/validation';

export function Login() {
  usePageTitle('Log in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'email' | 'password', string>>>({});
  const [status, setStatus] = useState('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateLogin(email, password);
    setErrors(found);
    setStatus(Object.keys(found).length === 0 ? 'Logging in is built in the next phase, so nothing was sent anywhere.' : '');
  }

  return (
    <div className="card form-card">
      <h1>Log in</h1>
      <form onSubmit={onSubmit} noValidate>
        <Field id="login-email" label="Email address" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field id="login-password" label="Password" type="password" autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit">Log in</Button>
      </form>
      <p className="status" role="status">{status}</p>
      <p>New here? <Link to="/register">Create an account</Link></p>
    </div>
  );
}
