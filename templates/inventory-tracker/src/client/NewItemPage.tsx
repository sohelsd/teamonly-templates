import { useState, type FormEvent } from 'react';
import type { Item } from '../shared/types';
import { api } from './api';

export function NewItemPage() {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [loc, setLoc] = useState('');
  const [qty, setQty] = useState('0');
  const [reorder, setReorder] = useState('0');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const it = await api<Item>('/items', { method: 'POST', body: JSON.stringify({ sku, name, location: loc, qty: Number(qty), reorder_level: Number(reorder) }) });
      location.hash = `#/items/${it.id}`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <p><a href="#/">Back to items</a></p>
      <form className="card stack" onSubmit={save}>
        <h1>New item</h1>
        <div className="row">
          <label>SKU or code<input value={sku} onChange={(e) => setSku(e.target.value)} required autoFocus /></label>
          <label>Location<input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Bin A1-03" /></label>
        </div>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required /></label>
        <div className="row">
          <label>On hand now<input type="number" inputMode="numeric" min={0} value={qty} onChange={(e) => setQty(e.target.value)} /></label>
          <label>Reorder at<input type="number" inputMode="numeric" min={0} value={reorder} onChange={(e) => setReorder(e.target.value)} /></label>
        </div>
        {error && <p className="error">{error}</p>}
        <div><button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Add item'}</button></div>
      </form>
    </div>
  );
}
