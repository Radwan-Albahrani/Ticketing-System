import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../core/db';
import { events, outbox, tickets } from '../../core/db/schema';
import { AppError } from '../../common/errors';
import { PROMPT_VERSION } from '../classification/classification.types';
import { serializeTicket } from './utils/serialize';
import type { IngestInput, ListQuery } from './tickets.types';
import type { DemoScenario } from '@loura/contracts';
export class TicketsService {
  static async ingest(ownerId: string, input: IngestInput) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .insert(tickets)
        .values({ ...input, ownerId, promptVersion: PROMPT_VERSION })
        .onConflictDoNothing()
        .returning();
      if (!row) {
        const [existing] = await tx
          .select()
          .from(tickets)
          .where(and(eq(tickets.ownerId, ownerId), eq(tickets.id, input.id)));
        if (!existing) throw new AppError(409, 'CONFLICT', 'Ticket could not be created.');
        return { ticket: serializeTicket(existing), duplicate: true };
      }
      await tx.insert(events).values({
        ownerId,
        ticketId: row.id,
        version: 1,
        type: 'received',
        message: 'Ticket accepted; durable classification job scheduled.',
      });
      await tx.insert(outbox).values({ ownerId, ticketId: row.id, version: 1 });
      return { ticket: serializeTicket(row), duplicate: false };
    });
  }
  static async list(ownerId: string, query: ListQuery) {
    const filters = and(
      eq(tickets.ownerId, ownerId),
      query.category ? sql`${tickets.classification}->>'category' = ${query.category}` : undefined,
      query.priority ? sql`${tickets.classification}->>'priority' = ${query.priority}` : undefined,
      query.status ? eq(tickets.status, query.status) : undefined,
    );
    return db.transaction(
      async (tx) => {
        const rows = await tx
          .select()
          .from(tickets)
          .where(filters)
          .orderBy(desc(tickets.createdAt), asc(tickets.id))
          .limit(query.limit)
          .offset((query.page - 1) * query.limit);
        const [total] = await tx.select({ value: count() }).from(tickets).where(filters);
        const counts = await tx
          .select({ status: tickets.status, value: count() })
          .from(tickets)
          .where(eq(tickets.ownerId, ownerId))
          .groupBy(tickets.status);
        const stats = { pending: 0, classified: 0, failed: 0, total: 0 };
        for (const row of counts) {
          stats[row.status] = row.value;
          stats.total += row.value;
        }
        return {
          tickets: rows.map(serializeTicket),
          total: total?.value ?? 0,
          page: query.page,
          limit: query.limit,
          counts: stats,
        };
      },
      { isolationLevel: 'repeatable read' },
    );
  }
  static async get(ownerId: string, id: string) {
    return db.transaction(
      async (tx) => {
        const [row] = await tx
          .select()
          .from(tickets)
          .where(and(eq(tickets.ownerId, ownerId), eq(tickets.id, id)));
        if (!row) throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
        const history = await tx
          .select()
          .from(events)
          .where(and(eq(events.ownerId, ownerId), eq(events.ticketId, id)))
          .orderBy(asc(events.sequence));
        return {
          ticket: serializeTicket(row),
          events: history.map(({ ownerId: _owner, sequence: _sequence, ...event }) => ({
            ...event,
            createdAt: event.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: 'repeatable read' },
    );
  }
  static async reclassify(
    ownerId: string,
    id: string,
    expectedVersion: number,
    scenario: DemoScenario,
  ) {
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(tickets)
        .where(and(eq(tickets.ownerId, ownerId), eq(tickets.id, id)))
        .for('update');
      if (!row) throw new AppError(404, 'NOT_FOUND', 'Ticket not found.');
      if (row.status === 'pending' || row.version !== expectedVersion)
        throw new AppError(
          409,
          'VERSION_CONFLICT',
          'Ticket is already processing or has changed; refresh and try again.',
        );
      const version = row.version + 1;
      const [updated] = await tx
        .update(tickets)
        .set({
          version,
          scenario,
          status: 'pending',
          classification: null,
          attempts: 0,
          lastError: null,
          promptVersion: PROMPT_VERSION,
          updatedAt: new Date(),
        })
        .where(and(eq(tickets.ownerId, ownerId), eq(tickets.id, id)))
        .returning();
      await tx.insert(events).values({
        ownerId,
        ticketId: id,
        version,
        type: 'reclassified',
        message: `Reclassification requested with ${PROMPT_VERSION}; previous result retained in history.`,
      });
      await tx.insert(outbox).values({ ownerId, ticketId: id, version });
      return serializeTicket(updated!);
    });
  }
}
