import { useEffect, useRef, useState } from 'react';
import type { Customer, Summary } from '../shared/types';
import { api } from './api';
import { formatDay, weekAgo } from './format';

export function SearchPage({ admin }: { admin: boolean }) {
  const [q, setQ] = useState(() => sessionStorage.getItem('q') ?? '');
  const [all, setAll] = useState(false);
  const [results, setResults] = useState<Customer[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    api<Summary>(`/summary?since=${encodeURIComponent(weekAgo())}`).then(setSummary, () => {});
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('q', q); } catch { /* private mode */ }
    const n = ++seq.current;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (all) params.set('all', '1');
      api<Customer[]>(`/customers?${params}`).then(
        (r) => { if (n === seq.current) { setResults(r); setError(''); } },
        (e) => { if (n === seq.current) setError(e.message); },
      );
    }, 120);
    return () => clearTimeout(t);
  }, [q, all]);

  const empty = summary !== null && summary.customers === 0 && !summary.lastImport;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>
            {summary?.lastImport
              ? `${summary.customers.toLocaleString()} customers · list updated ${formatDay(summary.lastImport.finished_at ?? summary.lastImport.started_at)} · ${summary.notes_this_week} notes this week`
              : 'Search by name, company, email, phone or account number.'}
          </p>
        </div>
      </div>
      <input className="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, company, email, phone or account number" />
      <label className="check small muted">
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        Include customers who are not in the latest upload
      </label>
      {error && <p className="error">{error}</p>}

      {empty ? (
        <div className="card empty">
          <strong>No customers yet</strong>
          {admin ? <><a href="#/upload">Upload your customer spreadsheet</a> to get started.</> : 'An admin has to upload the customer list first.'}
        </div>
      ) : results === null ? (
        !error && <p className="muted">Loading...</p>
      ) : results.length === 0 ? (
        <p className="muted">No customers match "{q}".</p>
      ) : (
        <>
          <div className="table-wrap">
            <table className="stackable">
              <thead><tr><th>Customer</th><th>Account</th><th>Email</th><th>Phone</th><th>Plan</th><th>Account manager</th><th>Notes</th></tr></thead>
              <tbody>
                {results.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => (location.hash = `#/customers/${c.id}`)}>
                    <td data-label="">
                      <a href={`#/customers/${c.id}`} className="strong-link">{c.name || '(no name)'}</a>
                      {c.company && <div className="muted small">{c.company}</div>}
                      {!c.in_latest && <span className="badge">not in latest upload</span>}
                    </td>
                    <td data-label="Account" className="mono">{c.account_number}</td>
                    <td data-label="Email">{c.email}</td>
                    <td data-label="Phone" className="nowrap">{c.phone}</td>
                    <td data-label="Plan">{c.plan && <span className="badge accent">{c.plan}</span>}</td>
                    <td data-label="Account manager">{c.account_manager}</td>
                    <td data-label="Notes" className="nowrap">{c.note_count ? <>{c.note_count} <span className="muted small">· {formatDay(c.last_note_at!)}</span></> : <span className="muted">-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length === 50 && <p className="muted small">Showing the first 50 matches. Type more to narrow it down.</p>}
        </>
      )}
    </div>
  );
}
