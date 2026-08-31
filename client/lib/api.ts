import type { Session, SessionSnapshot } from '../../shared/types';

export class NotFoundError extends Error {}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 404) throw new NotFoundError();
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function createSession(name?: string): Promise<Session> {
  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function getSession(token: string): Promise<SessionSnapshot> {
  return request<SessionSnapshot>(`/api/sessions/${token}`);
}

export function renameSession(token: string, name: string): Promise<Session> {
  return request<Session>(`/api/sessions/${token}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function deleteSession(token: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/api/sessions/${token}`, { method: 'DELETE' });
}
