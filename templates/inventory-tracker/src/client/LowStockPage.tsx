import { useEffect, useState } from 'react';
import type { Item } from '../shared/types';
import { api } from './api';
import { ItemRow } from './LookupPage';

export function LowStockPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const load = () => api<Item[]>('/items/low').then((r) => { setItems(r); setError(''); }, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Low stock</h1>
          <p>Items at or below their reorder level. The emptiest are at the top.</p>
        </div>
        <button className="secondary" onClick={load}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      {items === null ? (
        !error && <p className="muted">Loading...</p>
      ) : items.length === 0 ? (
        <div className="card empty"><strong>Nothing is low</strong>Every item is above its reorder level.</div>
      ) : (
        <ul className="list items">{items.map((it) => <ItemRow key={it.id} item={it} />)}</ul>
      )}
    </div>
  );
}
