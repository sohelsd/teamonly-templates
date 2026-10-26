import { useEffect, useRef, useState } from 'react';
import type { Doc } from '../shared/types';
import { api } from './api';

const KIND: Record<Doc['kind'], string> = { pdf: 'PDF', markdown: 'Markdown', text: 'Text' };
const size = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

export function Library({ editor }: { editor: boolean }) {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = () => api<Doc[]>('/docs').then(setDocs, (e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function upload(files: FileList) {
    setBusy(true);
    setError('');
    let done = 0;
    for (const f of Array.from(files)) {
      setStatus(`Reading ${f.name}...`);
      try {
        const body = new FormData();
        body.append('file', f);
        await api<Doc>('/docs', { method: 'POST', body });
        done++;
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    setStatus(done ? `Added ${done} document${done === 1 ? '' : 's'}. They can be searched now.` : '');
    setBusy(false);
    if (input.current) input.current.value = '';
    load();
  }

  async function remove(d: Doc) {
    if (!confirm(`Remove "${d.title}"? It won't show up in searches any more.`)) return;
    try {
      await api(`/docs/${d.id}`, { method: 'DELETE' });
      setDocs((list) => list?.filter((x) => x.id !== d.id) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>Everything people can search. {editor ? 'Add PDFs, Markdown or text files.' : 'Editors can add more.'}</p>
        </div>
      </div>
      {editor && (
        <div className="card stack">
          <label>
            Add documents (PDF, .md or .txt, up to 20 MB each)
            <input ref={input} type="file" multiple accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown" disabled={busy} onChange={(e) => e.target.files?.length && upload(e.target.files)} />
          </label>
          <p className="muted small">Word or Google Docs: save as PDF first. Scanned PDFs (photos of pages) have no text to search.</p>
          {status && <p className="ok small">{status}</p>}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {docs === null ? (
        !error && <p className="muted">Loading...</p>
      ) : docs.length === 0 ? (
        <div className="card empty"><strong>No documents yet</strong>{editor ? 'Add your handbook or a policy to start.' : 'Ask an editor to add some.'}</div>
      ) : (
        <div className="table-wrap">
          <table className="stackable">
            <thead><tr><th>Title</th><th>Type</th><th className="num">Size</th><th>Added by</th><th></th></tr></thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id}>
                  <td data-label=""><a href={`#/docs/${d.id}`} className="strong-link">{d.title}</a><div className="muted small">{d.file_name}</div></td>
                  <td data-label="Type">{KIND[d.kind]}{d.pages ? <span className="muted small"> · {d.pages} pages</span> : null}</td>
                  <td data-label="Size" className="num">{size(d.size_bytes)}</td>
                  <td data-label="Added by">{d.uploaded_by_name}<div className="muted small">{new Date(d.created_at).toLocaleDateString()}</div></td>
                  <td data-label="" className="num">
                    <div className="actions" style={{ justifyContent: 'flex-end' }}>
                      {d.has_file ? <a className="button secondary small" href={`/api/docs/${d.id}/file`} target="_blank" rel="noreferrer">Open</a> : null}
                      {editor && <button className="ghost small" onClick={() => remove(d)}>Remove</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
