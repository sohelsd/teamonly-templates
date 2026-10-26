import { useEffect, useState, type FormEvent } from 'react';
import type { Request } from '../shared/types';
import { api } from './api';
import { formatDay, formatWhen, StatusBadge } from './format';

export function MyRequests() {
  const [items, setItems] = useState<Request[] | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const load = () => api<Request[]>('/requests/mine').then(setItems, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const row = await api<Request>('/requests', { method: 'POST', body: JSON.stringify({ title, details, needed_by: neededBy }) });
      setItems((r) => [row, ...(r ?? [])]);
      setTitle('');
      setDetails('');
      setNeededBy('');
      setError('');
      setNotice(`Sent. Request #${row.id} is in the queue.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Requests</h1>
          <p>Ask for what you need. You can follow its status here.</p>
        </div>
      </div>
      <div className="split">
        <form onSubmit={submit} className="card stack">
          <h2>New request</h2>
          <label>
            What do you need?
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="A second monitor for my desk" />
          </label>
          <label>
            Details
            <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={4} placeholder="Anything that helps: where, which one, why" />
          </label>
          <label>
            Needed by (optional)
            <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
          </label>
          {error && <p className="error">{error}</p>}
          {notice && <p className="ok">{notice}</p>}
          <div><button type="submit" disabled={!title.trim() || saving}>{saving ? 'Sending...' : 'Send request'}</button></div>
        </form>

        <section className="stack">
          <div className="line">
            <h2>Your requests</h2>
            <button className="secondary small" onClick={load}>Refresh</button>
          </div>
          {items === null ? (
            !error && <p className="muted">Loading...</p>
          ) : items.length === 0 ? (
            <div className="card empty"><strong>Nothing yet</strong>Requests you send show up here with their status.</div>
          ) : (
            <ul className="list">
              {items.map((r) => (
                <li key={r.id}>
                  <a href={`#/requests/${r.id}`} className="card request-row">
                    <div className="line">
                      <strong>{r.title}</strong>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.reply && <p className="reply small">{r.reply}</p>}
                    <p className="muted small">
                      #{r.id} · sent {formatWhen(r.created_at)}
                      {r.needed_by && <> · needed by {formatDay(r.needed_by)}</>}
                      {r.assigned_to_name && r.status !== 'done' && <> · {r.assigned_to_name} is on it</>}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
