import { z } from 'zod';

export const categorySchema = z.enum(['billing', 'technical', 'account', 'other']);
export const prioritySchema = z.enum(['low', 'medium', 'high']);
export const classificationSchema = z
  .object({
    category: categorySchema,
    priority: prioritySchema,
    summary: z
      .string()
      .trim()
      .min(8)
      .max(300)
      .refine(
        (value) =>
          !/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value) &&
          /\p{L}/u.test(value) &&
          /[.!?]$/.test(value) &&
          !/[.!?](?:\s+\S|\p{L})/u.test(value),
        'Summary must be one sentence on one line, ending with punctuation.',
      ),
  })
  .strict();
export const ticketInputSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    subject: z.string().trim().max(300),
    body: z.string().trim().min(1).max(20000),
  })
  .strict();
export const demoScenarioSchema = z.enum([
  'normal',
  'malformed-once',
  'invalid-output',
  'invalid-summary',
  'timeout',
]);
export const ingestSchema = ticketInputSchema.extend({
  scenario: demoScenarioSchema.default('normal'),
});
export const listQuerySchema = z.object({
  category: categorySchema.optional(),
  priority: prioritySchema.optional(),
  status: z.enum(['pending', 'classified', 'failed']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const reclassifySchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    scenario: demoScenarioSchema.default('normal'),
  })
  .strict();
export const eventSchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  version: z.number(),
  type: z.string(),
  message: z.string(),
  attempt: z.number().nullable(),
  createdAt: z.string(),
});
export const ticketSchema = ticketInputSchema.extend({
  status: z.enum(['pending', 'classified', 'failed']),
  classification: classificationSchema.nullable(),
  version: z.number(),
  promptVersion: z.string(),
  attempts: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export const ticketDetailSchema = z.object({ ticket: ticketSchema, events: z.array(eventSchema) });
export const ticketListSchema = z.object({
  tickets: z.array(ticketSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  counts: z.object({
    pending: z.number(),
    classified: z.number(),
    failed: z.number(),
    total: z.number(),
  }),
});
export type TicketInput = z.infer<typeof ticketInputSchema>;
export type IngestInput = z.infer<typeof ingestSchema>;
export type Classification = z.infer<typeof classificationSchema>;
export type Ticket = z.infer<typeof ticketSchema>;
export type TicketEvent = z.infer<typeof eventSchema>;
export type TicketDetail = z.infer<typeof ticketDetailSchema>;
export type TicketList = z.infer<typeof ticketListSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type DemoScenario = z.infer<typeof demoScenarioSchema>;
