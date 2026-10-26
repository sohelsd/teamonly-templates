import { useEffect, useState } from 'react';
import { STATUS_LABELS, type QueueCounts, type Request, type Status } from '../shared/types';
import { api } from './api';
import { age, formatDay, isLate, StatusBadge } from './format';

type Filter = 'open' | Status | 'all';
const FILTERS: Filter[] = ['open', 'new', 'in_progress', 'done', 'all'];
const label = (f: Filter) => (f === 'open' ? 'Open' : f === 'all' ? 'All' : STATUS_LABELS[f]);

export function Queue() {
  const [filter, setFilter] = useState<Filter>(() => (localStorage.getItem('queue-filter') as Filter) || 'open');
  const [data, setData] = useState<{ requests: Request[]; counts: QueueCounts } | null>(null);
  const [error, setError] = useState('');

  const load = () => api<{ requests: Request[]; counts: QueueCounts }>(`/queue?status=${filter}`).then((d) => { setData(d); setError(''); }, (e) => setError(e.message));
  useEffect(() => {
    try { localStorage.setItem('queue-filter', filter); } catch { /* private mode */ }
    load();
  }, [filter]);

  const count = (f: Filter) => {
    if (!data) return undefined;
    const c = data.counts;
    return f === 'open' ? c.new + c.in_progress : f === 'all' ? c.new + c.in_progress + c.done : c[f];
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Queue</h1>
          <p>Open requests, the ones needed soonest first. Open one to update it or reply.</p>
        </div>
        <button className="secondary" onClick={load}>Refresh</button>
      </div>
      <div className="chips">
        {FILTERS.map((f) => (
          <button key={f} className={`chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {label(f)} {count(f) !== undefined && <span className="muted-on-chip">{count(f)}</span>}
          </button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      {data === null ? (
        !error && <p className="muted">Loading...</p>
      ) : data.requests.length === 0 ? (
        <div className="card empty"><strong>Nothing here</strong>{filter === 'open' ? 'Every request is done.' : 'No requests with this status.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="stackable">
            <thead><tr><th>#</th><th>Request</th><th>From</th><th>Needed by</th><th>Status</th><th>With</th><th className="num">Age</th></tr></thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => (location.hash = `#/requests/${r.id}`)}>
                  <td data-label="#" className="muted hide-sm">{r.id}</td>
                  <td data-label=""><a href={`#/requests/${r.id}`} className="strong-link">{r.title}</a></td>
                  <td data-label="From">{r.created_by_name}</td>
                  <td data-label="Needed by" className={isLate(r) ? 'error nowrap' : 'nowrap'}>{r.needed_by ? formatDay(r.needed_by) : <span className="muted">-</span>}</td>
                  <td data-label="Status"><StatusBadge status={r.status} /></td>
                  <td data-label="With">{r.assigned_to_name ?? <span className="muted">Nobody yet</span>}</td>
                  <td data-label="Age" className="num muted">{age(r.created_at, r.done_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
