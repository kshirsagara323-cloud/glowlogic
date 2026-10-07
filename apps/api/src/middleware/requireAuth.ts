import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import type { AuthUser, TokenVerifier } from '../auth/verifyToken.js';
import { AppError } from '../errors.js';
import { provisionUser } from '../services/users.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(verifyToken: TokenVerifier, pool: Pool) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const [scheme, token] = (req.header('authorization') ?? '').split(' ');
      if (scheme?.toLowerCase() !== 'bearer' || !token) throw new AppError(401, 'unauthorized', 'Please log in.');
      const user = await verifyToken(token);
      if (!user) throw new AppError(401, 'unauthorized', 'Please log in.');
      await provisionUser(pool, user);
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new AppError(401, 'unauthorized', 'Please log in.');
  return req.user;
}
