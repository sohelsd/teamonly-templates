// Types shared by the API (src/worker) and the UI (src/client).

export type Item = {
  id: number;
  sku: string;
  name: string;
  location: string;
  qty: number;
  reorder_level: number;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type Reason = 'received' | 'used' | 'damaged' | 'count' | 'new_item' | 'import';

export type Movement = {
  id: number;
  item_id: number;
  change: number;
  qty_after: number;
  reason: Reason;
  note: string;
  by_email: string;
  by_name: string;
  created_at: string;
  sku?: string;
  name?: string;
};

/** Reasons a person can pick when changing a count. */
export const ADJUST_REASONS = ['used', 'received', 'damaged', 'count'] as const;
export type AdjustReason = (typeof ADJUST_REASONS)[number];

export const REASON_LABELS: Record<Reason, string> = {
  received: 'Received',
  used: 'Used or sent out',
  damaged: 'Damaged or lost',
  count: 'Counted',
  new_item: 'New item',
  import: 'Import',
};

export type ImportRow = { sku: string; name: string; location: string; qty: number; reorder_level: number };
export type ImportResult = { added: number; updated: number; unchanged: number };
export type Summary = { items: number; low: number; out: number; changes_today: number };

export const ROLES = [
  { id: 'admin', label: 'Admin', plural: 'Admins', help: 'Import from a spreadsheet, delete items and change this list. Everyone else can look up items, add them and change counts.' },
] as const;
export type Role = (typeof ROLES)[number]['id'];
export type RoleRow = { email: string; role: Role; added_by: string; added_at: string };

export type Me = { email: string; name: string; isOwner: boolean; owner: string | null; roles: Role[] };
