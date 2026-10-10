// Integration tests against the real local Postgres, with a fake login verifier.
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { TokenVerifier } from './auth/verifyToken.js';
import { loadConfig } from './config.js';
import { loadDotEnv } from './env.js';

loadDotEnv();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Create the repo-root .env first.');

const A = '00000000-0000-4000-8000-0000000000c1';
const B = '00000000-0000-4000-8000-0000000000d1';
const config = loadConfig({
  ...process.env, NODE_ENV: 'test', SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test', SUPABASE_SECRET_KEY: 'test',
});
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const verifyToken: TokenVerifier = async (token) =>
  token === 'token-a' ? { id: A, email: 'c@example.invalid' }
  : token === 'token-b' ? { id: B, email: 'd@example.invalid' }
  : null;
const app = createApp({ config, pool, verifyToken, deleteAuthUser: async () => {} });
const asA = (r: request.Test) => r.set('Authorization', 'Bearer token-a');
const asB = (r: request.Test) => r.set('Authorization', 'Bearer token-b');

const valid = {
  answers: { shine_midday: 'all_over', after_cleanse: 'oily_soon', skin_depth: 'd5', undertone_veins: 'green' },
  priorities: ['oiliness', 'acne'],
};

async function clean() {
  await pool.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [[A, B]]);
}
beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool.end();
});

describe('quiz definition', () => {
  it('is public and never exposes scoring signals', async () => {
    const res = await request(app).get('/api/v1/quiz');
    expect(res.status).toBe(200);
    expect(res.body.questions.length).toBeGreaterThan(20);
    expect(JSON.stringify(res.body)).not.toContain('signals');
  });
});

describe('creating an assessment', () => {
  it('requires login', async () => {
    expect((await request(app).post('/api/v1/assessments').send(valid)).status).toBe(401);
  });
  it('scores, stores and returns the result', async () => {
    const res = await asA(request(app).post('/api/v1/assessments')).send(valid);
    expect(res.status).toBe(201);
    expect(res.body.result.skinType.primary).toBe('oily');
    expect(res.body.effectiveTraits.find((t: { code: string }) => t.code === 'oiliness').score).toBe(100);
    expect(res.body.effectiveTone).toMatchObject({ depthBin: 5, undertone: 'warm' });
    expect(res.body.priorities).toEqual(['oiliness', 'acne']);
  });
  it('rejects invalid answers and priorities', async () => {
    const send = (body: unknown) => asA(request(app).post('/api/v1/assessments')).send(body as object);
    expect((await send({ answers: { shine_midday: 'sparkly' }, priorities: ['acne'] })).status).toBe(400);
    expect((await send({ answers: {}, priorities: [] })).status).toBe(400);
    expect((await send({ answers: {}, priorities: ['acne', 'acne'] })).status).toBe(400);
    expect((await send({ answers: {}, priorities: ['acne'], extra: 1 })).status).toBe(400);
  });
  it('accepts a minimal assessment with no scored answers', async () => {
    const res = await asA(request(app).post('/api/v1/assessments')).send({ answers: {}, priorities: ['acne'] });
    expect(res.status).toBe(201);
    expect(res.body.result.traits).toEqual([]);
  });
});

describe('privacy between users', () => {
  it('hides, protects and refuses other users\' assessments', async () => {
    const created = await asA(request(app).post('/api/v1/assessments')).send(valid);
    const id = created.body.id as string;
    expect((await asB(request(app).get(`/api/v1/assessments/${id}`))).status).toBe(404);
    expect((await asB(request(app).patch(`/api/v1/assessments/${id}/overrides`)).send({ traits: { oiliness: 'low' } })).status).toBe(404);
    expect((await asB(request(app).delete(`/api/v1/assessments/${id}`))).status).toBe(404);
    const list = await asB(request(app).get('/api/v1/assessments'));
    expect(list.body.assessments).toEqual([]);
    expect((await asA(request(app).get('/api/v1/assessments/not-a-uuid'))).status).toBe(404);
  });
});

describe('user overrides', () => {
  it('lets the user correct a trait and the tone, and undo it', async () => {
    const id = (await asA(request(app).post('/api/v1/assessments')).send(valid)).body.id as string;
    const patch = (body: object) => asA(request(app).patch(`/api/v1/assessments/${id}/overrides`)).send(body);

    const changed = await patch({ traits: { oiliness: 'low' }, tone: { depthBin: 8, undertone: 'cool' } });
    expect(changed.status).toBe(200);
    const oil = changed.body.effectiveTraits.find((t: { code: string }) => t.code === 'oiliness');
    expect(oil).toMatchObject({ category: 'low', source: 'user_override' });
    expect(changed.body.effectiveTone).toMatchObject({ depthBin: 8, undertone: 'cool', source: 'user_override' });
    expect(changed.body.result.traits.find((t: { code: string }) => t.code === 'oiliness').score).toBe(100); // original kept

    const undone = await patch({ traits: { oiliness: null }, tone: { depthBin: null, undertone: null } });
    expect(undone.body.effectiveTraits.find((t: { code: string }) => t.code === 'oiliness').source).toBe('quiz');
    expect(undone.body.effectiveTone.source).toBe('quiz');
  });
  it('rejects unknown traits and bad values', async () => {
    const id = (await asA(request(app).post('/api/v1/assessments')).send(valid)).body.id as string;
    const patch = (body: object) => asA(request(app).patch(`/api/v1/assessments/${id}/overrides`)).send(body);
    expect((await patch({ traits: { lava: 'low' } })).status).toBe(400);
    expect((await patch({ traits: { oiliness: 'extreme' } })).status).toBe(400);
    expect((await patch({ tone: { depthBin: 11, undertone: 'warm' } })).status).toBe(400);
  });
});

describe('deleting', () => {
  it('deletes one assessment and removes it with the account', async () => {
    const id = (await asA(request(app).post('/api/v1/assessments')).send(valid)).body.id as string;
    expect((await asA(request(app).delete(`/api/v1/assessments/${id}`))).status).toBe(204);
    expect((await asA(request(app).get(`/api/v1/assessments/${id}`))).status).toBe(404);
    const left = await pool.query('SELECT 1 FROM skin_profile_trait t JOIN skin_assessment a ON a.id = t.assessment_id WHERE a.user_id = $1', [A]);
    expect(left.rowCount).toBe(0);
  });
});
