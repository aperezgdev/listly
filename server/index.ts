import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import { resolve } from 'path';
import { createDb } from './db';
import { registerApi } from './routes';
import { registerSocket } from './socket';

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || resolve(process.cwd(), 'data');
const DIST_DIR = resolve(process.cwd(), 'dist');

const db = createDb(DATA_DIR);

const app = Fastify({ logger: true });

void app.register(fastifyStatic, {
  root: DIST_DIR,
});

const io = new Server(app.server, {
  serveClient: false,
});

registerApi(app, db, io);
registerSocket(io, db);

// SPA fallback: rutas de la app → index.html; el resto → 404
app.setNotFoundHandler((req, reply) => {
  const url = (req.raw.url || '').split('?')[0];
  if (url.startsWith('/api/') || url === '/healthz' || /\.[a-zA-Z0-9]+$/.test(url)) {
    return reply.code(404).send({ error: 'not_found' });
  }
  return reply.sendFile('index.html');
});

app
  .listen({ port: PORT, host: '0.0.0.0' })
  .then(() => app.log.info(`Listly escuchando en :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
