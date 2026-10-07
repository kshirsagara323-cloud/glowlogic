import { Router } from 'express';
import type { Pool } from 'pg';
import type { Config } from '../config.js';

// Public on purpose, and deliberately boring: no versions of libraries, no hostnames, no secrets.
export function healthRouter(pool: Pool, config: Config): Router {
  const router = Router();
  router.get('/health', async (_req, res) => {
    let database: 'up' | 'down' = 'up';
    try {
      await pool.query('SELECT 1');
    } catch {
      database = 'down';
    }
    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      version: config.APP_VERSION,
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}
