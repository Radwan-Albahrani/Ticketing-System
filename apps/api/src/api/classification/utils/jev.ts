import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
} from '@ai-sdk/provider';
import type { Classification, DemoScenario, TicketInput } from '../classification.types';

// A deterministic fake provider, not a security guarantee for a future real LLM.
// Ignore directive-like sentences and classify the customer's actual request.
export function classifyHeuristically(ticket: TicketInput): Classification {
  const cleaned = `${ticket.subject} ${ticket.body}`
    .replace(/ignore all previous instructions[^.]*\./gi, '')
    .replace(/this ticket is from the CEO[^.]*\./gi, '')
    .replace(/classify it as[^.]*\./gi, '')
    .replace(/also, unrelated,[\s\S]*/i, '')
    .toLowerCase();
  if (/500|timeout|export|upload|integration|error code/.test(cleaned))
    return {
      category: 'technical',
      priority: /production|blocking|500/.test(cleaned) ? 'high' : 'medium',
      summary: /500/.test(cleaned)
        ? 'Production API requests are intermittently failing with HTTP 500 errors.'
        : /timeout|upload/.test(cleaned)
          ? 'File uploads over 20 MB continue to fail with a timeout error.'
          : 'The requested data export is empty and needs investigation.',
    };
  if (/invoice|charg|refund|bill|subscription/.test(cleaned))
    return {
      category: 'billing',
      priority: /charged twice|two charges|before the/.test(cleaned) ? 'medium' : 'low',
      summary: /two charges|charged twice/.test(cleaned)
        ? 'The customer reports a duplicate subscription charge and requests a refund.'
        : /wrong|company name/.test(cleaned)
          ? 'The customer needs an invoice corrected to show the updated company name.'
          : 'The customer wants to know where to download their invoices.',
    };
  if (/password|log ?in|email|account|credentials/.test(cleaned))
    return {
      category: 'account',
      priority: /password|credentials|log ?in/.test(cleaned) ? 'medium' : 'low',
      summary: /password|credentials/.test(cleaned)
        ? 'The customer cannot sign in after resetting their password.'
        : 'The customer wants to change the email address associated with their account.',
    };
  return {
    category: 'other',
    priority: 'low',
    summary: /dark mode/.test(cleaned)
      ? 'The customer requests an optional dark mode for the dashboard.'
      : 'The ticket does not contain enough information to identify a specific support request.',
  };
}
export function injectionSuspected(text: string): boolean {
  return /ignore.{0,40}instructions|classify (?:it|this) as|from the CEO|system\s*:/i.test(text);
}
async function delay(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const done = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(done, ms);
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('Model request timed out'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}
export class JevModel implements LanguageModelV3 {
  readonly specificationVersion = 'v3' as const;
  readonly provider = 'local-jev';
  readonly modelId = 'jev-classifier-1';
  readonly supportedUrls = {};
  constructor(
    private ticket: TicketInput,
    private scenario: DemoScenario,
    private attempt: number,
    private delayMs: number,
  ) {}
  async doGenerate(options: LanguageModelV3CallOptions): Promise<LanguageModelV3GenerateResult> {
    await delay(this.scenario === 'timeout' ? 60000 : this.delayMs, options.abortSignal);
    const text =
      this.scenario === 'invalid-output'
        ? JSON.stringify({
            category: 'refund-approved',
            priority: 'critical',
            summary: 'Invalid output.',
          })
        : this.scenario === 'malformed-once' && this.attempt === 1
          ? '{"category": "billing", broken json'
          : JSON.stringify(classifyHeuristically(this.ticket));
    return {
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: 'stop' },
      warnings: [],
      usage: {
        inputTokens: { total: 120, noCache: 120, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 35, text: 35, reasoning: 0 },
      },
    };
  }
  async doStream(): Promise<never> {
    throw new Error('Jev classification uses non-streaming generation.');
  }
}
