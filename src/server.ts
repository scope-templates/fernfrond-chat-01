import express from 'express';
import { prisma } from './db';
import { buildRouter, errorHandler } from './routes';

export function createApp(db = prisma) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', buildRouter(db));
  app.use(errorHandler);

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Fern & Frond support API listening on :${port}`);
  });
}
