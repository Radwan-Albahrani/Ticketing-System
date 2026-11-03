import { ticketSchema } from '@loura/contracts';
import type { TicketRow } from '../tickets.types';
export function serializeTicket(row: TicketRow) {
  const { ownerId: _ownerId, scenario: _scenario, ...publicRow } = row;
  return ticketSchema.parse({
    ...publicRow,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}
