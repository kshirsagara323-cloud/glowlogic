import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { z } from 'zod';
import { InvalidInputError, TRAIT_CODES, UNDERTONES, evaluateAssessment, parsePriorities, publicQuiz, validateAnswers } from '../engine/index.js';
import type { AssessmentResult } from '../engine/index.js';
import { AppError } from '../errors.js';
import { currentUser } from '../middleware/requireAuth.js';

export function quizRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.json(publicQuiz());
  });
  return router;
}

const LEVEL_SCORE = { low: 15, moderate: 50, high: 85 } as const;
const uuid = z.string().uuid();

const overrideSchema = z
  .object({
    traits: z.record(z.string(), z.enum(['low', 'moderate', 'high']).nullable()).optional(),
    tone: z
      .object({
        depthBin: z.number().int().min(1).max(10).nullable(),
        undertone: z.enum(UNDERTONES).nullable(),
      })
      .strict()
      .optional(),
  })
  .strict();

async function loadDetail(pool: Pool, assessmentId: string, userId: string) {
  const found = await pool.query(
    `SELECT id, created_at, rules_version, result FROM skin_assessment
     WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
    [assessmentId, userId],
  );
  const row = found.rows[0] as { id: string; created_at: Date; rules_version: string; result: AssessmentResult } | undefined;
  if (!row) throw new AppError(404, 'not_found', 'Assessment not found.');

  const [traits, tone, priorities] = await Promise.all([
    pool.query(
      'SELECT concern_code, score, category, confidence, source FROM effective_skin_trait WHERE assessment_id = $1',
      [assessmentId],
    ),
    pool.query('SELECT depth_bin, undertone, confidence, source FROM effective_skin_tone WHERE assessment_id = $1', [assessmentId]),
    pool.query('SELECT rank, concern_code FROM skin_concern_priority WHERE assessment_id = $1 ORDER BY rank', [assessmentId]),
  ]);
  return {
    id: row.id,
    createdAt: row.created_at,
    rulesVersion: row.rules_version,
    result: row.result,
    effectiveTraits: traits.rows.map((t: { concern_code: string; score: number; category: string; confidence: string; source: string }) => ({
      code: t.concern_code, score: t.score, category: t.category, confidence: Number(t.confidence), source: t.source,
    })),
    effectiveTone: tone.rows[0]
      ? {
          depthBin: (tone.rows[0] as { depth_bin: number | null }).depth_bin,
          undertone: (tone.rows[0] as { undertone: string | null }).undertone,
          confidence: Number((tone.rows[0] as { confidence: string }).confidence),
          source: (tone.rows[0] as { source: string }).source,
        }
      : null,
    priorities: priorities.rows.map((p: { concern_code: string }) => p.concern_code),
  };
}

async function requireOwned(pool: Pool, assessmentId: string, userId: string): Promise<void> {
  const owned = await pool.query('SELECT 1 FROM skin_assessment WHERE id = $1 AND user_id = $2', [assessmentId, userId]);
  if (!owned.rowCount) throw new AppError(404, 'not_found', 'Assessment not found.');
}

export function assessmentsRouter(pool: Pool): Router {
  const router = Router();
  const createLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

  router.get('/', async (req, res) => {
    const { id } = currentUser(req);
    const rows = await pool.query(
      `SELECT id, created_at FROM skin_assessment
       WHERE user_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 20`,
      [id],
    );
    res.json({ assessments: rows.rows.map((r: { id: string; created_at: Date }) => ({ id: r.id, createdAt: r.created_at })) });
  });

  router.post('/', createLimiter, async (req, res) => {
    const { id: userId } = currentUser(req);
    const body = z.object({ answers: z.unknown(), priorities: z.unknown() }).strict().parse(req.body);

    let result: AssessmentResult;
    let answers;
    try {
      answers = validateAnswers(body.answers);
      result = evaluateAssessment(answers, parsePriorities(body.priorities));
    } catch (error) {
      if (error instanceof InvalidInputError) throw new AppError(400, 'invalid_input', error.issues.join(' '));
      throw error;
    }

    const client = await pool.connect();
    let assessmentId: string;
    try {
      await client.query('BEGIN');
      const created = await client.query(
        `INSERT INTO skin_assessment (user_id, status, rules_version, answers, result, completed_at)
         VALUES ($1, 'completed', $2, $3, $4, now()) RETURNING id`,
        [userId, result.rulesVersion, JSON.stringify(answers), JSON.stringify(result)],
      );
      assessmentId = (created.rows[0] as { id: string }).id;
      for (const t of result.traits) {
        await client.query(
          `INSERT INTO skin_profile_trait (assessment_id, concern_code, score, category, confidence, source, evidence)
           VALUES ($1, $2, $3, $4, $5, 'quiz', $6)`,
          [assessmentId, t.code, t.score, t.category, t.confidence, JSON.stringify(t.evidence)],
        );
      }
      const { depthBin, undertone, depthConfidence, undertoneConfidence } = result.tone;
      if (depthBin !== null || undertone !== null) {
        const confidences = [depthBin !== null ? depthConfidence : null, undertone !== null ? undertoneConfidence : null]
          .filter((c): c is number => c !== null);
        await client.query(
          `INSERT INTO skin_tone_estimate (assessment_id, source, depth_bin, undertone, confidence)
           VALUES ($1, 'quiz', $2, $3, $4)`,
          [assessmentId, depthBin, undertone, Math.min(...confidences)],
        );
      }
      for (const [index, code] of result.priorities.entries()) {
        await client.query(
          'INSERT INTO skin_concern_priority (assessment_id, rank, concern_code) VALUES ($1, $2, $3)',
          [assessmentId, index + 1, code],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json(await loadDetail(pool, assessmentId, userId));
  });

  router.get('/:id', async (req, res) => {
    const { id: userId } = currentUser(req);
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) throw new AppError(404, 'not_found', 'Assessment not found.');
    res.json(await loadDetail(pool, parsed.data, userId));
  });

  router.patch('/:id/overrides', async (req, res) => {
    const { id: userId } = currentUser(req);
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) throw new AppError(404, 'not_found', 'Assessment not found.');
    const assessmentId = parsed.data;
    const body = overrideSchema.parse(req.body);
    await requireOwned(pool, assessmentId, userId);

    const known = new Set<string>(TRAIT_CODES);
    for (const code of Object.keys(body.traits ?? {})) {
      if (!known.has(code)) throw new AppError(400, 'invalid_input', `Unknown trait "${code.slice(0, 40)}".`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [code, level] of Object.entries(body.traits ?? {})) {
        if (level === null) {
          await client.query(
            `DELETE FROM skin_profile_trait WHERE assessment_id = $1 AND concern_code = $2 AND source = 'user_override'`,
            [assessmentId, code],
          );
        } else {
          await client.query(
            `INSERT INTO skin_profile_trait (assessment_id, concern_code, score, category, confidence, source, evidence)
             VALUES ($1, $2, $3, $4, 1, 'user_override', '[{"type":"user_override"}]')
             ON CONFLICT (assessment_id, concern_code, source)
             DO UPDATE SET score = EXCLUDED.score, category = EXCLUDED.category`,
            [assessmentId, code, LEVEL_SCORE[level], level],
          );
        }
      }
      if (body.tone) {
        const { depthBin, undertone } = body.tone;
        if (depthBin === null && undertone === null) {
          await client.query(`DELETE FROM skin_tone_estimate WHERE assessment_id = $1 AND source = 'user_override'`, [assessmentId]);
        } else {
          await client.query(
            `INSERT INTO skin_tone_estimate (assessment_id, source, depth_bin, undertone, confidence)
             VALUES ($1, 'user_override', $2, $3, 1)
             ON CONFLICT (assessment_id, source)
             DO UPDATE SET depth_bin = EXCLUDED.depth_bin, undertone = EXCLUDED.undertone`,
            [assessmentId, depthBin, undertone],
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.json(await loadDetail(pool, assessmentId, userId));
  });

  router.delete('/:id', async (req, res) => {
    const { id: userId } = currentUser(req);
    const parsed = uuid.safeParse(req.params.id);
    if (!parsed.success) throw new AppError(404, 'not_found', 'Assessment not found.');
    const deleted = await pool.query('DELETE FROM skin_assessment WHERE id = $1 AND user_id = $2', [parsed.data, userId]);
    if (!deleted.rowCount) throw new AppError(404, 'not_found', 'Assessment not found.');
    res.status(204).end();
  });

  return router;
}
