import type { Pool } from 'pg';
import type { AuthUser } from '../auth/verifyToken.js';
import { AppError } from '../errors.js';

/**
 * Creates the app_user row the first time a logged-in person calls the API, and records
 * the consents they ticked at sign-up. Refuses deleted or disabled accounts.
 */
export async function provisionUser(pool: Pool, user: AuthUser): Promise<void> {
  const tombstone = await pool.query('SELECT 1 FROM deleted_account WHERE user_id = $1', [user.id]);
  if (tombstone.rowCount) throw new AppError(401, 'unauthorized', 'Please log in.');

  // Only write when something changed or the last login is over an hour old (avoids a write per request).
  await pool.query(
    `INSERT INTO app_user (id, email, last_login_at) VALUES ($1, $2, now())
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, last_login_at = now()
     WHERE app_user.email <> EXCLUDED.email
        OR app_user.last_login_at IS NULL
        OR app_user.last_login_at < now() - interval '1 hour'`,
    [user.id, user.email],
  );

  const state = await pool.query(
    `SELECT u.disabled_at,
            EXISTS (SELECT 1 FROM consent_ledger c WHERE c.user_id = u.id AND c.purpose = 'terms') AS has_terms
     FROM app_user u WHERE u.id = $1`,
    [user.id],
  );
  const row = state.rows[0] as { disabled_at: Date | null; has_terms: boolean } | undefined;
  if (!row) throw new AppError(500, 'server_error', 'Something went wrong. Please try again.');
  if (row.disabled_at) throw new AppError(403, 'account_disabled', 'This account is disabled.');

  if (!row.has_terms && user.policyVersion) {
    await pool.query(
      `INSERT INTO consent_ledger (user_id, purpose, granted, policy_version)
       VALUES ($1, 'terms', true, $2), ($1, 'privacy_policy', true, $2)`,
      [user.id, user.policyVersion],
    );
  }
}
