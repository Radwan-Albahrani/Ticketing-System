import { afterAll, setDefaultTimeout } from 'bun:test';
process.env.NODE_ENV = 'test';
process.env.AUTH_SECRET = 'test-only-auth-secret-for-isolated-integration-tests';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://loura:loura@localhost:5544/loura_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6399';
process.env.APP_URL = 'http://localhost:8080';
process.env.MODEL_DELAY_MS = '0';
process.env.MODEL_TIMEOUT_MS = '150';
if (!new URL(process.env.DATABASE_URL).pathname.endsWith('_test')) throw new Error('Tests require a database name ending in _test.');
setDefaultTimeout(60000);

afterAll(async () => { const { cleanupDatabase } = await import('./database'); await cleanupDatabase(); });
