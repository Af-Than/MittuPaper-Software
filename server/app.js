import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  // Trust X-Forwarded-For only from a local reverse proxy (Vite dev proxy / nginx on the same host)
  app.set('trust proxy', 'loopback');

  app.use(helmet({ contentSecurityPolicy: env.isProd ? undefined : false }));
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '200kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', routes);
  app.use('/api', notFoundHandler);

  // In production the built React app is served by the same server
  const dist = path.resolve(__dirname, '../client/dist');
  if (env.isProd && fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
