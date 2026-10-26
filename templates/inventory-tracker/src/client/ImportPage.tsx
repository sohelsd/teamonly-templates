import { useMemo, useState } from 'react';
import type { ImportResult } from '../shared/types';
import { api } from './api';
import { parseSheet } from './parse';

const LABELS = { sku: 'SKU', name: 'Name', location: 'Location', qty: 'Qty', reorder_level: 'Reorder at' } as const;

export function ImportPage() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');

  const parsed = useMemo(() => parseSheet(text), [text]);
  const good = parsed.rows.filter((r) => !r.problem);
  const bad = parsed.rows.filter((r) => r.problem);

  async function run() {
    setBusy(true);
    setError('');
    setDone(null);
    const total: ImportResult = { added: 0, updated: 0, unchanged: 0 };
    try {
      for (let i = 0; i < good.length; i += 100) {
        setProgress(`Importing ${Math.min(i + 100, good.length)} of ${good.length}...`);
        const rows = good.slice(i, i + 100).map(({ sku, name, location, qty, reorder_level }) => ({ sku, name, location, qty, reorder_level }));
        const r = await api<ImportResult>('/import', { method: 'POST', body: JSON.stringify({ rows }) });
        total.added += r.added;
        total.updated += r.updated;
        total.unchanged += r.unchanged;
      }
      setDone(total);
      setText('');
    } catch (err) {
      setError(`${(err as Error).message} Rows before this point were saved. Fix the problem and import again; saved rows will be skipped.`);
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Import items</h1>
          <p>
            In your spreadsheet, select the rows with the heading row, copy, and paste below. Columns: SKU, Name, Location,
            Quantity, Reorder level. With headings the order doesn't matter; without, use that order. Existing SKUs are updated
            to match the sheet, and count changes go in the history.
          </p>
        </div>
      </div>
      <textarea
        className="paste"
        rows={8}
        value={text}
        onChange={(e) => { setText(e.target.value); setDone(null); }}
        placeholder={'SKU\tName\tLocation\tQty\tReorder\nA-100\tBlue widget\tA1-03\t42\t10'}
      />
      {done && (
        <p className="notice">
          Done. {done.added} added, {done.updated} updated, {done.unchanged} already up to date.{' '}
          <a href="#/">Go to items</a>
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {parsed.rows.length > 0 && (
        <>
          <p>
            {good.length} row{good.length === 1 ? '' : 's'} ready
            {bad.length > 0 && <span className="error"> · {bad.length} with problems (skipped)</span>}
            {!parsed.hasHeader && <span className="muted"> · no heading row found, using SKU, Name, Location, Qty, Reorder order</span>}
          </p>
          <div><button disabled={busy || good.length === 0} onClick={run}>
            {busy ? progress || 'Importing...' : `Import ${good.length} item${good.length === 1 ? '' : 's'}`}
          </button></div>
          <div className="table-wrap scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {(['sku', 'name', 'location', 'qty', 'reorder_level'] as const).map((k) => <th key={k}>{LABELS[k]}</th>)}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {parsed.rows.slice(0, 300).map((r) => (
                  <tr key={r.line} className={r.problem ? 'bad' : ''}>
                    <td className="muted">{r.line}</td>
                    <td>{r.sku}</td>
                    <td>{r.name}</td>
                    <td>{r.location}</td>
                    <td>{r.qty}</td>
                    <td>{r.reorder_level}</td>
                    <td className="error small">{r.problem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsed.rows.length > 300 && <p className="muted small">Showing the first 300 rows.</p>}
          </div>
        </>
      )}
    </div>
  );
}
