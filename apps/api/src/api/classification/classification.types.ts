export const PROMPT_VERSION = 'jev-1.0';
export const MAX_ATTEMPTS = 3;
export type ClassificationJob = { ownerId: string; ticketId: string; version: number };
export type { Classification, DemoScenario, TicketInput } from '@loura/contracts';
