// Types shared by the API (src/worker) and the UI (src/client).

/** The columns a customer has. Add one here, in the migration and in csv.ts to track more. */
export type CustomerInput = {
  account_number: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  plan: string;
  account_manager: string;
  customer_since: string;
};

export type Customer = CustomerInput & { id: number; in_latest: number; updated_at: string; note_count?: number; last_note_at?: string | null };

export type Note = { id: number; customer_id: number; body: string; author_email: string; author_name: string; created_at: string };

export type ImportRun = {
  id: number;
  file_name: string;
  uploaded_by: string;
  uploaded_by_name: string;
  status: 'running' | 'done';
  row_count: number;
  removed_count: number;
  started_at: string;
  finished_at: string | null;
};

export type Summary = { customers: number; notes_this_week: number; lastImport: ImportRun | null };

export const ROLES = [
  { id: 'admin', label: 'Admin', plural: 'Admins', help: 'Upload the customer spreadsheet, remove any note and change this list. Everyone can search and add notes.' },
] as const;
export type Role = (typeof ROLES)[number]['id'];
export type RoleRow = { email: string; role: Role; added_by: string; added_at: string };

export type Me = { email: string; name: string; isOwner: boolean; owner: string | null; roles: Role[] };
