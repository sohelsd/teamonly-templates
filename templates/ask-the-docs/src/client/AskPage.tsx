import { Fragment, useEffect, useState, type FormEvent } from 'react';
import type { Answer, Features, Hit, Me, Source } from '../shared/types';
import { api } from './api';
import { HitList, hitHref, hitWhere } from './hits';

/** Turns "[1][3]" in Claude's answer into links to those sources. */
function AnswerText({ text, sources }: { text: string; sources: Source[] }) {
  return (
    <div className="answer-text">
      {text.split(/\n{2,}/).map((para, i) => (
        <p key={i}>
          {para.split(/(\[\d+\])/).map((part, j) => {
            const m = /^\[(\d+)\]$/.exec(part);
            const s = m && sources.find((x) => x.n === Number(m[1]));
            if (!s) return <Fragment key={j}>{part}</Fragment>;
            return <a key={j} className="cite" href={hitHref(s)} target={hitHref(s).startsWith('/api') ? '_blank' : undefined} rel="noreferrer" title={`${s.title} ${hitWhere(s)}`}>{s.n}</a>;
          })}
        </p>
      ))}
    </div>
  );
}

export function AskPage({ features, me }: { features: Features | null; me: Me | null }) {
  const [q, setQ] = useState(() => sessionStorage.getItem('ask-q') ?? '');
  const [asked, setAsked] = useState('');
  const [result, setResult] = useState<Answer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [docCount, setDocCount] = useState<number | null>(null);
  const answers = !!features?.answers;

  useEffect(() => {
    api<unknown[]>('/docs').then((d) => setDocCount(d.length), () => {});
  }, []);

  async function run(e?: FormEvent) {
    e?.preventDefault();
    const question = q.trim();
    if (!question) return;
    try { sessionStorage.setItem('ask-q', question); } catch { /* private mode */ }
    setBusy(true);
    setError('');
    try {
      const r = answers
        ? await api<Answer>('/ask', { method: 'POST', body: JSON.stringify({ question }) })
        : { answer: null, sources: [], hits: await api<Hit[]>(`/search?q=${encodeURIComponent(question)}`) };
      setResult(r);
      setAsked(question);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canSetUp = !!me && (me.isOwner || me.roles.includes('admin'));
  // Under an answer, list the passages it cites (or the best three if it cites none).
  const cited = result?.answer ? result.sources.filter((s) => result.answer!.includes(`[${s.n}]`)) : [];
  const shown = result?.answer ? (cited.length ? cited : result.sources.slice(0, 3)) : result?.hits ?? [];

  return (
    <div className="page narrow">
      <div className="ask-hero">
        <h1>{answers ? 'Ask the docs' : 'Search the docs'}</h1>
        <p className="muted">
          {docCount === null ? '' : docCount === 0 ? 'No documents yet.' : `${docCount} document${docCount === 1 ? '' : 's'}: handbooks, policies and how-tos from your team.`}
        </p>
        <form onSubmit={run} className="ask-form">
          <input className="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={answers ? 'How many vacation days do new hires get?' : 'vacation days, expense limit, wifi password...'} autoFocus />
          <button type="submit" disabled={busy || !q.trim()}>{busy ? (answers ? 'Thinking...' : 'Searching...') : answers ? 'Ask' : 'Search'}</button>
        </form>
      </div>

      {features && !answers && canSetUp && (
        <div className="notice small">
          <strong>Want written answers?</strong> Add an Anthropic API key and this page answers questions in plain words, with links to the
          passages it used: <code>npx teamonly secrets set ANTHROPIC_API_KEY</code>. Until then it is a search tool, and documents never leave
          your app.
        </div>
      )}
      {docCount === 0 && <div className="card empty"><strong>Nothing to search yet</strong><a href="#/docs">Add your first document</a> (PDF, Markdown or text).</div>}
      {error && <p className="error">{error}</p>}

      {result && (
        <>
          {result.error && <p className="notice warn small">{result.error}</p>}
          {result.answer && (
            <section className="card answer">
              <p className="muted small">Answer to "{asked}"</p>
              <AnswerText text={result.answer} sources={result.sources} />
              <p className="muted small">Written by Claude from your documents. Check the source before you rely on it.</p>
            </section>
          )}
          {result.hits.length === 0 ? (
            <div className="card empty"><strong>Nothing found for "{asked}"</strong>Try other words, or check the document is in the list.</div>
          ) : (
            <section className="stack">
              <h2>{result.answer ? 'Sources' : `${result.hits.length} match${result.hits.length === 1 ? '' : 'es'}`}</h2>
              <HitList hits={shown} numbered={!!result.answer} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
