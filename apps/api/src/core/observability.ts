import { initLogger, log } from 'evlog';
initLogger({ env: { service: 'loura-api' }, pretty: false });
export { log };
