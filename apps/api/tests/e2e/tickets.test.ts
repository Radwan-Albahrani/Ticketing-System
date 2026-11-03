import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { eq } from 'drizzle-orm';
import { ticketDetailSchema, ticketListSchema } from '@loura/contracts';
import { sampleTickets } from '@loura/contracts/samples';
import { createActor, startTestServer, type TestServer } from '../utils/http';

describe('real HTTP, better-auth and PostgreSQL', () => {
  let server: TestServer;
  let actor: Awaited<ReturnType<typeof createActor>>;
  beforeAll(async () => { server = await startTestServer(); });
  beforeEach(async () => { actor = await createActor(server); });
  afterEach(async () => {
    const { db } = await import('../../src/core/db');
    const { user } = await import('../../src/core/db/schema');
    if (actor) await db.delete(user).where(eq(user.id, actor.id));
  });
  afterAll(async () => { await server?.close(); });
  test('signs in, reads the session and signs out through HTTP', async () => {
    const signedIn = await server.call('/auth/sign-in/email', { method: 'POST', body: { email: actor.email, password: 'test-password-2026' } });
    expect(signedIn.status).toBe(200);
    const cookie = signedIn.headers.getSetCookie().map((header) => header.split(';')[0]).join('; ');
    expect((await (await server.call('/auth/get-session', { cookie })).json()).user.id).toBe(actor.id);
    expect((await server.call('/auth/sign-out', { method: 'POST', body: {}, cookie })).status).toBe(200);
    expect((await server.call('/tickets', { cookie })).status).toBe(401);
  });
  test('protects reads, writes and stream endpoints without a session', async () => {
    for (const [method, path, body] of [['GET', '/tickets', undefined], ['POST', '/tickets', sampleTickets[0]], ['POST', '/tickets/t-1001/activity', {}]] as const) {
      const response = await server.call(path, { method, body });
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe('UNAUTHORIZED');
    }
  });
  test('returns 202 promptly, deduplicates without changing content, validates queries', async () => {
    const response = await server.call('/tickets', { method: 'POST', body: sampleTickets[0], cookie: actor.cookie });
    expect(response.status).toBe(202);
    expect(response.headers.get('x-request-id')).toBeTruthy();
    const body = await response.json();
    expect(body.ticket.status).toBe('pending'); expect(body.ticket.attempts).toBe(0);
    const duplicate = await server.call('/tickets', { method: 'POST', body: { ...sampleTickets[0], subject: 'Changed subject' }, cookie: actor.cookie });
    expect(duplicate.status).toBe(200);
    const original = await duplicate.json(); expect(original.duplicate).toBe(true); expect(original.ticket.subject).toBe(sampleTickets[0]!.subject);
    const read = await server.call('/tickets/t-1001', { cookie: actor.cookie });
    expect(ticketDetailSchema.parse(await read.json()).ticket.id).toBe('t-1001');
    const list = await server.call('/tickets?limit=1&page=1', { cookie: actor.cookie });
    expect(ticketListSchema.parse(await list.json()).total).toBe(1);
    for (const path of ['/tickets?category=unknown', '/tickets?limit=101', '/tickets?page=0']) expect((await server.call(path, { cookie: actor.cookie })).status).toBe(400);
  });
  test('rejects bad JSON, oversized content, extra fields and foreign origins', async () => {
    for (const body of [{ id: 'bad', subject: 'x', body: '' }, { ...sampleTickets[0], tools: ['refund'] }, { ...sampleTickets[0], body: 'x'.repeat(20001) }]) expect((await server.call('/tickets', { method: 'POST', body, cookie: actor.cookie })).status).toBe(400);
    expect((await server.call('/tickets', { method: 'POST', raw: '{broken', cookie: actor.cookie })).status).toBe(400);
    expect((await server.call('/tickets', { method: 'POST', raw: 'x'.repeat(40000), cookie: actor.cookie })).status).toBe(413);
    expect((await server.call('/tickets', { method: 'POST', body: sampleTickets[0], cookie: actor.cookie, origin: 'https://untrusted.example' })).status).toBe(403);
  });
  test('isolates another account and rejects reclassification while pending', async () => {
    const { TicketsService } = await import('../../src/api/tickets/tickets.service');
    await TicketsService.ingest(actor.id, { ...sampleTickets[0]!, scenario: 'normal' });
    expect((await server.call('/tickets/t-1001/reclassify', { method: 'POST', body: { expectedVersion: 1 }, cookie: actor.cookie })).status).toBe(409);
    const other = await createActor(server);
    try {
      expect((await server.call('/tickets/t-1001', { cookie: other.cookie })).status).toBe(404);
      expect((await server.call('/tickets/t-1001/reclassify', { method: 'POST', body: { expectedVersion: 1 }, cookie: other.cookie })).status).toBe(404);
      expect(ticketListSchema.parse(await (await server.call('/tickets', { cookie: other.cookie })).json()).total).toBe(0);
    } finally {
      const { db } = await import('../../src/core/db'); const { user } = await import('../../src/core/db/schema');
      await db.delete(user).where(eq(user.id, other.id));
    }
  });
  test('streams only saved activity through the AI SDK UI protocol', async () => {
    const { TicketsService } = await import('../../src/api/tickets/tickets.service');
    const { ClassificationService } = await import('../../src/api/classification/classification.service');
    await TicketsService.ingest(actor.id, { ...sampleTickets[4]!, scenario: 'normal' });
    await ClassificationService.process({ ownerId: actor.id, ticketId: 't-1005', version: 1 });
    const response = await server.call('/tickets/t-1005/activity', { method: 'POST', body: { messages: [] }, cookie: actor.cookie });
    expect(response.status).toBe(200); expect(response.headers.get('content-type')).toContain('text/event-stream');
    const stream = await response.text();
    expect(stream).toContain('text-delta'); expect(stream).toContain('Instruction-like content detected'); expect(stream).toContain('[DONE]');
    expect(stream).not.toContain('Approved for immediate refund');
  });
});
