import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { ensureDatabase } from '../setup/database';
import type { TicketsService as Service } from '../../src/api/tickets/tickets.service';
import type { TicketDetail } from '@loura/contracts';

describe('BullMQ worker and outbox recovery', () => {
  let worker: ReturnType<typeof Bun.spawn> | undefined;
  let owner: string;
  let service: typeof Service;
  let infra: typeof import('../../src/core/db');
  let schema: typeof import('../../src/core/db/schema');
  let queue: typeof import('../../src/core/queue');
  beforeAll(async () => {
    await ensureDatabase();
    infra = await import('../../src/core/db'); schema = await import('../../src/core/db/schema');
    service = (await import('../../src/api/tickets/tickets.service')).TicketsService;
    queue = await import('../../src/core/queue');
  });
  beforeEach(async () => {
    owner = `worker-${crypto.randomUUID()}`;
    await infra.db.insert(schema.user).values({ id: owner, name: 'Worker test', email: `${owner}@example.test`, emailVerified: false, createdAt: new Date(), updatedAt: new Date() });
  });
  async function stop() {
    if (worker && worker.exitCode === null) { worker.kill('SIGTERM'); await worker.exited; }
    worker = undefined;
  }
  function start(delay = '30') {
    worker = Bun.spawn([process.execPath, resolve(import.meta.dir, '../../src/worker.ts')], { env: { ...process.env, MODEL_DELAY_MS: delay, MODEL_TIMEOUT_MS: '1000' }, stdout: 'ignore', stderr: 'ignore' });
  }
  afterEach(async () => { await stop(); if (owner) await infra.db.delete(schema.user).where(eq(schema.user.id, owner)); });
  afterAll(async () => { await stop(); await queue?.classificationQueue.close(); await queue?.redis.quit(); });
  async function waitFor(id: string, predicate: (detail: TicketDetail) => boolean) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const detail = await service.get(owner, id);
      if (predicate(detail)) return detail;
      if (worker?.exitCode !== null && worker?.exitCode !== undefined) throw new Error(`Worker exited with ${worker.exitCode}`);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    throw new Error(`Ticket ${id} did not reach expected lifecycle state.`);
  }
  test('asynchronously processes once and recovers from one malformed response', async () => {
    await service.ingest(owner, { id: 'retry', subject: 'Invoice request', body: 'Where are my invoices?', scenario: 'malformed-once' });
    start();
    const done = await waitFor('retry', (detail) => detail.ticket.status === 'classified');
    expect(done.ticket.attempts).toBe(2);
    expect(done.events.filter((event) => event.type === 'retry_scheduled')).toHaveLength(1);
    const duplicate = await service.ingest(owner, { id: 'retry', subject: 'Changed', body: 'Changed content.', scenario: 'normal' });
    expect(duplicate.duplicate).toBe(true); expect(duplicate.ticket.attempts).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect((await service.get(owner, 'retry')).events.filter((event) => event.type === 'classified')).toHaveLength(1);
  });
  test('pending work survives worker downtime and Redis job loss', async () => {
    await service.ingest(owner, { id: 'recover', subject: 'API 500', body: 'Production integration is blocked.', scenario: 'normal' });
    const stableId = queue.jobId(owner, 'recover', 1);
    await queue.classificationQueue.add('classify', { ownerId: owner, ticketId: 'recover', version: 1 }, { jobId: stableId });
    await queue.redis.flushdb(); // Only the isolated loura-tests Redis is reachable here.
    expect((await service.get(owner, 'recover')).ticket.status).toBe('pending');
    start();
    const recovered = await waitFor('recover', (detail) => detail.ticket.status === 'classified');
    expect(recovered.ticket.classification?.category).toBe('technical'); expect(recovered.ticket.attempts).toBe(1);
  });
  test('graceful shutdown completes in-flight work and restart delivers queued work', async () => {
    await service.ingest(owner, { id: 'inflight', subject: 'Account email', body: 'Change my account email.', scenario: 'normal' });
    start('300');
    await waitFor('inflight', (detail) => detail.ticket.attempts === 1);
    await stop();
    expect((await service.get(owner, 'inflight')).ticket.status).toBe('classified');
    await service.ingest(owner, { id: 'queued', subject: 'Dark mode', body: 'Please add dark mode.', scenario: 'normal' });
    expect((await service.get(owner, 'queued')).ticket.attempts).toBe(0);
    start();
    expect((await waitFor('queued', (detail) => detail.ticket.status === 'classified')).ticket.attempts).toBe(1);
  });
});
