import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { createHash } from 'node:crypto';
import { config } from './config';
export const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
export const classificationQueue = new Queue('classification', { connection: redis, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: { age: 86400 }, removeOnFail: { age: 604800 } } });
export function jobId(ownerId: string, ticketId: string, version: number): string {
  return createHash('sha256').update(JSON.stringify([ownerId, ticketId, version])).digest('hex');
}
