import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function isAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}

/** Created lazily so the app (and tests) still load when the keys are missing. */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!isAuthConfigured()) throw new Error('Supabase is not configured');
  client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return client;
}
