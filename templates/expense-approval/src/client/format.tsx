import { CURRENCY, type Status } from '../shared/types';

const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: CURRENCY });
export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' });
export const formatWhen = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '');
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const receiptUrl = (id: number) => `/api/expenses/${id}/receipt`;

const STATUS: Record<Status, [string, string]> = { pending: ['Waiting', 'warn'], approved: ['Approved', 'ok'], rejected: ['Rejected', 'danger'] };
export function StatusBadge({ status }: { status: Status }) {
  const [label, tone] = STATUS[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}
