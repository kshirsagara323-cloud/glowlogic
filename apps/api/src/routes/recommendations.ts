import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError } from '../errors.js';
import { currentUser } from '../middleware/requireAuth.js';
import { recommend } from '../recommend/index.js';
import type { RecommendationOutput } from '../recommend/index.js';
import { loadCatalog, loadContext, saveRun } from '../services/recommendations.js';

const bodySchema = z.object({ complexity: z.enum(['minimal', 'beginner', 'moderate', 'advanced']).optional() }).strict();

// Mounted at /api/v1/assessments/:id/recommendations
export function recommendationsRouter(pool: Pool): Router {
  const router = Router({ mergeParams: true });
  const limiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

  const assessmentId = (raw: unknown): string => {
    const parsed = z.string().uuid().safeParse(raw);
    if (!parsed.success) throw new AppError(404, 'not_found', 'Assessment not found.');
    return parsed.data;
  };

  router.post('/', limiter, async (req, res) => {
    const { id: userId } = currentUser(req);
    const id = assessmentId((req.params as Record<string, unknown>).id);
    const body = bodySchema.parse(req.body ?? {});
    const [catalog, { ctx, rulesVersion }] = await Promise.all([loadCatalog(pool), loadContext(pool, userId, id, body.complexity)]);
    const output = recommend(ctx, catalog, { complexity: body.complexity });
    res.status(201).json(await saveRun(pool, userId, id, rulesVersion, ctx, output));
  });

  router.get('/latest', async (req, res) => {
    const { id: userId } = currentUser(req);
    const id = assessmentId((req.params as Record<string, unknown>).id);
    const owned = await pool.query('SELECT 1 FROM skin_assessment WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!owned.rowCount) throw new AppError(404, 'not_found', 'Assessment not found.');
    const latest = await pool.query(
      `SELECT id, created_at, output FROM recommendation_run
       WHERE assessment_id = $1 AND user_id = $2 AND output IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
      [id, userId],
    );
    const row = latest.rows[0] as { id: string; created_at: Date; output: RecommendationOutput } | undefined;
    if (!row) throw new AppError(404, 'no_recommendations', 'No recommendations yet.');
    res.json({ runId: row.id, createdAt: row.created_at, ...row.output });
  });

  return router;
}
