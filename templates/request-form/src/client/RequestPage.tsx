import { useEffect, useState } from 'react';
import { STATUSES, STATUS_LABELS, type Request, type Status } from '../shared/types';
import { api } from './api';
import { formatDay, formatWhen, isLate, StatusBadge } from './format';

export function RequestPage({ id, handler, onChange }: { id: number; handler: boolean; onChange: () => void }) {
  const [r, setR] = useState<Request | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  useEffect(() => {
    api<Request>(`/requests/${id}`).then((row) => { setR(row); setReply(row.reply ?? ''); }, (e) => setError(e.message));
  }, [id]);

  async function update(change: { status?: Status; reply?: string; assign?: 'me' | 'nobody' }, msg: string) {
    setBusy(true);
    setError('');
    try {
      const row = await api<Request>(`/requests/${id}`, { method: 'PATCH', body: JSON.stringify(change) });
      setR(row);
      setSaved(msg);
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm('Withdraw this request?')) return;
    try {
      await api(`/requests/${id}`, { method: 'DELETE' });
      location.hash = '#/';
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!r) return <div className="page narrow">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;

  return (
    <div className="page narrow">
      <p><a href={handler ? '#/queue' : '#/'}>{handler ? 'Back to the queue' : 'Back to your requests'}</a></p>
      <div className="card stack">
        <div className="line" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <p className="muted small">Request #{r.id}</p>
            <h1>{r.title}</h1>
          </div>
          <StatusBadge status={r.status} />
        </div>
        {r.details && <p className="pre">{r.details}</p>}
        <dl className="facts">
          <dt>From</dt><dd>{r.created_by_name} <span className="muted">{r.created_by}</span></dd>
          <dt>Sent</dt><dd>{formatWhen(r.created_at)}</dd>
          {r.needed_by && <><dt>Needed by</dt><dd className={isLate(r) ? 'error' : ''}>{formatDay(r.needed_by)}{isLate(r) && ' (late)'}</dd></>}
          <dt>With</dt><dd>{r.assigned_to_name ?? 'Nobody yet'}</dd>
          {r.done_at && <><dt>Done</dt><dd>{formatWhen(r.done_at)}</dd></>}
        </dl>
        {!handler && r.reply && <div className="notice"><strong className="small">Reply</strong><p className="pre">{r.reply}</p></div>}
        {!handler && r.status === 'new' && <div><button className="secondary small" onClick={withdraw}>Withdraw request</button></div>}
      </div>

      {handler && (
        <div className="card stack">
          <h2>Update</h2>
          <div className="chips">
            {STATUSES.map((s) => (
              <button key={s} className={`chip ${r.status === s ? 'active' : ''}`} disabled={busy} onClick={() => r.status !== s && update({ status: s }, `Marked ${STATUS_LABELS[s].toLowerCase()}.`)}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <label>
            Reply to {r.created_by_name.split(' ')[0]} (they see this)
            <textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ordered, arriving Thursday" />
          </label>
          <div className="actions">
            <button disabled={busy || reply === (r.reply ?? '')} onClick={() => update({ reply }, 'Reply saved.')}>Save reply</button>
            {r.assigned_to ? (
              <button className="secondary" disabled={busy} onClick={() => update({ assign: 'nobody' }, 'Unassigned.')}>Unassign</button>
            ) : (
              <button className="secondary" disabled={busy} onClick={() => update({ assign: 'me' }, 'Assigned to you.')}>Assign to me</button>
            )}
          </div>
          {saved && <p className="ok small">{saved}</p>}
          {r.updated_by_name && <p className="muted small">Last updated by {r.updated_by_name}, {formatWhen(r.updated_at)}</p>}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
