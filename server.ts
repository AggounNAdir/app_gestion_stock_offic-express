import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { CORS_ORIGINS, PORT } from './src/server/config.ts';
import { initPostgresStore, syncStoreToPostgres } from './src/server/db/postgres.ts';
import { portalRouter } from './src/server/routes/portalApi.ts';
import { bureauRouter } from './src/server/routes/bureauApi.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  await initPostgresStore();

  const app = express();

  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || CORS_ORIGINS.includes(origin) || !isProd) {
          cb(null, true);
        } else {
          cb(null, true);
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '25mb' }));

  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        if (res.statusCode < 400) {
          void syncStoreToPostgres();
        }
      });
    }
    next();
  });

  // Bureau desktop-migrated API
  app.use('/api/bureau', bureauRouter);

  // Portal & Mobile API (available under /api/portal and at root for FastAPI compatibility)
  app.use('/api/portal', portalRouter);
  app.use((req, res, next) => {
    const wantsHtml =
      req.method === 'GET' &&
      !req.path.startsWith('/health') &&
      !req.headers.authorization &&
      (req.headers.accept || '').includes('text/html');
    if (wantsHtml) {
      next();
      return;
    }
    portalRouter(req, res, next);
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const idx = path.join(distDir, 'index.html');
      if (fs.existsSync(idx)) {
        res.sendFile(idx);
      } else {
        res.status(404).send('Build introuvable. Exécutez npm run build.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[Gestion de Stock] Serveur démarré sur http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('Erreur démarrage serveur:', err);
  process.exit(1);
});
