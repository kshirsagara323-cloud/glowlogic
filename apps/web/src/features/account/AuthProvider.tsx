import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isAuthConfigured } from '../../lib/supabase';
import { AuthContext } from './authContext';
import type { AuthContextValue, AuthStatus } from './authContext';
import { POLICY_VERSION } from './policy';

const NOT_CONFIGURED = 'Accounts are not available right now (the app is not configured).';

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isAuthConfigured();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>(configured ? 'loading' : 'signedOut');

  useEffect(() => {
    if (!configured) return;
    const supabase = getSupabase();
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });
    return () => data.subscription.unsubscribe();
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      configured,
      async signUp(email, password) {
        if (!configured) return { error: NOT_CONFIGURED };
        const { data, error } = await getSupabase().auth.signUp({
          email,
          password,
          // Stored with the account so the server can record what was accepted at sign-up.
          options: { data: { accepted_policy_version: POLICY_VERSION, confirmed_adult: true } },
        });
        if (error) return { error: error.message };
        return { needsConfirmation: !data.session };
      },
      async signIn(email, password) {
        if (!configured) return { error: NOT_CONFIGURED };
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        // Same message for "wrong password" and "no such user", so accounts can't be probed.
        return error ? { error: 'Incorrect email or password.' } : {};
      },
      async signOut() {
        if (configured) await getSupabase().auth.signOut();
      },
      async requestPasswordReset(email) {
        if (!configured) return { error: NOT_CONFIGURED };
        await getSupabase().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        return {}; // always the same result, whether or not the email has an account
      },
      async updatePassword(password) {
        if (!configured) return { error: NOT_CONFIGURED };
        const { error } = await getSupabase().auth.updateUser({ password });
        return error ? { error: error.message } : {};
      },
    }),
    [status, session, configured],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
