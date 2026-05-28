import Fastify from 'fastify';
import { expirePendingIntents } from './domain/store.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerIntentRoutes } from './routes/intents.js';

const app = Fastify({
  logger: true,
});

await registerHealthRoutes(app);
await registerIntentRoutes(app);

const expirySweep = setInterval(() => {
  expirePendingIntents();
}, 30_000);

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? '0.0.0.0';

const shutdown = async () => {
  clearInterval(expirySweep);
  await app.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port, host });
