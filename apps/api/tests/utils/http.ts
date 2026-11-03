import type { Server } from 'node:http';
import { once } from 'node:events';
import { ensureDatabase } from '../setup/database';
export async function startTestServer() {
  await ensureDatabase();
  const { app } = await import('../../src/app');
  const server: Server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  const base = `http://127.0.0.1:${address.port}`;
  return {
    server,
    async call(path: string, options: { method?: string; body?: unknown; cookie?: string; origin?: string; raw?: string } = {}) {
      return fetch(base + '/api' + path, { method: options.method ?? 'GET', headers: { 'Content-Type': 'application/json', ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.origin ? { Origin: options.origin } : {}) }, ...(options.raw !== undefined ? { body: options.raw } : options.body !== undefined ? { body: JSON.stringify(options.body) } : {}) });
    },
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}
export type TestServer = Awaited<ReturnType<typeof startTestServer>>;
export async function createActor(_server: TestServer) {
  const { auth } = await import('../../src/core/auth');
  const email = `${crypto.randomUUID()}@example.test`;
  const response = await auth.api.signUpEmail({ body: { name: 'Isolated test user', email, password: 'test-password-2026' }, asResponse: true });
  if (!response.ok) throw new Error(`Test signup failed: ${response.status} ${await response.text()}`);
  const body = await response.json() as { user: { id: string } };
  const cookie = response.headers.getSetCookie().map((header) => header.split(';')[0]).join('; ');
  return { id: body.user.id, email, cookie };
}
