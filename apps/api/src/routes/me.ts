import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError, log } from '../errors.js';
import { currentUser } from '../middleware/requireAuth.js';

const ageGroups = ['18_24', '25_34', '35_44', '45_54', '55_plus'] as const;
const climates = ['hot_humid', 'hot_dry', 'temperate', 'cold', 'varies'] as const;
const sunExposures = ['mostly_indoors', 'mixed', 'mostly_outdoors'] as const;
const fragrancePrefs = ['no_preference', 'prefer_fragrance_free', 'avoid_fragrance'] as const;
const complexities = ['minimal', 'beginner', 'moderate', 'advanced'] as const;
const coverages = ['sheer', 'light', 'medium', 'full'] as const;
const finishes = ['matte', 'natural', 'satin', 'dewy', 'radiant'] as const;

// Mirrors the CHECK constraints in the database. Unknown fields are rejected.
export const profileSchema = z
  .object({
    ageGroup: z.enum(ageGroups).nullable().optional(),
    climate: z.enum(climates).nullable().optional(),
    sunExposure: z.enum(sunExposures).nullable().optional(),
    budgetTier: z.number().int().min(1).max(4).nullable().optional(),
    regionCountry: z.string().regex(/^[A-Z]{2}$/).optional(),
    fragrancePreference: z.enum(fragrancePrefs).optional(),
    routineComplexity: z.enum(complexities).optional(),
    coveragePreference: z.enum(coverages).nullable().optional(),
    finishPreference: z.enum(finishes).nullable().optional(),
  })
  .strict();

// Fixed whitelist: column names in SQL come from here, never from user input.
const COLUMNS = {
  ageGroup: 'age_group',
  climate: 'climate',
  sunExposure: 'sun_exposure',
  budgetTier: 'budget_tier',
  regionCountry: 'region_country',
  fragrancePreference: 'fragrance_preference',
  routineComplexity: 'routine_complexity',
  coveragePreference: 'coverage_preference',
  finishPreference: 'finish_preference',
} as const;

const consentSchema = z
  .object({
    purpose: z.enum(['terms', 'privacy_policy', 'photo_processing', 'photo_storage', 'analytics']),
    granted: z.boolean(),
    policyVersion: z.string().regex(/^[a-z0-9-]{1,40}$/),
  })
  .strict();

const deleteSchema = z.object({ confirm: z.literal('DELETE') }).strict();

type ProfileRow = {
  age_group: string | null;
  climate: string | null;
  sun_exposure: string | null;
  budget_tier: number | null;
  region_country: string;
  fragrance_preference: string;
  routine_complexity: string;
  coverage_preference: string | null;
  finish_preference: string | null;
};

function toProfile(row: ProfileRow | undefined) {
  if (!row) return null;
  return {
    ageGroup: row.age_group,
    climate: row.climate,
    sunExposure: row.sun_exposure,
    budgetTier: row.budget_tier,
    regionCountry: row.region_country,
    fragrancePreference: row.fragrance_preference,
    routineComplexity: row.routine_complexity,
    coveragePreference: row.coverage_preference,
    finishPreference: row.finish_preference,
  };
}

export interface MeDeps {
  pool: Pool;
  deleteAuthUser: (userId: string) => Promise<void>;
}

export function meRouter({ pool, deleteAuthUser }: MeDeps): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const { id } = currentUser(req);
    const user = await pool.query('SELECT id, email, display_name, created_at FROM app_user WHERE id = $1', [id]);
    const profile = await pool.query('SELECT * FROM user_profile WHERE user_id = $1', [id]);
    const row = user.rows[0] as { id: string; email: string; display_name: string | null; created_at: Date };
    res.json({
      user: { id: row.id, email: row.email, displayName: row.display_name, createdAt: row.created_at },
      profile: toProfile(profile.rows[0] as ProfileRow | undefined),
    });
  });

  router.patch('/profile', async (req, res) => {
    const { id } = currentUser(req);
    const parsed = profileSchema.parse(req.body);
    const entries = (Object.entries(parsed) as [keyof typeof COLUMNS, unknown][]).filter(([, v]) => v !== undefined);

    if (entries.length === 0) {
      const current = await pool.query('SELECT * FROM user_profile WHERE user_id = $1', [id]);
      res.json({ profile: toProfile(current.rows[0] as ProfileRow | undefined) });
      return;
    }
    const columns = entries.map(([key]) => COLUMNS[key]);
    const values = entries.map(([, value]) => value);
    const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ');
    const updates = columns.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
    const saved = await pool.query(
      `INSERT INTO user_profile (user_id, ${columns.join(', ')}) VALUES ($1, ${placeholders})
       ON CONFLICT (user_id) DO UPDATE SET ${updates} RETURNING *`,
      [id, ...values],
    );
    res.json({ profile: toProfile(saved.rows[0] as ProfileRow) });
  });

  router.post('/consents', async (req, res) => {
    const { id } = currentUser(req);
    const body = consentSchema.parse(req.body);
    await pool.query(
      'INSERT INTO consent_ledger (user_id, purpose, granted, policy_version) VALUES ($1, $2, $3, $4)',
      [id, body.purpose, body.granted, body.policyVersion],
    );
    res.status(201).json({ ok: true });
  });

  // Data export. This grows as later phases add more user-owned tables.
  router.get('/export', async (req, res) => {
    const { id } = currentUser(req);
    const [user, profile, restrictions, consents] = await Promise.all([
      pool.query('SELECT id, email, display_name, created_at, last_login_at FROM app_user WHERE id = $1', [id]),
      pool.query('SELECT * FROM user_profile WHERE user_id = $1', [id]),
      pool.query('SELECT * FROM user_restriction WHERE user_id = $1', [id]),
      pool.query(
        'SELECT purpose, granted, policy_version, created_at FROM consent_ledger WHERE user_id = $1 ORDER BY created_at',
        [id],
      ),
    ]);
    res.set('Content-Disposition', 'attachment; filename="glowlogic-data.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      user: user.rows[0] ?? null,
      profile: profile.rows[0] ?? null,
      restrictions: restrictions.rows,
      consents: consents.rows,
    });
  });

  router.delete('/', async (req, res) => {
    const { id } = currentUser(req);
    deleteSchema.parse(req.body);

    // TODO(Phase 9): delete this user's stored photo files from storage BEFORE the database rows.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO deleted_account (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
      await client.query('DELETE FROM app_user WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    try {
      await deleteAuthUser(id);
    } catch (error) {
      log('error', 'Could not delete auth user after data deletion', {
        userId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new AppError(
        502,
        'auth_cleanup_failed',
        'Your data was deleted, but we could not remove your login. Please contact support.',
      );
    }
    res.status(204).end();
  });

  return router;
}
