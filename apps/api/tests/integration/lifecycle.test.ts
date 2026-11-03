import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { and, eq } from 'drizzle-orm';

import { ensureDatabase } from '../setup/database';
describe('PostgreSQL lifecycle and isolation', () => {
  // Dynamic imports let unit tests run without database configuration.
  let infra: typeof import('../../src/core/db');
  let schema: typeof import('../../src/core/db/schema');
  let service: typeof import('../../src/api/tickets/tickets.service');
  let classifier: typeof import('../../src/api/classification/classification.service');
  let owner: string;
  let other: string;
  beforeEach(async () => {
    await ensureDatabase();
    owner = `test-${crypto.randomUUID()}`;
    other = `test-${crypto.randomUUID()}`;
    infra = await import('../../src/core/db');
    schema = await import('../../src/core/db/schema');
    service = await import('../../src/api/tickets/tickets.service');
    classifier = await import('../../src/api/classification/classification.service');
    await infra.db.insert(schema.user).values(
      [owner, other].map((id) => ({
        id,
        name: 'Test',
        email: `${id}@example.test`,
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    );
  });
  afterEach(async () => {
    if (!infra) return;
    for (const id of [owner, other])
      await infra.db.delete(schema.user).where(eq(schema.user.id, id));
  });
  test('concurrent duplicate requests create exactly one ticket, event and durable job', async () => {
    const input = {
      id: 'duplicate',
      subject: 'Charged twice',
      body: 'Two charges for one subscription.',
      scenario: 'normal' as const,
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, () => service.TicketsService.ingest(owner, input)),
    );
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(results.every((result) => result.ticket.status === 'pending')).toBe(true);
    const jobs = await infra.db
      .select()
      .from(schema.outbox)
      .where(and(eq(schema.outbox.ownerId, owner), eq(schema.outbox.ticketId, input.id)));
    expect(jobs).toHaveLength(1);
    expect((await service.TicketsService.get(owner, input.id)).events).toHaveLength(1);
    await classifier.ClassificationService.process({
      ownerId: owner,
      ticketId: input.id,
      version: 1,
    });
    const done = await service.TicketsService.get(owner, input.id);
    expect(done.ticket.status).toBe('classified');
    expect(done.events.map((event) => event.type)).toEqual([
      'received',
      'model_started',
      'validated',
      'classified',
    ]);
    expect(done.ticket.classification?.category).toBe('billing');
    await classifier.ClassificationService.process({
      ownerId: owner,
      ticketId: input.id,
      version: 1,
    });
    expect((await service.TicketsService.get(owner, input.id)).ticket.attempts).toBe(1);
  });
  test('invalid model output is discarded, bounded retries fail, reclassification recovers', async () => {
    await service.TicketsService.ingest(owner, {
      id: 'broken',
      subject: 'Invoice',
      body: 'Where is my invoice?',
      scenario: 'invalid-output',
    });
    const job = { ownerId: owner, ticketId: 'broken', version: 1 };
    await expect(classifier.ClassificationService.process(job)).rejects.toThrow();
    await expect(classifier.ClassificationService.process(job)).rejects.toThrow();
    await classifier.ClassificationService.process(job);
    const failed = await service.TicketsService.get(owner, 'broken');
    expect(failed.ticket.status).toBe('failed');
    expect(failed.ticket.classification).toBeNull();
    expect(failed.ticket.attempts).toBe(3);
    expect(failed.events.filter((event) => event.type === 'retry_scheduled')).toHaveLength(2);
    const second = await service.TicketsService.reclassify(owner, 'broken', 1, 'normal');
    expect(second.version).toBe(2);
    expect(second.status).toBe('pending');
    await expect(service.TicketsService.reclassify(owner, 'broken', 1, 'normal')).rejects.toThrow();
    await classifier.ClassificationService.process(job); // stale job cannot update generation 2
    expect((await service.TicketsService.get(owner, 'broken')).ticket.attempts).toBe(0);
    await classifier.ClassificationService.process({ ...job, version: 2 });
    const recovered = await service.TicketsService.get(owner, 'broken');
    expect(recovered.ticket.status).toBe('classified');
    expect(recovered.events.some((event) => event.version === 1 && event.type === 'failed')).toBe(
      true,
    );
  });
  test('same public id is isolated by account; filtering and pagination are stable', async () => {
    await service.TicketsService.ingest(owner, {
      id: 'duplicate',
      subject: 'Invoice',
      body: 'Where is my invoice?',
      scenario: 'normal',
    });
    await classifier.ClassificationService.process({
      ownerId: owner,
      ticketId: 'duplicate',
      version: 1,
    });
    await service.TicketsService.ingest(owner, {
      id: 'second',
      subject: 'Another',
      body: 'A request.',
      scenario: 'normal',
    });
    await expect(service.TicketsService.get(other, 'duplicate')).rejects.toThrow();
    await service.TicketsService.ingest(other, {
      id: 'duplicate',
      subject: 'Private',
      body: 'Other user content.',
      scenario: 'normal',
    });
    expect((await service.TicketsService.get(other, 'duplicate')).ticket.subject).toBe('Private');
    const page = await service.TicketsService.list(owner, {
      category: 'billing',
      priority: 'low',
      page: 1,
      limit: 1,
    });
    expect(page.tickets).toHaveLength(1);
    expect(page.total).toBe(1);
    expect(page.counts.total).toBe(2);
    const next = await service.TicketsService.list(owner, { page: 2, limit: 1 });
    expect(next.tickets).toHaveLength(1);
  });
});
