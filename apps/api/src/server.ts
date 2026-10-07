import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { createApp } from './app.js';
import { createSupabaseVerifier } from './auth/verifyToken.js';
import { loadConfig } from './config.js';
import { loadDotEnv } from './env.js';
import { log } from './errors.js';

loadDotEnv();
const config = loadConfig();

const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 5,
  // TODO(Phase 16): replace rejectUnauthorized:false with the provider's CA certificate.
  ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

// The secret key lives only here, on the server.
const supabaseAdmin = createClient(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = createApp({
  config,
  pool,
  verifyToken: createSupabaseVerifier(config.SUPABASE_URL, config.SUPABASE_PUBLISHABLE_KEY),
  deleteAuthUser: async (userId) => {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
  },
});

const server = app.listen(config.PORT, () => {
  log('info', `GlowLogic API listening on port ${config.PORT}`, {});
});

function shutdown(): void {
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
