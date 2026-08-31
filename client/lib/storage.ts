export interface StoredSession {
  token: string;
  name: string;
  lastVisitedAt: string;
}

const SESSIONS_KEY = 'listly:sessions';
const NICKNAME_KEY = 'listly:nickname';

export function getSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is StoredSession => s && typeof s.token === 'string' && typeof s.name === 'string',
    );
  } catch {
    return [];
  }
}

export function saveSessions(sessions: StoredSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

export function upsertSession(entry: { token: string; name: string }): void {
  const sessions = getSessions().filter((s) => s.token !== entry.token);
  sessions.unshift({ token: entry.token, name: entry.name, lastVisitedAt: new Date().toISOString() });
  saveSessions(sessions);
}

export function removeSession(token: string): void {
  saveSessions(getSessions().filter((s) => s.token !== token));
}

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || '';
}

export function setNickname(name: string): void {
  if (name) localStorage.setItem(NICKNAME_KEY, name);
  else localStorage.removeItem(NICKNAME_KEY);
}
