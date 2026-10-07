// Integration tests: they talk to the REAL local Postgres (docker) but use a fake login verifier.
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import type { TokenVerifier } from './auth/verifyToken.js';
import { loadConfig } from './config.js';
import { loadDotEnv } from './env.js';

loadDotEnv();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Create the repo-root .env first.');

const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b1';
const ids = [A, B];

const config = loadConfig({
  ...process.env,
  NODE_ENV: 'test',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test',
  SUPABASE_SECRET_KEY: 'test',
});
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });

const verifyToken: TokenVerifier = async (token) => {
  if (token === 'token-a') return { id: A, email: 'a@example.invalid', policyVersion: 'draft-test' };
  if (token === 'token-b') return { id: B, email: 'b@example.invalid', policyVersion: 'draft-test' };
  return null;
};
const deleteAuthUser = vi.fn(async (_id: string) => {});
const app = createApp({ config, pool, verifyToken, deleteAuthUser });

async function clean() {
  await pool.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [ids]);
  await pool.query('DELETE FROM deleted_account WHERE user_id = ANY($1::uuid[])', [ids]);
}
const asA = (r: request.Test) => r.set('Authorization', 'Bearer token-a');
const asB = (r: request.Test) => r.set('Authorization', 'Bearer token-b');

beforeEach(async () => {
  deleteAuthUser.mockClear();
  await clean();
});
afterAll(async () => {
  await clean();
  await pool.end();
});

describe('health', () => {
  it('reports ok and leaks no secrets', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'up' });
    expect(JSON.stringify(res.body)).not.toContain('postgresql://');
  });
});

describe('authentication', () => {
  it('rejects requests without a token', async () => {
    expect((await request(app).get('/api/v1/me')).status).toBe(401);
  });
  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer nope');
    expect(res.status).toBe(401);
  });
  it('creates the user and records sign-up consents on first call', async () => {
    const res = await asA(request(app).get('/api/v1/me'));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@example.invalid');
    expect(res.body.profile).toBeNull();
    const consents = await pool.query('SELECT purpose FROM consent_ledger WHERE user_id = $1 ORDER BY purpose', [A]);
    expect(consents.rows.map((r: { purpose: string }) => r.purpose)).toEqual(['privacy_policy', 'terms']);
  });
});

describe('profile', () => {
  it('saves and returns profile values', async () => {
    const saved = await asA(request(app).patch('/api/v1/me/profile')).send({ climate: 'cold', budgetTier: 2 });
    expect(saved.status).toBe(200);
    expect(saved.body.profile).toMatchObject({ climate: 'cold', budgetTier: 2, routineComplexity: 'beginner' });
    const again = await asA(request(app).get('/api/v1/me'));
    expect(again.body.profile.climate).toBe('cold');
  });
  it('rejects invalid values and unknown fields', async () => {
    expect((await asA(request(app).patch('/api/v1/me/profile')).send({ climate: 'lava' })).status).toBe(400);
    expect((await asA(request(app).patch('/api/v1/me/profile')).send({ isAdmin: true })).status).toBe(400);
    expect((await asA(request(app).patch('/api/v1/me/profile')).send({ budgetTier: 9 })).status).toBe(400);
  });
  it("never shows one user another user's data", async () => {
    await asA(request(app).patch('/api/v1/me/profile')).send({ climate: 'cold' });
    const b = await asB(request(app).get('/api/v1/me'));
    expect(b.body.profile).toBeNull();
    expect(JSON.stringify(b.body)).not.toContain('a@example.invalid');
  });
  it('rejects oversized bodies', async () => {
    const res = await asA(request(app).patch('/api/v1/me/profile')).send({ regionCountry: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
  });
});

describe('consents and export', () => {
  it('validates and stores consent changes', async () => {
    const bad = await asA(request(app).post('/api/v1/me/consents')).send({ purpose: 'selling_data', granted: true, policyVersion: 'v1' });
    expect(bad.status).toBe(400);
    const ok = await asA(request(app).post('/api/v1/me/consents')).send({ purpose: 'analytics', granted: false, policyVersion: 'draft-test' });
    expect(ok.status).toBe(201);
  });
  it('exports only the caller\'s data', async () => {
    await asA(request(app).patch('/api/v1/me/profile')).send({ climate: 'hot_dry' });
    const res = await asA(request(app).get('/api/v1/me/export'));
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('a@example.invalid');
    expect(res.body.profile.climate).toBe('hot_dry');
    expect(res.body.consents.length).toBe(2);
  });
});

describe('account deletion', () => {
  it('requires explicit confirmation', async () => {
    await asA(request(app).get('/api/v1/me'));
    expect((await asA(request(app).delete('/api/v1/me')).send({})).status).toBe(400);
  });
  it('removes data, removes the login, and blocks the old token', async () => {
    await asA(request(app).patch('/api/v1/me/profile')).send({ climate: 'cold' });
    const res = await asA(request(app).delete('/api/v1/me')).send({ confirm: 'DELETE' });
    expect(res.status).toBe(204);
    expect(deleteAuthUser).toHaveBeenCalledWith(A);
    const left = await pool.query('SELECT 1 FROM app_user WHERE id = $1', [A]);
    expect(left.rowCount).toBe(0);
    const again = await asA(request(app).get('/api/v1/me'));
    expect(again.status).toBe(401);
    const stillGone = await pool.query('SELECT 1 FROM app_user WHERE id = $1', [A]);
    expect(stillGone.rowCount).toBe(0);
  });
});
