import type { FastifyInstance } from 'fastify';
import type { Server } from 'socket.io';
import type { Db } from './db';

export function registerApi(app: FastifyInstance, db: Db, io: Server): void {
  app.get('/healthz', async () => ({ ok: true }));

  app.post('/api/sessions', async (req, reply) => {
    const body = (req.body ?? {}) as { name?: string };
    const session = db.createSession(body.name);
    reply.code(201);
    return session;
  });

  app.get('/api/sessions/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const snapshot = db.getSnapshot(token);
    if (!snapshot) return reply.code(404).send({ error: 'not_found' });
    return snapshot;
  });

  app.patch('/api/sessions/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const body = (req.body ?? {}) as { name?: string };
    const session = db.renameSession(token, body.name ?? '');
    if (!session) return reply.code(404).send({ error: 'not_found' });
    io.to(token).emit('session:renamed', { name: session.name });
    return session;
  });

  app.delete('/api/sessions/:token', async (req, reply) => {
    const { token } = req.params as { token: string };
    const deleted = db.deleteSession(token);
    if (!deleted) return reply.code(404).send({ error: 'not_found' });
    io.to(token).emit('session:deleted');
    io.in(token).disconnectSockets(true);
    return { ok: true };
  });
}
