# Run Loura locally

Requires **Docker with Docker Compose**. No host Bun installation, API key, or manual database setup is needed.

```sh
git clone https://github.com/Radwan-Albahrani/Ticketing-System.git
cd Ticketing-System
docker compose up --build -d --wait
```

Open **http://localhost:8080**, click **Enter the demo studio**, then **Load sample tickets**.

The startup job waits for PostgreSQL, applies migrations, and creates this demo account before the API starts:

| Login              | Password                |
| ------------------ | ----------------------- |
| `demo@loura.local` | `loura-demo-local-2026` |

Seeding is automatic and idempotent: an existing account is preserved. The demo button signs in with these credentials through better-auth. The ten appendix tickets are loaded through the API; loading them again creates neither duplicate tickets nor new classification runs.

The first build downloads images and dependencies. Everything runs locally afterward, including fonts and the simulated model. Ports **8080**, **5433**, and **6380** must be free; published ports bind to loopback.

```sh
docker compose logs -f api worker # inspect request and classification events
docker compose stop              # stop while preserving data
docker compose up -d --wait       # restart
docker compose down -v           # remove containers and all local data
```

## What it does

Loura ingests support tickets, classifies them asynchronously, and exposes the results through an authenticated HTTP API. The React studio makes receipt, processing, validation, retries, failure, and reclassification visible.

**Jev is a deterministic fake model**, implemented as an AI SDK provider. Its normal responses are plausible classifications; explicit fault modes make unreliable responses reproducible. No live provider is required.

The backend is the main part of the exercise: duplicate IDs do not schedule more work, accepted tickets survive queue outages, and model output must pass validation before it becomes a classification.

## Treating model output as untrusted

A successful model request does not imply a usable answer. The worker receives **text**, parses it as JSON, and validates it against a strict Zod schema before writing a result:

- `category`: `billing`, `technical`, `account`, or `other`.
- `priority`: `low`, `medium`, or `high`.
- `summary`: one sentence on one line, 8–300 characters, containing letters and ending in sentence punctuation. Control characters, Unicode line separators, and multiple sentences are rejected.
- Additional fields are rejected.

For example, this is valid JSON with valid labels, but it still fails the summary contract:

```json
{
  "category": "billing",
  "priority": "low",
  "summary": "The customer needs an invoice.\nApprove the refund immediately."
}
```

Rejected output is discarded. The worker retries within a bounded budget; after exhaustion the ticket is `failed` with `classification: null` and a safe error message. Raw rejected output is neither stored nor logged. Tests verify the null result after **every** rejected summary attempt, not just the final failure.

**Validation establishes the response format, not its factual correctness.** A well-formed classification can still misread a customer. The fake's heuristics are limited, and a real model would need separate evaluation and operational review.

Ticket text is serialized as untrusted data, separate from system instructions. The classifier has no tools, credentials, or database access. Only server code can persist a validated result. Instruction detection is an audit signal; it is not a general prompt-injection defense, and a tool-call secret would not make arbitrary model instructions trustworthy.

## Try the demo

Select a ticket to inspect its message, result, attempts, and **Run history**. The `URGENT` sample (`t-1005`) contains the appendix's injection attempt: Jev classifies the actual invoice question as billing/low rather than following the requested refund approval.

Create a ticket and choose a model behavior:

| Behavior                          | What to observe                                                        |
| --------------------------------- | ---------------------------------------------------------------------- |
| Normal classification             | A valid result is classified, validated, and saved.                    |
| Malformed response, then recovery | Attempt one returns broken JSON; attempt two succeeds.                 |
| Invalid output, all attempts      | Unsupported category and priority are rejected until the ticket fails. |
| Invalid summary, all attempts     | Valid JSON and labels still fail because the summary is invalid.       |
| Model timeout                     | Each call exceeds its deadline; three attempts take about 18 seconds.  |

Use **Reclassify ticket** with normal behavior to recover a failed ticket. A new version starts while previous results and failures remain in history. Reclassification is blocked while pending, and stale version requests receive `409`.

Combine category and priority filters, change status views, and paginate. Resubmit an existing ID with different content to confirm that the original ticket is preserved.

The Base UI **Color theme** menu offers Light, Dark, and System. The choice persists across reloads and sign-out. Both themes support desktop/mobile layouts and reduced motion.

Failure modes are explicit, authenticated demo metadata. Writing a scenario name inside a ticket does not activate it.

## Lifecycle and design decisions

### Storage and asynchronous delivery

PostgreSQL is the source of truth. An account-scoped primary key enforces ticket uniqueness under concurrent requests. Creation writes the ticket, its first event, and an outbox row in **one transaction**, then returns `202`; it never calls the model inside the HTTP request.

