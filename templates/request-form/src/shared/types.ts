// Types shared by the API (src/worker) and the UI (src/client).

export const STATUSES = ['new', 'in_progress', 'done'] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABELS: Record<Status, string> = { new: 'New', in_progress: 'In progress', done: 'Done' };

export type Request = {
  id: number;
  title: string;
  details: string;
  needed_by: string | null;
  status: Status;
  reply: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
  done_at: string | null;
};

export type QueueCounts = Record<Status, number>;

export const ROLES = [
  { id: 'handler', label: 'Handles requests', plural: 'Handle requests', help: 'See every request, change its status, assign it and reply.' },
  { id: 'admin', label: 'Admin', plural: 'Admins', help: 'Change who has which role on this page.' },
] as const;
export type Role = (typeof ROLES)[number]['id'];
export type RoleRow = { email: string; role: Role; added_by: string; added_at: string };

export type Me = { email: string; name: string; isOwner: boolean; owner: string | null; roles: Role[] };
export type Features = { slack: boolean };
