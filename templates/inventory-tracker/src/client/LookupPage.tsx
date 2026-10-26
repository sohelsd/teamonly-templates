import { useEffect, useRef, useState } from 'react';
import type { Item, Summary } from '../shared/types';
import { api } from './api';
import { startOfToday } from './format';

export function ItemRow({ item }: { item: Item }) {
  const low = item.qty <= item.reorder_level;
  return (
    <li>
      <a href={`#/items/${item.id}`} className="card item-row">
        <div className="grow">
          <div className="item-name">{item.name}</div>
          <div className="muted small">
            <span className="mono">{item.sku}</span>
            {item.location && <> · {item.location}</>}
          </div>
        </div>
        <div className={`qty ${item.qty === 0 ? 'out' : low ? 'low' : ''}`}>
          {item.qty}
          <span>{item.qty === 0 ? 'out of stock' : low ? `reorder at ${item.reorder_level}` : 'on hand'}</span>
        </div>
      </a>
    </li>
  );
}

export function LookupPage() {
  const [q, setQ] = useState(() => sessionStorage.getItem('lookup-q') ?? '');
  const [items, setItems] = useState<Item[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const seq = useRef(0);

  useEffect(() => {
    api<Summary>(`/summary?since=${encodeURIComponent(startOfToday())}`).then(setSummary, () => {});
  }, []);

  useEffect(() => {
    try { sessionStorage.setItem('lookup-q', q); } catch { /* private mode */ }
    const mine = ++seq.current;
    const t = setTimeout(() => {
      api<Item[]>(`/items?q=${encodeURIComponent(q.trim())}`).then(
        (r) => { if (mine === seq.current) { setItems(r); setError(''); } },
        (e) => { if (mine === seq.current) setError(e.message); },
      );
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Items</h1>
          <p>Find an item to see its count, change it, or check its history.</p>
        </div>
        <a className="button" href="#/new">Add item</a>
      </div>
      {summary && summary.items > 0 && (
        <div className="stats">
          <div className="stat"><div className="stat-label">Items</div><div className="stat-value">{summary.items}</div></div>
          <a className="stat" href="#/low" style={{ color: 'inherit', textDecoration: 'none' }}><div className="stat-label">Running low</div><div className="stat-value" style={{ color: summary.low ? 'var(--warn)' : undefined }}>{summary.low}</div></a>
          <div className="stat"><div className="stat-label">Out of stock</div><div className="stat-value" style={{ color: summary.out ? 'var(--danger)' : undefined }}>{summary.out}</div></div>
          <a className="stat" href="#/history" style={{ color: 'inherit', textDecoration: 'none' }}><div className="stat-label">Changes today</div><div className="stat-value">{summary.changes_today}</div></a>
        </div>
      )}
      <input className="search" type="search" inputMode="search" placeholder="Search by SKU, name or location" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="error">{error}</p>}
      {items === null ? (
        !error && <p className="muted">Loading...</p>
      ) : items.length === 0 ? (
        q.trim() ? (
          <p className="muted">Nothing matches "{q.trim()}".</p>
        ) : (
          <div className="card empty">
            <strong>No items yet</strong>
            <a href="#/new">Add your first item</a>, or ask an admin to import your list from a spreadsheet.
          </div>
        )
      ) : (
        <ul className="list items">{items.map((it) => <ItemRow key={it.id} item={it} />)}</ul>
      )}
    </div>
  );
}