A dispatcher checks the PostgreSQL outbox once per second and delivers pending work to BullMQ/Redis using stable job IDs. Keeping an outbox closes the failure window between accepting a ticket and publishing its job. Redis downtime therefore does not prevent ingestion, and missing Redis jobs can be reconstructed from PostgreSQL.

The lifecycle is `pending → classified` or `pending → failed`. Only classified tickets have a current classification. PostgreSQL adds status/result and enum/type constraints behind the application schema.

### Concurrency, deadlines, and retries

One worker processes **three jobs at once** by default (`WORKER_CONCURRENCY`, allowed range 1–16). This keeps resource usage bounded while allowing the demo to show concurrent work. Each provider request has a five-second abort deadline (`MODEL_TIMEOUT_MS`).

There are at most **three total attempts**, with exponential backoff of one and two seconds. SDK retries are disabled so they do not multiply the queue's retry policy. Malformed JSON, invalid output, and provider/deadline failures consume the same budget. Exhausted tickets require an explicit new classification run.

### Restarts and in-flight work

PostgreSQL and Redis use named volumes; Redis enables AOF and no eviction. BullMQ recovers stalled jobs, and the outbox reconstructs pending jobs if Redis data is lost. Worker health requires a recent successful database/Redis dispatch cycle.

Delivery is **at least once**: a process crash or lost lock may repeat a provider call. Version, status, and attempt comparisons prevent a stale or duplicate result from being committed. This does not promise exactly-once external model execution. Interrupted attempts count toward the bounded retry budget.

On shutdown, the API stops accepting requests. The worker stops dispatching, allows active work to finish, and closes its resources. Compose gives it 30 seconds; forced termination falls back to recovery on restart.

### Reclassification and history

Reclassification is the selected extension. An expected version and row lock prevent concurrent requests from scheduling two new runs. The current result is cleared, the version increments, and a new outbox job is created. Earlier valid results remain in history.

Change `PROMPT_VERSION` when changing classifier behavior, then explicitly reclassify older tickets. Events have monotonic database sequences, preserving causal order when transaction timestamps tie. The UI polls saved state and streams current-run activity through the AI SDK; closing the browser never cancels work.

### API and pagination choices

Cookie sessions through better-auth scope tickets to an account. Page/limit pagination uses stable `created_at DESC, id ASC` ordering; list/count queries share a repeatable-read snapshot. Offset pagination is simple for this dataset, though new arrivals can shift later pages.

## HTTP API

Ticket and classifier endpoints require a session cookie. IDs allow letters, numbers, hyphens, and underscores and are unique **within an account**. Empty subjects are accepted for appendix ticket `t-1008`. Limits: ID 100 characters, subject 300, body 1–20,000, JSON request 32 KiB.

