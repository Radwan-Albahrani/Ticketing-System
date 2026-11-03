import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { fromNodeHeaders } from 'better-auth/node';
import type { RequestHandler } from 'express';
import { config } from './config';
import { db } from './db';
import * as schema from './db/schema';
export const auth = betterAuth({
  secret: config.AUTH_SECRET, baseURL: config.APP_URL, basePath: '/api/auth',
  trustedOrigins: [config.APP_URL],
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: { enabled: true, minPasswordLength: 12 },
  advanced: { cookiePrefix: 'loura' },
  rateLimit: { enabled: true, window: 60, max: 30 },
});
declare global {
  // Express exposes its request extension through this global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { ownerId: string; } }
}
export const requireAuth: RequestHandler = async (req, res, next) => {
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!result) { res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Sign in to continue.' } }); return; }
  req.ownerId = result.user.id;
  next();
};
