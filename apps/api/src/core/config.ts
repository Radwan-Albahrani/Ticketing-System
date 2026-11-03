import { z } from 'zod';
export const config = z.object({
  DATABASE_URL: z.string().default('postgres://loura:loura@localhost:5433/loura'),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  AUTH_SECRET: z.string().min(32),
  APP_URL: z.url().default('http://localhost:8080'),
  PORT: z.coerce.number().int().positive().default(3001),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(3),
  MODEL_DELAY_MS: z.coerce.number().int().min(0).max(10000).default(1200),
  MODEL_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
}).parse(process.env);
