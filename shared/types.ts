export interface Session {
  id: string;
  name: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface Item {
  id: number;
  sessionId: string;
  text: string;
  quantity: number;
  price: number | null;
  checked: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSnapshot {
  id: string;
  name: string;
  items: Item[];
}

export interface PresenceUser {
  nickname: string;
}

export interface ItemPatch {
  text?: string;
  quantity?: number;
  price?: number | null;
  checked?: boolean;
}

export type SortField = 'created' | 'name' | 'quantity' | 'price';
export type SortDirection = 'asc' | 'desc';

export interface SortOption {
  field: SortField;
  direction: SortDirection;
}
