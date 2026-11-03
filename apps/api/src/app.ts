import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { evlog } from 'evlog/express';
import { toNodeHandler } from 'better-auth/node';
import { auth, requireAuth } from './core/auth';
import { config } from './core/config';
import { pool } from './core/db';
import { errorHandler, AppError } from './common/errors';
import { ticketsRouter } from './api/tickets/tickets.router';
import { classificationRouter } from './api/classification/classification.router';
export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => {
  res.setHeader('x-request-id', crypto.randomUUID());
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.headers.origin && req.headers.origin !== config.APP_URL) { next(new AppError(403, 'ORIGIN_REJECTED', 'Request origin is not allowed.')); return; }
    if (!req.headers['content-type']?.startsWith('application/json')) { next(new AppError(415, 'JSON_REQUIRED', 'Use application/json.')); return; }
  }
  next();
});
app.use(evlog());
app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { code: 'RATE_LIMITED', message: 'Too many requests; try again shortly.' } } }));
app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});
app.all('/api/auth/{*path}', toNodeHandler(auth));
app.use(express.json({ limit: '32kb' }));
app.use('/api/tickets', requireAuth, ticketsRouter);
app.use('/api/classifier', requireAuth, classificationRouter);
app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.')));
app.use(errorHandler);
