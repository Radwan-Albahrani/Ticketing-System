import { resolve } from 'node:path';
export const SETUP_TIMEOUT_MS = 120_000;
let ready: Promise<void> | undefined;
let started = false;
let infrastructure: typeof import('../../src/core/db') | undefined;
const composePath = resolve(import.meta.dir, '../../../../compose.test.yaml');
export function ensureDatabase() {
  ready ??= (async () => {
    if (!process.env.TEST_DATABASE_URL) {
      started = true;
      const process = Bun.spawn(
        [
          'docker',
          'compose',
          '-f',
          composePath,
          'up',
          '-d',
          '--wait',
          '--quiet-pull',
          '--wait-timeout',
          '90',
        ],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      const [exitCode, stderr] = await Promise.all([
        process.exited,
        new Response(process.stderr).text(),
      ]);
      if (exitCode) throw new Error(`Test Docker setup failed: ${stderr}`);
    }
    infrastructure = await import('../../src/core/db');
    const { migrate } = await import('../../src/core/db/migrate');
    await migrate();
  })();
  return ready;
}
export async function cleanupDatabase() {
  await infrastructure?.pool.end();
  if (started) {
    const process = Bun.spawn(['docker', 'compose', '-f', composePath, 'down', '-v'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await process.exited;
  }
}
