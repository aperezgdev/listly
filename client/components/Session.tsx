import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { navigate } from '../App';
import { deleteSession, getSession, renameSession } from '../lib/api';
import { connectSession } from '../lib/socket';
import { getNickname, removeSession, setNickname, upsertSession } from '../lib/storage';
import type { Item, PresenceUser, SortField, SortOption } from '../../shared/types';
import AddItem from './AddItem';
import ItemRow from './ItemRow';

type Status = 'loading' | 'notfound' | 'ready' | 'deleted';

const SORT_OPTIONS: { value: string; label: string; option: SortOption }[] = [
  { value: 'created', label: 'Creación', option: { field: 'created', direction: 'asc' } },
  { value: 'name', label: 'Nombre A-Z', option: { field: 'name', direction: 'asc' } },
  { value: 'quantity', label: 'Cantidad', option: { field: 'quantity', direction: 'desc' } },
  { value: 'price-asc', label: 'Precio ↑', option: { field: 'price', direction: 'asc' } },
  { value: 'price-desc', label: 'Precio ↓', option: { field: 'price', direction: 'desc' } },
];

function upsertItem(items: Item[], item: Item): Item[] {
  const idx = items.findIndex((i) => i.id === item.id);
  if (idx === -1) return [...items, item];
  const copy = items.slice();
  copy[idx] = item;
  return copy;
}

function itemComparator(field: SortField, dir: SortOption['direction']) {
  return (a: Item, b: Item): number => {
    let cmp: number;
    switch (field) {
      case 'name':
        cmp = a.text.localeCompare(b.text, 'es', { sensitivity: 'base' });
        break;
      case 'quantity':
        cmp = a.quantity - b.quantity;
        break;
      case 'price': {
        const aNull = a.price == null;
        const bNull = b.price == null;
        if (aNull && bNull) return 0;
        if (aNull) return 1;
        if (bNull) return -1;
        cmp = a.price! - b.price!;
        return dir === 'asc' ? cmp : -cmp;
      }
      default:
        cmp = a.createdAt.localeCompare(b.createdAt);
        break;
    }
    return dir === 'asc' ? cmp : -cmp;
  };
}

