// Types shared by the API (src/worker) and the UI (src/client).

/** Change the currency here. Amounts are stored in cents (or the smallest unit). */
export const CURRENCY = 'USD';

export const CATEGORIES = ['travel', 'meals', 'supplies', 'software', 'training', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
  travel: 'Travel',
  meals: 'Meals',
  supplies: 'Supplies',
  software: 'Software',
  training: 'Training',
  other: 'Other',
};

export const ROLES = [
  { id: 'approver', label: 'Approver', plural: 'Approvers', help: 'Approve or reject expenses. Nobody can approve their own.' },
  { id: 'finance', label: 'Finance', plural: 'Finance', help: 'See everything approved each month and download it as a spreadsheet.' },
  { id: 'admin', label: 'Admin', plural: 'Admins', help: 'Change who has which role on this page.' },
] as const;
export type Role = (typeof ROLES)[number]['id'];
export type RoleRow = { email: string; role: Role; added_by: string; added_at: string };

export type Me = { email: string; name: string; isOwner: boolean; owner: string | null; roles: Role[] };

export type Status = 'pending' | 'approved' | 'rejected';

export type Expense = {
  id: number;
  amount_cents: number;
  category: Category;
  description: string;
  spent_on: string;
  receipt_name: string;
  receipt_type: string;
  status: Status;
  created_by: string;
  created_by_name: string;
  created_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_note: string | null;
};

export type MonthReport = { total_cents: number; by_category: { category: Category; total_cents: number; count: number }[]; expenses: Expense[] };
