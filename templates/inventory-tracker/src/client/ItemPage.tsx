import { useEffect, useState, type FormEvent } from 'react';
import { ADJUST_REASONS, REASON_LABELS, type AdjustReason, type Item, type Movement } from '../shared/types';
import { api } from './api';
import { signed, when } from './format';

export function ItemPage({ id, admin }: { id: number; admin: boolean }) {
  const [item, setItem] = useState<Item | null>(null);
  const [history, setHistory] = useState<Movement[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  async function load() {
    try {
      const r = await api<{ item: Item; history: Movement[] }>(`/items/${id}`);
      setItem(r.item);
      setHistory(r.history);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => { load(); }, [id]);

  async function remove() {
    if (!item || !confirm(`Delete ${item.name} and its history? This can't be undone.`)) return;
    try {
      await api(`/items/${id}`, { method: 'DELETE' });
      location.hash = '#/';
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!item) return <div className="page">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;
  const low = item.qty <= item.reorder_level;

  return (
    <div className="page">
      <p><a href="#/">Back to items</a></p>
      <div className="split">
        <div className="stack">
          <div className="card">
            {editing ? (
              <EditForm item={item} onDone={(it) => { if (it) setItem(it); setEditing(false); }} />
            ) : (
              <>
                <div className="line" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <h1>{item.name}</h1>
                    <p className="muted"><span className="mono">{item.sku}</span>{item.location && <> · {item.location}</>}</p>
                  </div>
                  <div className="actions">
                    <button className="secondary small" onClick={() => setEditing(true)}>Edit</button>
                    {admin && <button className="ghost small" onClick={remove}>Delete</button>}
                  </div>
                </div>
                <div className="big-qty">
                  <span className={item.qty === 0 ? 'out' : low ? 'low' : ''}>{item.qty}</span>
                  <span className="muted">on hand · reorder at {item.reorder_level}</span>
                  {low && <span className={`badge ${item.qty === 0 ? 'danger' : 'warn'}`}>{item.qty === 0 ? 'Out of stock' : 'Low stock'}</span>}
                </div>
              </>
            )}
          </div>
          <AdjustForm item={item} onSaved={load} />
        </div>

        <section className="stack">
          <h2>History</h2>
          {error && <p className="error">{error}</p>}
          {history.length === 0 ? (
            <p className="muted">No changes yet.</p>
          ) : (
            <div className="card">
              <ul className="divided">
                {history.map((m) => (
                  <li key={m.id} className="line" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <strong>{REASON_LABELS[m.reason]}</strong>{' '}
                      <span className={m.change < 0 ? 'neg' : 'pos'}>{signed(m.change)}</span>
                      <span className="muted"> to {m.qty_after}</span>
                      {m.note && <div className="small muted">{m.note}</div>}
                    </div>
                    <div className="muted small" style={{ textAlign: 'right' }}>{m.by_name}<br />{when(m.created_at)}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function AdjustForm({ item, onSaved }: { item: Item; onSaved: () => Promise<void> }) {
  const [reason, setReason] = useState<AdjustReason>('used');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const isCount = reason === 'count';
  const n = qty.trim() === '' ? NaN : Number(qty);
  const valid = Number.isInteger(n) && n >= 0 && (isCount || n > 0);
  const result = !valid ? null : isCount ? n : reason === 'received' ? item.qty + n : item.qty - n;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const updated = await api<Item>(`/items/${item.id}/adjust`, { method: 'POST', body: JSON.stringify({ reason, qty: n, note }) });
      setMsg({ ok: true, text: `Saved. ${updated.qty} on hand now.` });
      setQty('');
      setNote('');
      await onSaved();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Change the count</h2>
      <div className="reasons">
        {ADJUST_REASONS.map((r) => (
          <button type="button" key={r} className={`chip ${reason === r ? 'active' : ''}`} onClick={() => { setReason(r); setMsg(null); }}>
            {REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <label>
        {isCount ? 'How many are there?' : reason === 'received' ? 'How many came in?' : 'How many went?'}
        <div className="stepper">
          <button type="button" className="secondary" onClick={() => setQty(String(Math.max(0, (Number(qty) || 0) - 1)))} aria-label="One less">-</button>
          <input type="number" inputMode="numeric" min={0} step={1} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
          <button type="button" className="secondary" onClick={() => setQty(String((Number(qty) || 0) + 1))} aria-label="One more">+</button>
        </div>
      </label>
      <label>Note (optional)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="PO number, job, who it went to" maxLength={500} /></label>
      {result !== null && <p className={`small ${result < 0 ? 'error' : 'muted'}`}>{item.qty} becomes {result}{result < 0 && ' (not enough on hand)'}</p>}
      <button type="submit" disabled={!valid || busy || (result ?? 0) < 0}>{busy ? 'Saving...' : 'Save'}</button>
      {msg && <p className={msg.ok ? 'ok' : 'error'}>{msg.text}</p>}
    </form>
  );
}

function EditForm({ item, onDone }: { item: Item; onDone: (it: Item | null) => void }) {
  const [sku, setSku] = useState(item.sku);
  const [name, setName] = useState(item.name);
  const [loc, setLoc] = useState(item.location);
  const [reorder, setReorder] = useState(String(item.reorder_level));
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      onDone(await api<Item>(`/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ sku, name, location: loc, reorder_level: Number(reorder) }) }));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <div className="row">
        <label>SKU or code<input value={sku} onChange={(e) => setSku(e.target.value)} required /></label>
        <label>Location<input value={loc} onChange={(e) => setLoc(e.target.value)} /></label>
      </div>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label>Reorder at<input type="number" inputMode="numeric" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} /></label>
      <p className="muted small">To change how many there are, use "Change the count" so it shows in the history.</p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit">Save</button>
        <button type="button" className="secondary" onClick={() => onDone(null)}>Cancel</button>
      </div>
    </form>
  );
}
