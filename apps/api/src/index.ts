import { app } from './app';
import { config } from './core/config';
import { pool } from './core/db';
import { log } from './core/observability';
const server = app.listen(config.PORT, '0.0.0.0', () =>
  log.info({ action: 'api.ready', port: config.PORT }),
);
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    void pool.end();
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
