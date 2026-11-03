import { readdir } from 'node:fs/promises';
import { pool } from './index';
export async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(731602)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const dir = new URL('./migrations/', import.meta.url);
    for (const name of (await readdir(dir)).filter((file) => file.endsWith('.sql')).sort()) {
      const found = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
      if (found.rowCount) continue;
      await client.query(await Bun.file(new URL(name, dir)).text());
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
if (import.meta.main) {
  await migrate();
  await pool.end();
}
