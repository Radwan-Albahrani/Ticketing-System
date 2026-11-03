import { eq } from 'drizzle-orm';
import { db, pool } from './index';
import { user } from './schema';
import { auth } from '../auth';
const [existing] = await db
  .select({ id: user.id })
  .from(user)
  .where(eq(user.email, 'demo@loura.local'));
if (!existing)
  await auth.api.signUpEmail({
    body: { email: 'demo@loura.local', password: 'loura-demo-local-2026', name: 'Alex Morgan' },
  });
await pool.end();
