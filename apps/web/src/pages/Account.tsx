import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field, SelectField } from '../components/Field';
import { deleteAccount, exportData, getMe, saveProfile } from '../features/account/accountApi';
import type { Profile } from '../features/account/accountApi';
import { useAuth } from '../features/account/useAuth';
import { usePageTitle } from '../hooks/usePageTitle';

interface FormState {
  ageGroup: string;
  climate: string;
  sunExposure: string;
  budgetTier: string;
  fragrancePreference: string;
  routineComplexity: string;
}

const EMPTY: FormState = {
  ageGroup: '', climate: '', sunExposure: '', budgetTier: '',
  fragrancePreference: 'no_preference', routineComplexity: 'beginner',
};

function toForm(p: Profile | null): FormState {
  if (!p) return EMPTY;
  return {
    ageGroup: p.ageGroup ?? '',
    climate: p.climate ?? '',
    sunExposure: p.sunExposure ?? '',
    budgetTier: p.budgetTier ? String(p.budgetTier) : '',
    fragrancePreference: p.fragrancePreference,
    routineComplexity: p.routineComplexity,
  };
}

const AGE = [['18_24', '18\u201324'], ['25_34', '25\u201334'], ['35_44', '35\u201344'], ['45_54', '45\u201354'], ['55_plus', '55 or older']];
const CLIMATE = [['hot_humid', 'Hot and humid'], ['hot_dry', 'Hot and dry'], ['temperate', 'Temperate'], ['cold', 'Cold'], ['varies', 'It varies']];
const SUN = [['mostly_indoors', 'Mostly indoors'], ['mixed', 'A mix of both'], ['mostly_outdoors', 'Mostly outdoors']];
const BUDGET = [['1', 'Budget-friendly'], ['2', 'Mid-range'], ['3', 'Higher-end'], ['4', 'Luxury']];
const FRAGRANCE = [['no_preference', 'No preference'], ['prefer_fragrance_free', 'Prefer fragrance-free'], ['avoid_fragrance', 'Avoid fragrance']];
const COMPLEXITY = [['minimal', 'Minimal (1\u20133 steps)'], ['beginner', 'Beginner'], ['moderate', 'Moderate'], ['advanced', 'Advanced']];
const opts = (pairs: string[][]) => pairs.map(([value, label]) => ({ value, label }));

export function Account() {
  usePageTitle('Your account');
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [email, setEmail] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY);
  const [status, setStatus] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((me) => {
        if (cancelled) return;
        setEmail(me.user.email);
        setForm(toForm(me.profile));
        setLoad('ready');
      })
      .catch(() => {
        if (!cancelled) setLoad('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');
    try {
      await saveProfile({
        ageGroup: form.ageGroup || null,
        climate: form.climate || null,
        sunExposure: form.sunExposure || null,
        budgetTier: form.budgetTier ? Number(form.budgetTier) : null,
        fragrancePreference: form.fragrancePreference,
        routineComplexity: form.routineComplexity,
      });
      setStatus('Saved.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save. Please try again.');
    }
  }

  async function onExport() {
    setStatus('');
    try {
      const data = await exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'glowlogic-data.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not export your data.');
    }
  }

  async function onDelete() {
    setDeleting(true);
    setStatus('');
    try {
      await deleteAccount();
      await signOut();
      navigate('/');
    } catch (error) {
      setDeleting(false);
      setStatus(error instanceof Error ? error.message : 'Could not delete your account.');
    }
  }

  if (load === 'loading') return <p role="status">Loading your account&hellip;</p>;
  if (load === 'error') return <p role="alert">We couldn&rsquo;t load your account. Please refresh and try again.</p>;

  return (
    <div className="stack">
      <h1>Your account</h1>
      <p className="muted">Signed in as {email}</p>

      <form className="card" onSubmit={(e) => void onSave(e)}>
        <h2>About you</h2>
        <p className="hint">All optional. This helps tailor guidance later. You can change it any time.</p>
        <SelectField id="p-age" label="Age group" options={opts(AGE)} value={form.ageGroup} onChange={set('ageGroup')} />
        <SelectField id="p-climate" label="Climate where you live" options={opts(CLIMATE)} value={form.climate} onChange={set('climate')} />
        <SelectField id="p-sun" label="Time spent outdoors" options={opts(SUN)} value={form.sunExposure} onChange={set('sunExposure')} />
        <SelectField id="p-budget" label="Budget" options={opts(BUDGET)} value={form.budgetTier} onChange={set('budgetTier')} />
        <SelectField id="p-fragrance" label="Fragrance" placeholder="Choose" options={opts(FRAGRANCE)} value={form.fragrancePreference} onChange={set('fragrancePreference')} />
        <SelectField id="p-routine" label="Routine size" placeholder="Choose" options={opts(COMPLEXITY)} value={form.routineComplexity} onChange={set('routineComplexity')} />
        <Button type="submit">Save</Button>
      </form>

      <section className="card" aria-labelledby="data-title">
        <h2 id="data-title">Your data</h2>
        <p>Download a copy of everything GlowLogic stores about you.</p>
        <Button variant="secondary" onClick={() => void onExport()}>Download my data</Button>
      </section>

      <section className="danger-zone" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete account</h2>
        <p>This permanently deletes your account and all your data. It cannot be undone.</p>
        <Field id="delete-confirm" label="Type DELETE to confirm" value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        <Button variant="secondary" className="btn-danger" disabled={confirmText !== 'DELETE' || deleting}
          onClick={() => void onDelete()}>
          {deleting ? 'Deleting\u2026' : 'Delete my account'}
        </Button>
      </section>

      <p className="status" role="status">{status}</p>
    </div>
  );
}
