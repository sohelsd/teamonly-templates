import { STATUS_LABELS, type Request, type Status } from '../shared/types';

export const formatDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "3h", "2d" since a timestamp. */
export function age(iso: string, until?: string | null) {
  const mins = Math.max(0, Math.floor(((until ? new Date(until) : new Date()).getTime() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

const TONE: Record<Status, string> = { new: 'accent', in_progress: 'warn', done: 'ok' };
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${TONE[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function isLate(r: Request) {
  if (!r.needed_by || r.status === 'done') return false;
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return r.needed_by < today;
}
