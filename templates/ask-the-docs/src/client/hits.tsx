import type { Hit } from '../shared/types';

/** Where a hit points: the PDF at its page, or the passage in the reader. */
export function hitHref(h: Hit) {
  return h.kind === 'pdf' && h.has_file && h.page ? `/api/docs/${h.doc_id}/file#page=${h.page}` : `#/docs/${h.doc_id}?p=${h.passage_id}`;
}
export const hitWhere = (h: Hit) => [h.page ? `Page ${h.page}` : '', h.heading && !/^Page \d+$/.test(h.heading) ? h.heading : ''].filter(Boolean).join(' · ');

/** Renders a search snippet with the matching words highlighted. */
export function Snippet({ text }: { text: string }) {
  const parts = text.split(/(\u0002[^\u0003]*\u0003)/);
  return (
    <>
      {parts.map((p, i) => (p.startsWith('\u0002') ? <mark key={i}>{p.slice(1, -1)}</mark> : <span key={i}>{p}</span>))}
    </>
  );
}

export function HitList({ hits, numbered }: { hits: (Hit & { n?: number })[]; numbered?: boolean }) {
  return (
    <ul className="list">
      {hits.map((h) => (
        <li key={h.passage_id}>
          <a className="card hit" href={hitHref(h)} target={hitHref(h).startsWith('/api') ? '_blank' : undefined} rel="noreferrer">
            <div className="line small">
              <strong className="hit-title">{numbered && h.n ? <span className="cite">{h.n}</span> : null} {h.title}</strong>
              <span className="muted">{hitWhere(h)}</span>
            </div>
            <p className="snippet"><Snippet text={h.snippet} /></p>
          </a>
        </li>
      ))}
    </ul>
  );
}