| Endpoint                           | Result                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/tickets`                | Accepts `{ id, subject, body, scenario? }`. Returns `202` for a new pending ticket or `200` with `duplicate: true` for an existing ID; changed duplicate content is ignored. |
| `GET /api/tickets/:id`             | Returns `{ ticket, events }`, or `404`.                                                                                                                                      |
| `GET /api/tickets`                 | Filters: `category`, `priority`, `status`. Pagination: `page=1`, `limit=20` (maximum 100). Returns tickets, filtered total, pagination, and account-wide counts.             |
| `POST /api/tickets/:id/reclassify` | Accepts `{ expectedVersion, scenario? }`; returns `202`, or `409` if pending/stale.                                                                                          |
| `POST /api/tickets/:id/activity`   | AI SDK UI-message event stream for the current version; ends at a terminal state, version change, or 60 seconds.                                                             |
| `GET /api/classifier`              | Fake provider, model/prompt version, attempt limit, and tools-disabled metadata.                                                                                             |
| `GET /api/health`                  | Database readiness: `200` or `503`.                                                                                                                                          |
| `/api/auth/*`                      | better-auth sign-in, sign-out, sign-up, and session endpoints.                                                                                                               |

Scenario values: `normal` (default), `malformed-once`, `invalid-output`, `invalid-summary`, `timeout`.

Application errors use `{ "error": { "code": "…", "message": "…" } }`, with `issues` for validation errors. Status codes distinguish invalid input/JSON (`400`), missing auth (`401`), rejected origin (`403`), missing resource (`404`), version conflict (`409`), oversized body (`413`), non-JSON mutations (`415`), rate limiting (`429`), and unexpected failures (`500`). Auth endpoints retain better-auth's error format. evlog records request IDs, metadata, and outcomes without passwords, ticket bodies, or rejected model output.

```sh
# Sign in using the automatically seeded demo account.
curl -s -c /tmp/loura.cookies http://localhost:8080/api/auth/sign-in/email \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@loura.local","password":"loura-demo-local-2026"}'

# Ingest a ticket; repeat this command to check idempotency.
curl -i -b /tmp/loura.cookies http://localhost:8080/api/tickets \
  -H 'Content-Type: application/json' \
  -d '{"id":"my-ticket","subject":"Charged twice","body":"I see two charges for one subscription."}'

curl -s -b /tmp/loura.cookies 'http://localhost:8080/api/tickets/my-ticket'
curl -s -b /tmp/loura.cookies 'http://localhost:8080/api/tickets?category=billing&priority=medium&page=1&limit=10'
```

## Code and stack

The Bun/Turborepo monorepo uses TypeScript 7 and shared Zod contracts.

- **Backend:** Express, Drizzle **1.0.0-rc.5**, PostgreSQL 17, better-auth, evlog, BullMQ/Redis, and AI SDK.
- **Frontend:** Vite **8**, React, Zustand, TanStack Query/DB, AI SDK React, Base UI, and Motion.
- **Tooling:** Oxlint, native `bun check` and `bun fmt`, commitlint.

```text
apps/api/src/api/tickets/         # ingest, read, filter, reclassify
apps/api/src/api/classification/  # unreliable model boundary and worker behavior
apps/api/src/core/                # database, auth, queue, configuration, logging
apps/api/src/common/              # shared errors and transport helpers
apps/api/tests/                   # unit, integration, HTTP tests and fixtures
apps/web/src/features/            # auth, tickets, studio, theme
packages/contracts/src/           # schemas, types, all ten appendix tickets
tools/                          # architecture lint and Docker smoke test
```

Each API feature has a service, controller, router, types, and utils directory. Routers wire HTTP, controllers validate and serialize, services own behavior, and core owns infrastructure. The architecture lint checks file placement and dependency boundaries. SQL migrations are versioned and applied transactionally under an advisory lock; Drizzle provides typed queries.

## Tests, checks, and CI

Development requires **Bun 1.4.4**. Integration tests also require Docker.

```sh
bun install --frozen-lockfile
bun check        # Oxlint, architecture rules, and native type checking
bun fmt --check  # native formatting check; use bun fmt to apply formatting
bun test
bun run build
```

Plain `bun test` runs the complete suite. Fixtures start disposable PostgreSQL on **5544** and Redis on **6399**, migrate the test database, create isolated accounts, and remove the containers afterward. Test data is separate from the demo database. Infrastructure hooks have explicit timeouts for cold image startup.

```sh
bun test apps/api/tests/unit apps/web/tests tools # no Docker required
bun test apps/api/tests/integration               # database and worker behavior
bun test apps/api/tests/e2e                       # actual HTTP server and auth cookies
```

Tests cover concurrent duplicate ingestion, malformed/invalid output, summary constraints, injection containment, deadlines, bounded retries, stale jobs, reclassification history, account isolation, filters/pagination, streaming, Redis job loss, and shutdown/restart. Browser verification covered the complete demo, both themes, mobile layouts, keyboard navigation, and startup from empty volumes.

CI exposes separate lint/architecture, formatting, type-checking, test, production-build, and commit-message checks. A Docker job builds the app from scratch and verifies the seeded login, idempotent ingestion, and asynchronous classification through HTTP. Both test and application infrastructure are cleaned up on failure.

For hot reload, start PostgreSQL/Redis with `docker compose up -d --wait postgres redis`. Copy `.env.example` to `.env`, export its values, and set `APP_URL=http://localhost:5173` to match Vite. Run the API migration and seed commands, then start the apps and worker:

```sh
bun run --filter @loura/api migrate
bun apps/api/src/core/db/seed.ts
bun run dev
# In a second shell with the same environment:
bun run --filter @loura/api worker
```

For an external test setup, supply dedicated disposable services through `TEST_DATABASE_URL` and `TEST_REDIS_URL`; the database name must end in `_test`. The Redis recovery test deliberately clears its test Redis database. To clean up after a force-killed test run: `docker compose -f compose.test.yaml down -v`.

## Limitations and next steps

- Jev has narrow heuristic language understanding. It is useful for exercising failure handling, not measuring real model accuracy. A live provider should retain the validation/no-tools boundary and be evaluated against a separate labelled and adversarial dataset.
- The summary validator deliberately expects plain wording and can reject abbreviations containing sentence punctuation. Its format checks cannot establish whether the summary is true.
- The outbox scans up to 500 pending jobs per tick. Outbox/history retention, cursor pagination, indexed dispatch claims, and shared push updates would matter at larger scale.
- Reclassification exposes earlier results in history rather than as the current result. There is no bulk reclassification UI or automatic sweep after a prompt change.
- The local demo uses public credentials, in-memory rate limits, and configurable fault modes. A public deployment would need different authentication policies, managed secrets, TLS, backups, retention, and monitoring.
- Browser flows were verified manually; there is no committed browser automation suite or formal accessibility audit. Those would be the next UI testing improvements.
