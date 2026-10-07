import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { CheckField, Field } from '../components/Field';
import { useAuth } from '../features/account/useAuth';
import { validateRegister } from '../features/account/validation';
import type { RegisterErrors } from '../features/account/validation';
import { usePageTitle } from '../hooks/usePageTitle';

export function Register() {
  usePageTitle('Create your account');
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmedAdult, setConfirmedAdult] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found = validateRegister({ email, password, confirmPassword, confirmedAdult, acceptedPolicies });
    setErrors(found);
    setStatus('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    const result = await signUp(email.trim(), password);
    setBusy(false);
    if (result.error) setStatus(result.error);
    else if (result.needsConfirmation) setStatus('Check your email for a confirmation link, then log in.');
    else navigate('/account');
  }

  return (
    <div className="card form-card">
      <h1>Create your account</h1>
      <form onSubmit={(e) => void onSubmit(e)} noValidate>
        <Field id="reg-email" label="Email address" type="email" autoComplete="email"
          value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field id="reg-password" label="Password" type="password" autoComplete="new-password"
          hint="At least 10 characters. A long phrase works well."
          value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Field id="reg-confirm" label="Confirm password" type="password" autoComplete="new-password"
          value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} error={errors.confirmPassword} />
        <CheckField id="reg-adult" label="I am 18 or older"
          checked={confirmedAdult} onChange={(e) => setConfirmedAdult(e.target.checked)} error={errors.confirmedAdult} />
        <CheckField id="reg-policies" label="I have read the privacy notice and agree to the terms"
          checked={acceptedPolicies} onChange={(e) => setAcceptedPolicies(e.target.checked)} error={errors.acceptedPolicies} />
        <Button type="submit" disabled={busy}>{busy ? 'Creating account\u2026' : 'Create account'}</Button>
      </form>
      <p className="status" role="status">{status}</p>
      <p>Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
