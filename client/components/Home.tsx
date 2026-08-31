import { useState } from 'react';
import { navigate } from '../App';
import { createSession } from '../lib/api';
import { getSessions, removeSession, upsertSession, type StoredSession } from '../lib/storage';

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function Home() {
  const [sessions, setSessions] = useState<StoredSession[]>(getSessions());
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const sorted = [...sessions].sort((a, b) => b.lastVisitedAt.localeCompare(a.lastVisitedAt));

  async function handleCreate() {
    if (creating) return;
    setCreating(true);
    try {
      const session = await createSession(name.trim() || undefined);
      upsertSession({ token: session.id, name: session.name });
      navigate(`/s/${session.id}`);
    } catch {
      alert('No se pudo crear la lista. Inténtalo de nuevo.');
      setCreating(false);
    }
  }

  function handleRemove(token: string) {
    removeSession(token);
    setSessions(getSessions());
    setMenuOpen(null);
  }

  return (
    <div className="page">
      <header className="home-header">
        <h1>Listly</h1>
        <p className="subtitle">Tu lista de la compra compartida</p>
      </header>

      <div className="create-card">
        <input
          className="input"
          placeholder="Nombre de la lista (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        />
        <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
          {creating ? 'Creando…' : '➕ Crear compra'}
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          <p>No tienes listas en este dispositivo.</p>
          <p className="muted">Crea una o abre un enlace que te hayan compartido.</p>
        </div>
      ) : (
        <ul className="session-list">
          {sorted.map((s) => (
            <li key={s.token} className="session-row">
              <button className="session-link" onClick={() => navigate(`/s/${s.token}`)}>
                <span className="session-name">{s.name}</span>
                <span className="session-date">{formatDate(s.lastVisitedAt)}</span>
              </button>
              <div className="session-actions">
                <button
                  className="icon-btn"
                  onClick={() => setMenuOpen(menuOpen === s.token ? null : s.token)}
                  aria-label="Opciones"
                >
                  ⋯
                </button>
                {menuOpen === s.token && (
                  <div className="menu">
                    <button className="menu-item danger" onClick={() => handleRemove(s.token)}>
                      Quitar de mis listas
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
