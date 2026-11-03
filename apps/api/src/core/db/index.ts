import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config';
export const pool = new Pool({ connectionString: config.DATABASE_URL, max: 12, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
export const db = drizzle({ client: pool });
