// Integration tests: real local Postgres (with seeds applied) and a fake login verifier.
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { TokenVerifier } from './auth/verifyToken.js';
import { loadConfig } from './config.js';
import { loadDotEnv } from './env.js';

loadDotEnv();
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is missing. Create the repo-root .env first.');

const A = '00000000-0000-4000-8000-0000000000e1';
const B = '00000000-0000-4000-8000-0000000000f1';
const config = loadConfig({
  ...process.env, NODE_ENV: 'test', SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'test', SUPABASE_SECRET_KEY: 'test',
});
const pool = new pg.Pool({ connectionString: config.DATABASE_URL });
const verifyToken: TokenVerifier = async (token) =>
  token === 'token-a' ? { id: A, email: 'e@example.invalid' } : token === 'token-b' ? { id: B, email: 'f@example.invalid' } : null;
const app = createApp({ config, pool, verifyToken, deleteAuthUser: async () => {} });
const asA = (r: request.Test) => r.set('Authorization', 'Bearer token-a');
const asB = (r: request.Test) => r.set('Authorization', 'Bearer token-b');

const sensitiveOily = {
  answers: {
    shine_midday: 'all_over', after_cleanse: 'oily_soon', flaking: 'never', oily_but_tight: 'often',
    product_sting: 'often', flushing: 'sometimes', lasting_redness: 'mild', fragrance_reaction: 'yes', pregnancy: 'no',
  },
  priorities: ['oiliness', 'dehydration'],
};
const fineLines = (pregnancy: string) => ({ answers: { fine_lines: 'at_rest', pregnancy }, priorities: ['fine_lines'] });

async function assess(body: object): Promise<string> {
  const res = await asA(request(app).post('/api/v1/assessments')).send(body);
  expect(res.status).toBe(201);
  return res.body.id as string;
}
const recs = (id: string, body: object = {}) => asA(request(app).post(`/api/v1/assessments/${id}/recommendations`)).send(body);
type Item = { product: { slug: string; name: string }; reasons: unknown[]; warnings: string[] };
const items = (out: { categories: { category: string; items: Item[] }[] }) => out.categories.flatMap((c) => c.items);

async function clean() {
  await pool.query('DELETE FROM app_user WHERE id = ANY($1::uuid[])', [[A, B]]);
}
beforeAll(async () => {
  const demo = await pool.query("SELECT count(*)::int AS n FROM product WHERE slug LIKE 'demo-%'");
  if ((demo.rows[0] as { n: number }).n < 15) throw new Error('Demo products are missing. Run: npm run db:seed (from the repo root)');
});
beforeEach(clean);
afterAll(async () => {
  await clean();
  await pool.end();
});

describe('generating recommendations', () => {
  it('requires login and an assessment you own', async () => {
    expect((await request(app).post('/api/v1/assessments/abc/recommendations')).status).toBe(401);
    const id = await assess(sensitiveOily);
    expect((await asB(request(app).post(`/api/v1/assessments/${id}/recommendations`)).send({})).status).toBe(404);
    expect((await asB(request(app).get(`/api/v1/assessments/${id}/recommendations/latest`))).status).toBe(404);
  });

  it('builds a routine with explained, safe products and labels demo data', async () => {
    const id = await assess(sensitiveOily);
    const res = await recs(id);
    expect(res.status).toBe(201);
    expect(res.body.dataNote).toContain('DEMO DATA');
    const am = res.body.routine.am as { category: string; product: { slug: string } }[];
    expect(am[am.length - 1]?.category).toBe('sunscreen');
    expect(['demo-mineral-sunscreen-spf50', 'demo-gel-sunscreen-spf30']).toContain(am[am.length - 1]?.product.slug);
    expect((res.body.excluded as { name: string }[]).some((e) => e.name.includes('SPF 15'))).toBe(true);
    for (const item of items(res.body)) expect(item.reasons.length).toBeGreaterThan(0);
    const cleansers = res.body.categories.find((c: { category: string }) => c.category === 'cleanser').items as Item[];
    expect(cleansers[0]?.product.slug).not.toBe('demo-foam-cleanser-fragranced'); // sensitive user: fragranced one is not first
  });

  it('stores the run and returns it again as the latest', async () => {
    const id = await assess(sensitiveOily);
    expect((await asA(request(app).get(`/api/v1/assessments/${id}/recommendations/latest`))).status).toBe(404);
    const created = await recs(id, { complexity: 'minimal' });
    const latest = await asA(request(app).get(`/api/v1/assessments/${id}/recommendations/latest`));
    expect(latest.status).toBe(200);
    expect(latest.body.runId).toBe(created.body.runId);
    expect(latest.body.routine.level).toBe('minimal');
    const rows = await pool.query('SELECT count(*)::int AS n FROM recommendation r JOIN recommendation_run u ON u.id = r.run_id WHERE u.user_id = $1', [A]);
    expect((rows.rows[0] as { n: number }).n).toBeGreaterThan(0);
  });

  it('rejects an invalid complexity', async () => {
    const id = await assess(sensitiveOily);
    expect((await recs(id, { complexity: 'extreme' })).status).toBe(400);
  });
});

describe('safety rules end to end', () => {
  it('excludes the retinoid when pregnant, and offers it (with a caution) when not', async () => {
    const pregnant = await recs(await assess(fineLines('yes')));
    expect(items(pregnant.body).some((i) => i.product.slug === 'demo-retinol-serum')).toBe(false);
    const excluded = (pregnant.body.excluded as { name: string; reason: string }[]).find((e) => e.name.includes('Retinol'));
    expect(excluded?.reason).toContain('pregnancy');

    const notPregnant = await recs(await assess(fineLines('no')));
    expect(items(notPregnant.body).some((i) => i.product.slug === 'demo-retinol-serum')).toBe(true);
  });

  it('removes fragranced products when the profile says to avoid fragrance', async () => {
    await asA(request(app).patch('/api/v1/me/profile')).send({ fragrancePreference: 'avoid_fragrance' });
    const res = await recs(await assess(sensitiveOily));
    expect(items(res.body).some((i) => i.product.slug.includes('fragranced'))).toBe(false);
    expect((res.body.excluded as { reason: string }[]).some((e) => e.reason.includes('fragrance'))).toBe(true);
  });

  it('respects the allergy / avoid text from the assessment', async () => {
    const body = { answers: { ...sensitiveOily.answers, restrictions: 'niacinamide' }, priorities: sensitiveOily.priorities };
    const res = await recs(await assess(body));
    expect(items(res.body).some((i) => i.product.slug.includes('niacinamide'))).toBe(false);
  });
});
