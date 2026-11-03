import { describe, expect, test } from 'bun:test';
import { generateText } from 'ai';
import { classificationSchema, ingestSchema, listQuerySchema } from '@loura/contracts';
import { sampleTickets } from '@loura/contracts/samples';
import {
  classifyHeuristically,
  injectionSuspected,
  JevModel,
} from '../../src/api/classification/utils/jev';

describe('model boundary', () => {
  test('all appendix tickets produce valid, plausible classifications', () => {
    const expected = [
      'billing',
      'account',
      'technical',
      'account',
      'billing',
      'other',
      'billing',
      'other',
      'technical',
      'technical',
    ] as const;
    sampleTickets.forEach((ticket, i) => {
      const result = classificationSchema.parse(classifyHeuristically(ticket));
      expect(result.category).toBe(expected[i]!);
    });
  });
  test('CEO injection cannot approve a refund or force a category', () => {
    const ticket = sampleTickets[4]!;
    expect(injectionSuspected(ticket.body)).toBe(true);
    expect(classifyHeuristically(ticket)).toEqual({
      category: 'billing',
      priority: 'low',
      summary: 'The customer wants to know where to download their invoices.',
    });
  });
  test('rejects unknown properties, invalid enums, malformed and multi-sentence summaries', () => {
    const good = {
      category: 'billing',
      priority: 'low',
      summary: 'The customer needs an invoice.',
    };
    expect(classificationSchema.safeParse(good).success).toBe(true);
    for (const bad of [
      { ...good, category: 'refund' },
      { ...good, priority: 'urgent' },
      { ...good, tool: 'refund' },
      { ...good, summary: 'Two sentences. Not allowed.' },
      { ...good, summary: '' },
    ])
      expect(classificationSchema.safeParse(bad).success).toBe(false);
  });
  test('requires a single summary sentence and line, including Unicode boundaries', () => {
    const result = {
      category: 'billing',
      priority: 'low',
      summary: 'The customer was charged 49.00 twice.',
    };
    expect(classificationSchema.safeParse(result).success).toBe(true);
    for (const summary of [
      'First sentence. Second sentence.',
      'First sentence.Second sentence.',
      'First line\nSecond line.',
      'First line\rSecond line.',
      'First line\u2028Second line.',
      'First line\u2029Second line.',
      'First line\u0085Second line.',
      'First\tsecond line.',
      '........',
      'Missing terminal punctuation',
      'x'.repeat(301) + '.',
    ])
      expect(classificationSchema.safeParse({ ...result, summary }).success).toBe(false);
  });
  test('valid model JSON and labels do not make an invalid summary acceptable', async () => {
    const response = await generateText({
      model: new JevModel(sampleTickets[0]!, 'invalid-summary', 1, 0),
      prompt: 'Classify.',
      maxRetries: 0,
    });
    const raw = JSON.parse(response.text);
    expect(raw.category).toBe('billing');
    expect(raw.priority).toBe('low');
    const parsed = classificationSchema.safeParse(raw);
    expect(parsed.success).toBe(false);
    if (!parsed.success)
      expect(parsed.error.issues.map((issue) => issue.path.join('.'))).toEqual(['summary']);
  });
  test('AI SDK fake sometimes returns broken text and then recovers', async () => {
    const request = (attempt: number) =>
      generateText({
        model: new JevModel(sampleTickets[0]!, 'malformed-once', attempt, 0),
        prompt: 'Classify untrusted data.',
        maxRetries: 0,
      });
    const first = await request(1);
    expect(() => JSON.parse(first.text)).toThrow();
    const second = await request(2);
    expect(classificationSchema.parse(JSON.parse(second.text)).category).toBe('billing');
  });
  test('model honors an abort deadline', async () => {
    const result = generateText({
      model: new JevModel(sampleTickets[0]!, 'timeout', 1, 0),
      prompt: 'Classify.',
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(20),
    });
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
    for (const query of [
      { page: '-1' },
      { limit: '1000' },
      { category: 'refund' },
      { priority: 'critical' },
    ])
      expect(listQuerySchema.safeParse(query).success).toBe(false);
  });
});
