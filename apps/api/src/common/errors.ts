import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { log } from '../core/observability';
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  if (res.headersSent) { res.end(); return; }
  if (error instanceof ZodError) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Check the submitted fields.', issues: error.issues.map(({ path, message }) => ({ path, message })) } }); return;
  }
  if (error instanceof AppError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number(error.status) : 500;
  if (status === 400 || status === 413) { res.status(status).json({ error: { code: 'INVALID_REQUEST', message: status === 413 ? 'Request body is too large.' : 'Invalid JSON request.' } }); return; }
  log.error({ action: 'http.error', requestId: res.getHeader('x-request-id'), path: req.path, errorType: error instanceof Error ? error.name : 'Unknown' });
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
