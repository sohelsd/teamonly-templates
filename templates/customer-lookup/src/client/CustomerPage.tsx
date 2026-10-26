import { useEffect, useState, type FormEvent } from 'react';
import type { Customer, Me, Note } from '../shared/types';
import { api } from './api';
import { formatDay, formatWhen } from './format';

export function CustomerPage({ id, me }: { id: number; me: Me | null }) {
  const [data, setData] = useState<{ customer: Customer; notes: Note[] } | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ customer: Customer; notes: Note[] }>(`/customers/${id}`).then(setData, (e) => setError(e.message));
  }, [id]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSaving(true);
    try {
      const note = await api<Note>(`/customers/${id}/notes`, { method: 'POST', body: JSON.stringify({ body: draft }) });
      setData((d) => (d ? { ...d, notes: [note, ...d.notes] } : d));
      setDraft('');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(noteId: number) {
    if (!confirm('Delete this note?')) return;
    try {
      await api(`/notes/${noteId}`, { method: 'DELETE' });
      setData((d) => (d ? { ...d, notes: d.notes.filter((n) => n.id !== noteId) } : d));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!data) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;
  const c = data.customer;
  const admin = !!me?.roles.includes('admin');

  return (
    <div className="page">
      <p><a href="#/">Back to search</a></p>
      <div className="split">
        <div className="card stack">
          <div>
            <h1>{c.name || '(no name)'}</h1>
            {c.company && <p className="muted">{c.company}</p>}
          </div>
          {!c.in_latest && <p className="notice warn small">This customer was not in the latest upload.</p>}
          <dl className="facts">
            <dt>Account</dt><dd className="mono">{c.account_number || '-'}</dd>
            <dt>Email</dt><dd>{c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : '-'}</dd>
            <dt>Phone</dt><dd>{c.phone ? <a href={`tel:${c.phone}`}>{c.phone}</a> : '-'}</dd>
            <dt>Plan</dt><dd>{c.plan || '-'}</dd>
            <dt>Account manager</dt><dd>{c.account_manager || '-'}</dd>
            <dt>Customer since</dt><dd>{c.customer_since ? formatDay(`${c.customer_since}T00:00:00`) : '-'}</dd>
          </dl>
        </div>

        <section className="stack">
          <h2>Notes</h2>
          <form onSubmit={add} className="card stack">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What happened? The whole team will see this note." rows={3} />
            <div><button type="submit" disabled={!draft.trim() || saving}>{saving ? 'Saving...' : 'Add note'}</button></div>
          </form>
          {error && <p className="error">{error}</p>}
          {data.notes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            <ul className="list">
              {data.notes.map((n) => (
                <li key={n.id} className="card stack" style={{ gap: 6 }}>
                  <p className="pre">{n.body}</p>
                  <div className="line muted small">
                    <span title={n.author_email}>{n.author_name} · {formatWhen(n.created_at)}</span>
                    {(me?.email === n.author_email || admin) && <button className="ghost small" onClick={() => remove(n.id)}>Delete</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
