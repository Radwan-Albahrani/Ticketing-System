import { ticketDetailSchema, ticketSchema } from '../packages/contracts/src';

const base = process.env.SMOKE_URL ?? 'http://127.0.0.1:8080';
let cookie = '';
async function request(path: string, body?: unknown) {
  const response = await fetch(base + '/api' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`Smoke request ${path} failed with HTTP ${response.status}.`);
  return response;
}
function readTicket(body: unknown) {
  if (!body || typeof body !== 'object' || !('ticket' in body))
    throw new Error('Missing ticket response.');
  return ticketSchema.parse(body.ticket);
}
await request('/health');
const login = await request('/auth/sign-in/email', {
  email: 'demo@loura.local',
  password: 'loura-demo-local-2026',
});
cookie = login.headers
  .getSetCookie()
  .map((header) => header.split(';')[0])
  .join('; ');
if (!cookie) throw new Error('The seeded demo account did not receive a session cookie.');
const input = {
  id: `ci-smoke-${Date.now()}`,
  subject: 'Production API returning 500s',
  body: 'Our production integration is blocked by HTTP 500 errors.',
};
const accepted = await request('/tickets', input);
if (accepted.status !== 202 || readTicket(await accepted.json()).status !== 'pending')
  throw new Error('Ingestion did not return a pending ticket.');
const duplicate: unknown = await (
  await request('/tickets', { ...input, subject: 'Changed duplicate' })
).json();
if (
  !duplicate ||
  typeof duplicate !== 'object' ||
  !('duplicate' in duplicate) ||
  duplicate.duplicate !== true ||
  readTicket(duplicate).subject !== input.subject
)
  throw new Error('Duplicate ingestion did not preserve the original ticket.');
const deadline = Date.now() + 20000;
let classified = false;
while (Date.now() < deadline) {
  const { ticket } = ticketDetailSchema.parse(await (await request(`/tickets/${input.id}`)).json());
  if (ticket.status === 'failed') throw new Error('The smoke ticket failed classification.');
  if (ticket.status === 'classified') {
    if (
      ticket.classification?.category !== 'technical' ||
      ticket.classification.priority !== 'high' ||
      ticket.attempts !== 1
    )
      throw new Error('Unexpected classification or duplicate processing.');
    classified = true;
    break;
  }
  await Bun.sleep(200);
}
if (!classified) throw new Error('Classification did not complete before the smoke-test deadline.');
console.log(
  'Smoke passed: seeded login, idempotent ingestion, and asynchronous validated classification.',
);
