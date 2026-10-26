import { useCallback, useEffect, useState } from 'react';
import type { ImportRun } from '../shared/types';
import { api } from './api';
import { mapHeaders, parseCsv, toCustomers } from './csv';
import { formatWhen } from './format';

export function UploadPage() {
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ImportRun[] | null>(null);

  const loadHistory = useCallback(() => api<ImportRun[]>('/imports').then(setHistory, () => {}), []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  async function upload(file: File) {
    setError('');
    setBusy(true);
    try {
      setStatus('Reading the file...');
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error('The file has no customer rows.');
      const { map, missing } = mapHeaders(rows[0]);
      if (map.account_number === undefined && map.email === undefined) {
        throw new Error('Could not find an "account number" or "email" column in the first row. Customers are matched on one of them.');
      }
      const customers = toCustomers(rows.slice(1), map);
      const run = await api<ImportRun>('/imports', { method: 'POST', body: JSON.stringify({ fileName: file.name }) });
      let imported = 0;
      let skipped = 0;
      for (let i = 0; i < customers.length; i += 500) {
        setStatus(`Uploading ${Math.min(i + 500, customers.length).toLocaleString()} of ${customers.length.toLocaleString()}...`);
        const r = await api<{ imported: number; skipped: number }>(`/imports/${run.id}/rows`, { method: 'POST', body: JSON.stringify(customers.slice(i, i + 500)) });
        imported += r.imported;
        skipped += r.skipped;
      }
      setStatus('Finishing...');
      const done = await api<ImportRun>(`/imports/${run.id}/finish`, { method: 'POST' });
      const parts = [`Done. ${imported.toLocaleString()} customers updated.`];
      if (skipped) parts.push(`${skipped} rows had no account number or email and were skipped.`);
      if (done.removed_count) parts.push(`${done.removed_count} customers were not in this file. They are kept with their notes and marked "not in latest upload".`);
      if (missing.length) parts.push(`Columns not found: ${missing.map((m) => m.replace('_', ' ')).join(', ')}.`);
      setStatus(parts.join(' '));
      loadHistory();
    } catch (err) {
      setStatus('');
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h1>Upload the customer list</h1>
          <p>
            A CSV file from your spreadsheet, billing system or CRM. Columns it looks for: account number, name, company, email, phone,
            plan, account manager, customer since. Customers are matched on account number (or email), so uploading a newer file
            updates their details and keeps every note.
          </p>
        </div>
      </div>
      <div className="card stack">
        <input type="file" accept=".csv,text/csv" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        <p className="muted small">In Excel or Google Sheets: File, then Download or Save as, then CSV.</p>
        {status && <p className="notice">{status}</p>}
        {error && <p className="error">{error}</p>}
      </div>
      {history && history.length > 0 && (
        <section className="card">
          <h2>Past uploads</h2>
          <ul className="divided" style={{ marginTop: 12 }}>
            {history.map((h) => (
              <li key={h.id} className="line small">
                <span>{h.file_name} · {h.row_count.toLocaleString()} rows · {h.uploaded_by_name}</span>
                <span className="muted">{formatWhen(h.started_at)}{h.status === 'running' ? ' · did not finish' : ''}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
