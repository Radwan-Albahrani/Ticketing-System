import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  primaryKey,
  boolean,
  bigint,
} from 'drizzle-orm/pg-core';
import type { Classification, DemoScenario } from '@loura/contracts';
export const user = pgTable('auth_user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
export const session = pgTable('auth_session', {
  id: text().primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});
export const account = pgTable('auth_account', {
  id: text().primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text(),
  password: text(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
export const verification = pgTable('auth_verification', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
});
export const tickets = pgTable(
  'tickets',
  {
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    id: text().notNull(),
    subject: text().notNull(),
    body: text().notNull(),
    status: text().$type<'pending' | 'classified' | 'failed'>().notNull().default('pending'),
    classification: jsonb().$type<Classification>(),
    version: integer().notNull().default(1),
    promptVersion: text('prompt_version').notNull().default('jev-1.0'),
    attempts: integer().notNull().default(0),
    scenario: text().$type<DemoScenario>().notNull().default('normal'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.id] })],
);
export const events = pgTable('ticket_events', {
  sequence: bigint('sequence', { mode: 'number' }).generatedAlwaysAsIdentity(),
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  ownerId: text('owner_id').notNull(),
  ticketId: text('ticket_id').notNull(),
  version: integer().notNull(),
  type: text().notNull(),
  message: text().notNull(),
  attempt: integer(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export const outbox = pgTable(
  'classification_outbox',
  {
    ownerId: text('owner_id').notNull(),
    ticketId: text('ticket_id').notNull(),
    version: integer().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.ownerId, table.ticketId, table.version] })],
);
