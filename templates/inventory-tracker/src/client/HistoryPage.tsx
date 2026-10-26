import { useEffect, useState } from 'react';
import { REASON_LABELS, type Movement } from '../shared/types';
import { api } from './api';
import { signed, when } from './format';

export function HistoryPage() {
  const [rows, setRows] = useState<Movement[] | null>(null);
  const [error, setError] = useState('');
  const load = () => api<Movement[]>('/history').then((r) => { setRows(r); setError(''); }, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>History</h1>
          <p>The last 200 changes across all items. Open an item to see all of its changes.</p>
        </div>
        <button className="secondary" onClick={load}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {rows === null ? (
        !error && <p className="muted">Loading...</p>
      ) : rows.length === 0 ? (
        <div className="card empty"><strong>No changes yet</strong>Every count change shows up here with who made it.</div>
      ) : (
        <div className="table-wrap">
          <table className="stackable">
            <thead><tr><th>When</th><th>Item</th><th>What</th><th className="num">Change</th><th className="num">After</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => (location.hash = `#/items/${m.item_id}`)}>
                  <td data-label="When" className="nowrap">{when(m.created_at)}</td>
                  <td data-label="">{m.name}<div className="muted small mono">{m.sku}</div></td>
                  <td data-label="What">{REASON_LABELS[m.reason]}{m.note && <div className="muted small">{m.note}</div>}</td>
                  <td data-label="Change" className={`num ${m.change < 0 ? 'neg' : 'pos'}`}>{signed(m.change)}</td>
                  <td data-label="After" className="num">{m.qty_after}</td>
                  <td data-label="By">{m.by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
