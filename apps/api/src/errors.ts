import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function log(level: string, message: string, extra: Record<string, unknown>): void {
  console.error(JSON.stringify({ level, message, time: new Date().toISOString(), ...extra }));
}

// Users get short, safe messages. Stack traces go to the server log only.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'invalid_input',
        message: 'Some fields are invalid.',
        fields: err.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })),
      },
    });
    return;
  }
  const status = (err as { status?: unknown }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    res.status(status).json({
      error: { code: 'bad_request', message: status === 413 ? 'Request too large.' : 'Bad request.' },
    });
    return;
  }
  log('error', 'Unhandled error', {
    method: req.method,
    path: req.path,
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  res.status(500).json({ error: { code: 'server_error', message: 'Something went wrong. Please try again.' } });
};

export { log };
