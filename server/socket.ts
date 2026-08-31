import type { Server, Socket } from 'socket.io';
import type { Db } from './db';
import type { ItemPatch, PresenceUser } from '../shared/types';

interface Ack {
  (res?: { ok: boolean; error?: string }): void;
}

export function registerSocket(io: Server, db: Db): void {
  io.on('connection', (socket: Socket) => {
    let room: string | null = null;
    let nickname: string | null = null;

    socket.on('session:join', (payload, ack: Ack | undefined) => {
      const token = typeof payload?.token === 'string' ? payload.token : '';
      if (room) socket.leave(room);

      const session = db.getSession(token);
      if (!session) {
        ack?.({ ok: false, error: 'not_found' });
        return;
      }

      room = token;
      nickname = typeof payload?.nickname === 'string' ? payload.nickname.trim().slice(0, 30) : '';
      if (!nickname) nickname = null;
      socket.data.nickname = nickname;

      socket.join(token);
      db.touchSession(token);
      ack?.({ ok: true });
      void broadcastPresence(io, token);
    });

    socket.on('item:create', (payload, ack: Ack | undefined) => {
      if (!room) {
        ack?.({ ok: false, error: 'not_joined' });
        return;
      }
      const item = db.createItem(
        room,
        {
          text: payload?.text,
          quantity: payload?.quantity,
          price: payload?.price,
        },
        nickname,
      );
      if (!item) {
        ack?.({ ok: false, error: 'invalid' });
        return;
      }
      io.to(room).emit('item:upsert', item);
      ack?.({ ok: true });
    });

    socket.on('item:update', (payload, ack: Ack | undefined) => {
      if (!room) {
        ack?.({ ok: false, error: 'not_joined' });
        return;
      }
      const id = Number(payload?.id);
      if (!Number.isInteger(id)) {
        ack?.({ ok: false, error: 'invalid' });
        return;
      }
      const patch = (payload?.patch ?? {}) as ItemPatch;
      const item = db.updateItem(room, id, patch);
      if (!item) {
        ack?.({ ok: false, error: 'not_found' });
        return;
      }
      io.to(room).emit('item:upsert', item);
      ack?.({ ok: true });
    });

    socket.on('item:delete', (payload, ack: Ack | undefined) => {
      if (!room) {
        ack?.({ ok: false, error: 'not_joined' });
        return;
      }
      const id = Number(payload?.id);
      if (!Number.isInteger(id)) {
        ack?.({ ok: false, error: 'invalid' });
        return;
      }
      const deleted = db.deleteItem(room, id);
      if (!deleted) {
        ack?.({ ok: false, error: 'not_found' });
        return;
      }
      io.to(room).emit('item:deleted', { id });
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      if (room) void broadcastPresence(io, room);
    });
  });
}

async function broadcastPresence(io: Server, room: string): Promise<void> {
  const sockets = await io.in(room).fetchSockets();
  const users: PresenceUser[] = sockets.map((s) => ({
    nickname: (s.data.nickname as string | null) ?? 'Invitado',
  }));
  io.to(room).emit('presence:update', users);
}
