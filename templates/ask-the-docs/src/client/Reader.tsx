import { useEffect, useState } from 'react';
import type { Doc, Passage } from '../shared/types';
import { api } from './api';

/** A document as its passages, scrolled to the one a search result pointed at. */
export function Reader({ id, passage }: { id: number; passage: number | null }) {
  const [data, setData] = useState<{ doc: Doc; passages: Passage[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ doc: Doc; passages: Passage[] }>(`/docs/${id}`).then(setData, (e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (data && passage) document.getElementById(`p${passage}`)?.scrollIntoView({ block: 'center' });
  }, [data, passage]);

  if (!data) return <div className="page narrow">{error ? <p className="error">{error}</p> : <p className="muted">Loading...</p>}</div>;
  const { doc, passages } = data;
  let lastHeading = '';

  return (
    <div className="page narrow">
      <p><a href="#/docs">All documents</a></p>
      <div className="page-head">
        <div>
          <h1>{doc.title}</h1>
          <p>{doc.file_name} · added by {doc.uploaded_by_name}</p>
        </div>
        {doc.has_file ? <a className="button secondary" href={`/api/docs/${doc.id}/file`} target="_blank" rel="noreferrer">Open original</a> : null}
      </div>
      <article className="card reader">
        {passages.map((p) => {
          const showHeading = p.heading && p.heading !== lastHeading;
          lastHeading = p.heading;
          return (
            <div key={p.id}>
              {showHeading && <h2 className="reader-heading">{p.heading}</h2>}
              <p id={`p${p.id}`} className={`pre ${p.id === passage ? 'focus' : ''}`}>{p.body}</p>
            </div>
          );
        })}
      </article>
    </div>
  );
}