export default function Session({ token }: { token: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [sessionName, setSessionName] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(true);
  const [search, setSearch] = useState('');
  const [sortValue, setSortValue] = useState('created');

  const [nickname, setNicknameState] = useState(getNickname());
  const [nicknameResolved, setNicknameResolved] = useState(getNickname() !== '');
  const [nicknameDraft, setNicknameDraft] = useState('');

  const [renaming, setRenaming] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');

  const socketRef = useRef<Socket | null>(null);

  const refetch = useCallback(async () => {
    try {
      const snap = await getSession(token);
      setSessionName(snap.name);
      setItems(snap.items);
      upsertSession({ token, name: snap.name });
    } catch {
      /* ignorado: se gestiona en la carga inicial y en el evento session:deleted */
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getSession(token)
      .then((snap) => {
        if (cancelled) return;
        setSessionName(snap.name);
        setItems(snap.items);
        upsertSession({ token, name: snap.name });
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== 'ready' || !nicknameResolved) return;
    const socket = connectSession(token, nickname, {
      onConnect: () => {
        setConnected(true);
        void refetch();
      },
      onDisconnect: () => setConnected(false),
      onItemUpsert: (item) => setItems((prev) => upsertItem(prev, item)),
      onItemDeleted: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
      onPresence: setPresence,
      onSessionRenamed: (name) => {
        setSessionName(name);
        upsertSession({ token, name });
      },
      onSessionDeleted: () => {
        setStatus('deleted');
        removeSession(token);
      },
    });
    socketRef.current = socket;
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [status, nicknameResolved, nickname, token, refetch]);

  const sort = SORT_OPTIONS.find((o) => o.value === sortValue)?.option ?? SORT_OPTIONS[0].option;

  const { pending, done } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? items.filter((i) => i.text.toLowerCase().includes(q)) : items;
    const pending = filtered
      .filter((i) => !i.checked)
      .sort(itemComparator(sort.field, sort.direction));
    const done = filtered
      .filter((i) => i.checked)
      .sort(
        sort.field === 'created'
          ? (a, b) => b.updatedAt.localeCompare(a.updatedAt)
          : itemComparator(sort.field, sort.direction),
      );
    return { pending, done };
  }, [items, search, sort]);

  function emit(event: string, payload: unknown) {
    if (socketRef.current?.connected) socketRef.current.emit(event, payload);
  }

  function handleAdd(text: string) {
    emit('item:create', { text });
  }

  function handleUpdate(id: number, patch: Partial<Item>) {
    emit('item:update', { id, patch });
  }

  function handleDelete(id: number) {
    emit('item:delete', { id });
  }

  async function handleRenameSubmit() {
    const name = renameDraft.trim();
    if (!name) {
      setRenaming(false);
      return;
    }
    try {
      const updated = await renameSession(token, name);
      setSessionName(updated.name);
      upsertSession({ token, name: updated.name });
    } catch {
      /* ignorado */
    }
    setRenaming(false);
  }

  async function handleDeleteList() {
    if (!window.confirm('¿Borrar esta lista para todos? Esta acción no se puede deshacer.')) return;
    try {
      await deleteSession(token);
    } catch {
      /* el evento session:deleted del servidor actualiza el estado */
    }
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: sessionName,
          text: `Únete a mi lista de la compra: ${sessionName}`,
          url,
        });
      } catch {
        /* cancelado por el usuario */
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert('Enlace copiado');
      } catch {
        /* sin permisos de portapapeles */
      }
    }
  }

  function handleNicknameSubmit() {
    const name = nicknameDraft.trim().slice(0, 30);
    setNickname(name);
    setNicknameState(name);
    setNicknameResolved(true);
  }

  if (status === 'loading') {
    return (
      <div className="page center">
        <p>Cargando…</p>
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="page center">
        <h1>Lista no encontrada</h1>
        <p className="muted">El enlace no existe o fue borrado.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Ir al inicio
        </button>
      </div>
    );
  }

  if (status === 'deleted') {
    return (
      <div className="page center">
        <h1>Lista borrada</h1>
        <p className="muted">Esta lista ya no existe.</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          Ir al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="page session-page">
      <header className="session-header">
        <button className="icon-btn" onClick={() => navigate('/')} aria-label="Volver">
          ←
        </button>

        {renaming ? (
          <form
            className="rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleRenameSubmit();
            }}
          >
            <input
              className="input"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onBlur={() => void handleRenameSubmit()}
              autoFocus
            />
          </form>
        ) : (
          <button
            className="session-title"
            onClick={() => {
              setRenameDraft(sessionName);
              setRenaming(true);
            }}
            title="Renombrar"
          >
            {sessionName}
          </button>
        )}

        <button className="icon-btn" onClick={() => void handleShare()} aria-label="Compartir">
          🔗
        </button>
        <button className="icon-btn" onClick={() => void handleDeleteList()} aria-label="Borrar lista">
          🗑
        </button>
      </header>

      {!connected && <div className="banner offline">Sin conexión · Reconectando…</div>}

      <div className="presence-bar">
        <span className="presence-count">👥 {presence.length > 0 ? presence.length : 'Solo tú'}</span>
        {presence.length > 0 && (
          <span className="presence-names">{presence.map((u) => u.nickname).join(', ')}</span>
        )}
      </div>

      <div className="controls">
        <input
          className="input search"
          placeholder="Buscar…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          value={sortValue}
          onChange={(e) => setSortValue(e.target.value)}
          aria-label="Ordenar"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <ul className="items">
        {pending.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            disabled={!connected}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        {done.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            disabled={!connected}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
          />
        ))}
        {pending.length === 0 && done.length === 0 && (
          <li className="empty-items">No hay nada apuntado todavía.</li>
        )}
      </ul>

      <AddItem onAdd={handleAdd} disabled={!connected} />

      {!nicknameResolved && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>¿Cómo te llamas?</h2>
            <p className="muted">Para saber quién apunta cada cosa.</p>
            <input
              className="input"
              placeholder="Tu nombre (opcional)"
              value={nicknameDraft}
              onChange={(e) => setNicknameDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNicknameSubmit()}
              autoFocus
            />
            <button className="btn btn-primary" onClick={handleNicknameSubmit}>
              Entrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
