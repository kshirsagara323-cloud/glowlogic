import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

export interface AuthResult {
  error?: string;
  needsConfirmation?: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  configured: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
