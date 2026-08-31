import Database from 'better-sqlite3';
import { randomBytes } from 'crypto';
import { mkdirSync } from 'fs';
import { join } from 'path';
import type { Item, ItemPatch, Session, SessionSnapshot } from '../shared/types';

interface SessionRow {
  id: string;
  name: string;
  created_at: string;
  last_active_at: string;
}

interface ItemRow {
  id: number;
  session_id: string;
  text: string;
  quantity: number;
  price: number | null;
  checked: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Db {
  createSession(name: string | undefined): Session;
  getSession(token: string): Session | null;
  getSnapshot(token: string): SessionSnapshot | null;
  renameSession(token: string, name: string): Session | null;
  deleteSession(token: string): boolean;
  touchSession(token: string): void;
  createItem(
    token: string,
    input: { text?: string; quantity?: number; price?: number | null },
    createdBy: string | null,
  ): Item | null;
  updateItem(token: string, id: number, patch: ItemPatch): Item | null;
  deleteItem(token: string, id: number): boolean;
}

export function generateToken(): string {
  // 9 bytes = 12 caracteres base64url (~72 bits de entropía)
  return randomBytes(9).toString('base64url');
}

function mapSession(row: SessionRow): Session {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
  };
}

function mapItem(row: ItemRow): Item {
  return {
    id: row.id,
    sessionId: row.session_id,
    text: row.text,
    quantity: row.quantity,
    price: row.price,
    checked: row.checked === 1,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function defaultSessionName(ts: string): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `Compra del ${date}, ${time}`;
}

function normalizeQuantity(q: number | undefined): number {
  if (typeof q !== 'number' || !Number.isFinite(q)) return 1;
  const rounded = Math.round(q);
  if (rounded < 1) return 1;
  if (rounded > 999) return 999;
  return rounded;
}

function normalizePrice(p: number | null | undefined): number | null {
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  const rounded = Math.round(p * 100) / 100;
  if (rounded < 0) return null;
  return rounded;
}

export function createDb(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const db = new Database(join(dataDir, 'listly.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_active_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL,
      checked INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_items_session ON items(session_id);
  `);

  const now = () => new Date().toISOString();

  const stmts = {
    insertSession: db.prepare(
      'INSERT INTO sessions (id, name, created_at, last_active_at) VALUES (?, ?, ?, ?)',
    ),
    getSession: db.prepare('SELECT * FROM sessions WHERE id = ?'),
    renameSession: db.prepare('UPDATE sessions SET name = ? WHERE id = ?'),
    touchSession: db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    getItems: db.prepare('SELECT * FROM items WHERE session_id = ? ORDER BY id ASC'),
    insertItem: db.prepare(
      'INSERT INTO items (session_id, text, quantity, price, checked, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?)',
    ),
    getItem: db.prepare('SELECT * FROM items WHERE id = ? AND session_id = ?'),
    updateText: db.prepare('UPDATE items SET text = ?, updated_at = ? WHERE id = ? AND session_id = ?'),
    updateQuantity: db.prepare(
      'UPDATE items SET quantity = ?, updated_at = ? WHERE id = ? AND session_id = ?',
    ),
    updatePrice: db.prepare(
      'UPDATE items SET price = ?, updated_at = ? WHERE id = ? AND session_id = ?',
    ),
    updateChecked: db.prepare(
      'UPDATE items SET checked = ?, updated_at = ? WHERE id = ? AND session_id = ?',
    ),
    deleteItem: db.prepare('DELETE FROM items WHERE id = ? AND session_id = ?'),
  };

  return {
    createSession(name) {
      const token = generateToken();
      const ts = now();
      const sessionName = name && name.trim() ? name.trim() : defaultSessionName(ts);
      stmts.insertSession.run(token, sessionName, ts, ts);
      return { id: token, name: sessionName, createdAt: ts, lastActiveAt: ts };
    },

    getSession(token) {
      const row = stmts.getSession.get(token) as SessionRow | undefined;
      return row ? mapSession(row) : null;
    },

    getSnapshot(token) {
      const session = stmts.getSession.get(token) as SessionRow | undefined;
      if (!session) return null;
      const items = (stmts.getItems.all(token) as ItemRow[]).map(mapItem);
      return { id: session.id, name: session.name, items };
    },

    renameSession(token, name) {
      const clean = name && name.trim() ? name.trim() : defaultSessionName(now());
      stmts.renameSession.run(clean, token);
      const row = stmts.getSession.get(token) as SessionRow | undefined;
      return row ? mapSession(row) : null;
    },

    deleteSession(token) {
      return stmts.deleteSession.run(token).changes > 0;
    },

    touchSession(token) {
      stmts.touchSession.run(now(), token);
    },

    createItem(token, input, createdBy) {
      const text = (input.text || '').trim();
      if (!text) return null;
      const quantity = normalizeQuantity(input.quantity);
      const price = normalizePrice(input.price);
      const ts = now();
      const info = stmts.insertItem.run(token, text, quantity, price, createdBy, ts, ts);
      const row = stmts.getItem.get(info.lastInsertRowid, token) as ItemRow | undefined;
      return row ? mapItem(row) : null;
    },

    updateItem(token, id, patch) {
      const existing = stmts.getItem.get(id, token) as ItemRow | undefined;
      if (!existing) return null;
      const ts = now();

      if (typeof patch.text === 'string') {
        const text = patch.text.trim();
        if (text) stmts.updateText.run(text, ts, id, token);
      }
      if (typeof patch.quantity === 'number') {
        stmts.updateQuantity.run(normalizeQuantity(patch.quantity), ts, id, token);
      }
      if ('price' in patch) {
        stmts.updatePrice.run(normalizePrice(patch.price), ts, id, token);
      }
      if (typeof patch.checked === 'boolean') {
        stmts.updateChecked.run(patch.checked ? 1 : 0, ts, id, token);
      }

      const row = stmts.getItem.get(id, token) as ItemRow | undefined;
      return row ? mapItem(row) : null;
    },

    deleteItem(token, id) {
      return stmts.deleteItem.run(id, token).changes > 0;
    },
  };
}
