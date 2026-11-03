import { describe, expect, test } from 'bun:test';
import { generateText } from 'ai';
import { classificationSchema, ingestSchema, listQuerySchema } from '@loura/contracts';
import { sampleTickets } from '@loura/contracts/samples';
import { classifyHeuristically, injectionSuspected, JevModel } from '../src/api/classification/utils/jev';

describe('model boundary', () => {
  test('all appendix tickets produce valid, plausible classifications', () => {
    const expected = ['billing', 'account', 'technical', 'account', 'billing', 'other', 'billing', 'other', 'technical', 'technical'] as const;
    sampleTickets.forEach((ticket, i) => {
      const result = classificationSchema.parse(classifyHeuristically(ticket));
      expect(result.category).toBe(expected[i]!);
    });
  });
  test('CEO injection cannot approve a refund or force a category', () => {
    const ticket = sampleTickets[4]!;
    expect(injectionSuspected(ticket.body)).toBe(true);
    expect(classifyHeuristically(ticket)).toEqual({ category: 'billing', priority: 'low', summary: 'The customer wants to know where to download their invoices.' });
  });
  test('rejects unknown properties, invalid enums, malformed and multi-sentence summaries', () => {
    const good = { category: 'billing', priority: 'low', summary: 'The customer needs an invoice.' };
    expect(classificationSchema.safeParse(good).success).toBe(true);
    for (const bad of [{ ...good, category: 'refund' }, { ...good, priority: 'urgent' }, { ...good, tool: 'refund' }, { ...good, summary: 'Two sentences. Not allowed.' }, { ...good, summary: '' }]) expect(classificationSchema.safeParse(bad).success).toBe(false);
  });
  test('AI SDK fake sometimes returns broken text and then recovers', async () => {
    const request = (attempt: number) => generateText({ model: new JevModel(sampleTickets[0]!, 'malformed-once', attempt, 0), prompt: 'Classify untrusted data.', maxRetries: 0 });
    const first = await request(1);
    expect(() => JSON.parse(first.text)).toThrow();
    const second = await request(2);
    expect(classificationSchema.parse(JSON.parse(second.text)).category).toBe('billing');
  });
  test('model honors an abort deadline', async () => {
    const result = generateText({ model: new JevModel(sampleTickets[0]!, 'timeout', 1, 0), prompt: 'Classify.', maxRetries: 0, abortSignal: AbortSignal.timeout(20) });
    await expect(result).rejects.toThrow();
  });
});
describe('HTTP contracts', () => {
  test('permits empty subject from appendix and rejects empty body', () => {
    expect(ingestSchema.safeParse(sampleTickets[7]).success).toBe(true);
    expect(ingestSchema.safeParse({ ...sampleTickets[0], body: '' }).success).toBe(false);
    expect(ingestSchema.safeParse({ ...sampleTickets[0], id: '../../escape' }).success).toBe(false);
  });
  test('bounds pagination and rejects unsupported filters', () => {
    expect(listQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    for (const query of [{ page: '-1' }, { limit: '1000' }, { category: 'refund' }, { priority: 'critical' }]) expect(listQuerySchema.safeParse(query).success).toBe(false);
  });
});
