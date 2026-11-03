import { Worker } from 'bullmq';
import { sql } from 'drizzle-orm';
import { db, pool } from './core/db';
import { config } from './core/config';
import { classificationQueue, redis, jobId } from './core/queue';
import { log } from './core/observability';
import { ClassificationService } from './api/classification/classification.service';
import type { ClassificationJob } from './api/classification/classification.types';

// PostgreSQL is the durable outbox. Redis delivery is retried until a job exists.
// Stable IDs close the crash window between queue.add and the next reconciliation.
let dispatching = false;
async function dispatch() {
  if (dispatching) return;
  dispatching = true;
  try {
    await redis.ping();
    const result = await db.execute<{ owner_id: string; ticket_id: string; version: number }>(sql`
      SELECT o.owner_id, o.ticket_id, o.version FROM classification_outbox o
      JOIN tickets t ON t.owner_id=o.owner_id AND t.id=o.ticket_id AND t.version=o.version
      WHERE t.status='pending' ORDER BY o.created_at LIMIT 500`);
    for (const row of result.rows) {
      const id = jobId(row.owner_id, row.ticket_id, row.version);
      const existing = await classificationQueue.getJob(id);
      if (existing) {
        const state = await existing.getState();
        if (state === 'failed' || state === 'completed') await existing.remove();
        else continue;
      }
      await classificationQueue.add(
        'classify',
        { ownerId: row.owner_id, ticketId: row.ticket_id, version: row.version },
        { jobId: id },
      );
    }
    await Bun.write('/tmp/loura-worker-health', String(Date.now()));
  } catch (error) {
    log.error({
      action: 'outbox.dispatch',
      errorType: error instanceof Error ? error.name : 'Unknown',
    });
  } finally {
    dispatching = false;
  }
}
const worker = new Worker<ClassificationJob>(
  'classification',
  async (job) => {
    await ClassificationService.process(job.data);
  },
  { connection: redis, concurrency: config.WORKER_CONCURRENCY, maxStalledCount: 2 },
);
worker.on('error', (error) => log.error({ action: 'worker.error', errorType: error.name }));
worker.on('failed', (job) =>
  log.warn({ action: 'worker.retry', jobId: job?.id, attempt: job?.attemptsMade }),
);
const timer = setInterval(() => void dispatch(), 1000);
await Bun.write('/tmp/loura-worker-health', '0');
await dispatch();
log.info({ action: 'worker.ready', concurrency: config.WORKER_CONCURRENCY });
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  clearInterval(timer);
  await worker.close();
  while (dispatching) await new Promise((resolve) => setTimeout(resolve, 50));
  await classificationQueue.close();
  await redis.quit();
  await pool.end();
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
