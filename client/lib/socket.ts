import { io, type Socket } from 'socket.io-client';
import type { Item, PresenceUser } from '../../shared/types';

export interface SocketHandlers {
  onConnect: () => void;
  onDisconnect: () => void;
  onItemUpsert: (item: Item) => void;
  onItemDeleted: (id: number) => void;
  onPresence: (users: PresenceUser[]) => void;
  onSessionRenamed: (name: string) => void;
  onSessionDeleted: () => void;
}

interface JoinAck {
  ok: boolean;
  error?: string;
}

export function connectSession(token: string, nickname: string, handlers: SocketHandlers): Socket {
  const socket = io();

  socket.on('connect', () => {
    handlers.onConnect();
    socket.emit('session:join', { token, nickname }, (res?: JoinAck) => {
      if (res && !res.ok) {
        socket.disconnect();
        if (res.error === 'not_found') handlers.onSessionDeleted();
      }
    });
  });

  socket.on('disconnect', () => handlers.onDisconnect());
  socket.on('item:upsert', (item: Item) => handlers.onItemUpsert(item));
  socket.on('item:deleted', (payload: { id: number }) => handlers.onItemDeleted(payload.id));
  socket.on('presence:update', (users: PresenceUser[]) => handlers.onPresence(users));
  socket.on('session:renamed', (payload: { name: string }) => handlers.onSessionRenamed(payload.name));
  socket.on('session:deleted', () => handlers.onSessionDeleted());

  return socket;
}
