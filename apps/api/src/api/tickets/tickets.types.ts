import type { tickets } from '../../core/db/schema';
export type TicketRow = typeof tickets.$inferSelect;
export type { IngestInput, ListQuery, TicketInput } from '@loura/contracts';
