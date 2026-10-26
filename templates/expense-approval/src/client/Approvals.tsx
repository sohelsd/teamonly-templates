import { useEffect, useState } from 'react';
import { CATEGORY_LABELS, type Expense, type Me } from '../shared/types';
import { api } from './api';
import { formatDay, formatMoney, formatWhen, receiptUrl, StatusBadge } from './format';

export function Approvals({ me, onDecided }: { me: Me; onDecided: () => void }) {
  const [pending, setPending] = useState<Expense[] | null>(null);
  const [decided, setDecided] = useState<Expense[] | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    api<Expense[]>('/approvals').then(setPending, (e) => setError(e.message));
    api<Expense[]>('/approvals?status=decided').then(setDecided, (e) => setError(e.message));
  };
  useEffect(load, []);

  async function decide(x: Expense, decision: 'approved' | 'rejected') {
    setBusy(x.id);
    setError('');
    try {
      const row = await api<Expense>(`/expenses/${x.id}/decision`, { method: 'POST', body: JSON.stringify({ decision, note: notes[x.id] ?? '' }) });
      setPending((list) => list?.filter((p) => p.id !== x.id) ?? null);
      setDecided((list) => [row, ...(list ?? [])]);
      onDecided();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const total = (pending ?? []).filter((x) => x.created_by !== me.email).reduce((s, x) => s + x.amount_cents, 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Approvals</h1>
          <p>{pending === null ? 'Loading...' : pending.length ? `${pending.length} waiting, ${formatMoney(total)} in total` : 'Nothing is waiting for you.'}</p>
        </div>
        <button className="secondary" onClick={load}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}

      {pending && pending.length === 0 && <div className="card empty"><strong>All caught up</strong>New expenses show up here as people submit them.</div>}
      {pending && pending.length > 0 && (
        <ul className="list">
          {pending.map((x) => {
            const own = x.created_by === me.email;
            return (
              <li key={x.id} className="card stack" style={{ gap: 10 }}>
                <div className="line">
                  <div className="grow">
                    <strong>{x.created_by_name}</strong> <span className="muted small">{x.created_by}</span>
                    <p style={{ marginTop: 2 }}>{x.description}</p>
                    <p className="muted small">
                      {CATEGORY_LABELS[x.category]} · {formatDay(x.spent_on)} · <a href={receiptUrl(x.id)} target="_blank" rel="noreferrer">View receipt</a>
                    </p>
                  </div>
                  <strong style={{ fontSize: '1.2rem' }}>{formatMoney(x.amount_cents)}</strong>
                </div>
                {own ? (
                  <p className="notice small">This is your own expense, so another approver has to decide on it. Add one on the People page if needed.</p>
                ) : (
                  <div className="row" style={{ alignItems: 'center' }}>
                    <input style={{ flex: '3 1 220px' }} placeholder="Note (needed to reject)" value={notes[x.id] ?? ''} onChange={(e) => setNotes((n) => ({ ...n, [x.id]: e.target.value }))} />
                    <div className="actions" style={{ flex: '0 0 auto' }}>
                      <button disabled={busy === x.id} onClick={() => decide(x, 'approved')}>Approve</button>
                      <button className="secondary" disabled={busy === x.id} onClick={() => decide(x, 'rejected')}>Reject</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2>Recently decided</h2>
      {decided === null ? null : decided.length === 0 ? (
        <p className="muted">No decisions yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="stackable">
            <thead><tr><th>Person</th><th>For</th><th className="num">Amount</th><th>Status</th><th>By</th><th>On</th></tr></thead>
            <tbody>
              {decided.map((x) => (
                <tr key={x.id}>
                  <td data-label="">{x.created_by_name}</td>
                  <td data-label="For">{x.description}{x.decision_note && <div className="muted small">"{x.decision_note}"</div>}</td>
                  <td data-label="Amount" className="num">{formatMoney(x.amount_cents)}</td>
                  <td data-label="Status"><StatusBadge status={x.status} /></td>
                  <td data-label="By">{x.decided_by_name}</td>
                  <td data-label="On" className="nowrap">{formatWhen(x.decided_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
