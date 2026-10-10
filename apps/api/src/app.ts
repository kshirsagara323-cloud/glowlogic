import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import type { TokenVerifier } from './auth/verifyToken.js';
import type { Config } from './config.js';
import { errorHandler } from './errors.js';
import { requireAuth } from './middleware/requireAuth.js';
import { assessmentsRouter, quizRouter } from './routes/assessments.js';
import { healthRouter } from './routes/health.js';
import { meRouter } from './routes/me.js';
import { recommendationsRouter } from './routes/recommendations.js';

export interface AppDeps {
  config: Config;
  pool: Pool;
  verifyToken: TokenVerifier;
  deleteAuthUser: (userId: string) => Promise<void>;
}

// Everything is passed in, so tests can supply a fake token verifier.
export function createApp({ config, pool, verifyToken, deleteAuthUser }: AppDeps): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // one proxy (the host) in front, so rate limits see the real client IP

  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));

  const auth = requireAuth(verifyToken, pool);
  app.use(healthRouter(pool, config));
  app.use('/api/v1/quiz', quizRouter()); // public: contains no personal data
  app.use('/api/v1/me', auth, meRouter({ pool, deleteAuthUser }));
  app.use('/api/v1/assessments/:id/recommendations', auth, recommendationsRouter(pool));
  app.use('/api/v1/assessments', auth, assessmentsRouter(pool));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Not found.' } });
  });
  app.use(errorHandler);
  return app;
}
