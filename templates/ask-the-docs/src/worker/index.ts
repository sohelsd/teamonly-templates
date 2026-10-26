import { Hono } from 'hono';
import { teamonly, type TeamOnly } from 'teamonly/server';
import type { Answer, Doc, Features, Hit, Me, Passage, Source } from '../shared/types';
import { askClaude } from './claude';
import { fromMarkdown, fromPdf, fromText, kindOf, type Piece } from './extract';
import { hasRole, peopleRoutes, rolesOf } from './roles';
import { search } from './search';

const app = new Hono<TeamOnly>();
app.use('*', teamonly());
peopleRoutes(app);

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PASSAGES = 4000;
const DOC_COLUMNS = `id, title, file_name, kind, (file_key IS NOT NULL) AS has_file, size_bytes, pages, passage_count, uploaded_by, uploaded_by_name, created_at`;
const NO_FILES = "File storage isn't turned on";

app.get('/api/me', async (c) => {
  const me: Me = { ...c.var.ctx.user, owner: c.var.ctx.app.owner, roles: await rolesOf(c) };
  return c.json(me);
});

// Answers turn on when the ANTHROPIC_API_KEY secret is set. Without it the app is a search tool.
app.get('/api/features', (c) => c.json({ answers: !!c.var.ctx.secrets.get('ANTHROPIC_API_KEY') } satisfies Features));

app.get('/api/docs', async (c) => {
  const { results } = await c.var.ctx.db.prepare(`SELECT ${DOC_COLUMNS} FROM docs ORDER BY title COLLATE NOCASE`).all<Doc>();
  return c.json(results);
});

app.post('/api/docs', async (c) => {
  if (!(await hasRole(c, 'editor'))) return c.json({ error: 'Only editors can add documents.' }, 403);
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File) || file.size === 0) return c.json({ error: 'Choose a file.' }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: 'Files must be under 20 MB.' }, 400);
  const kind = kindOf(file);
  if (!kind) return c.json({ error: 'Upload a PDF, a Markdown file (.md) or a text file (.txt). For Word or Google Docs, save as PDF first.' }, 400);

  const bytes = await file.arrayBuffer();
  const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Untitled';
  let title = typeof form.title === 'string' && form.title.trim() ? form.title.trim().slice(0, 200) : '';
  let pieces: Piece[];
  let pages: number | null = null;
  if (kind === 'pdf') {
    try {
      const pdf = await fromPdf(bytes);
      pieces = pdf.pieces;
      pages = pdf.pages;
      title ||= pdf.title ?? baseName;
    } catch (e) {
      console.error('PDF read failed', e);
      return c.json({ error: 'Could not read this PDF. If it is password protected, remove the password and try again.' }, 400);
    }
    if (!pieces.length) return c.json({ error: 'This PDF has no text in it (it may be a scan of paper pages). Upload a version with real text, or paste the text into a .txt file.' }, 400);
  } else {
    const text = new TextDecoder().decode(bytes);
    if (kind === 'markdown') {
      const md = fromMarkdown(text);
      pieces = md.pieces;
      title ||= md.title ?? baseName;
    } else {
      const txt = fromText(text);
      pieces = txt.pieces;
      title ||= txt.title ?? baseName;
    }
    if (!pieces.length) return c.json({ error: 'This file is empty.' }, 400);
  }
  if (pieces.length > MAX_PASSAGES) return c.json({ error: 'This document is too long. Split it into smaller files.' }, 400);

  // Keep the original so people can open it (and PDFs at the right page). Search works without it.
  let key: string | null = `docs/${crypto.randomUUID()}`;
  try {
    await c.var.ctx.files.put(key, bytes, kind === 'pdf' ? 'application/pdf' : kind === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
  } catch (e) {
    if (!(e instanceof Error && e.message.startsWith(NO_FILES))) throw e;
    key = null;
  }

  const db = c.var.ctx.db;
  const { email, name } = c.var.ctx.user;
  const doc = await db
    .prepare(
      `INSERT INTO docs (title, file_name, kind, file_key, size_bytes, pages, passage_count, uploaded_by, uploaded_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${DOC_COLUMNS}`,
    )
    .bind(title, file.name.slice(0, 200), kind, key, file.size, pages, pieces.length, email, name)
    .first<Doc>();
  if (!doc) throw new Error('Insert failed');

  // Passages go in as JSON, a few hundred per statement, then into the search index in one go.
  const insert = `INSERT INTO passages (doc_id, ord, page, heading, body)
    SELECT ?, json_extract(value, '$.o'), json_extract(value, '$.p'), json_extract(value, '$.h'), json_extract(value, '$.b') FROM json_each(?)`;
  const statements: D1PreparedStatement[] = [];
  for (let i = 0; i < pieces.length; i += 200) {
    const group = pieces.slice(i, i + 200).map((p, j) => ({ o: i + j, p: p.page, h: p.heading, b: p.body }));
    statements.push(db.prepare(insert).bind(doc.id, JSON.stringify(group)));
  }
  statements.push(db.prepare('INSERT INTO passages_fts (rowid, heading, body) SELECT id, heading, body FROM passages WHERE doc_id = ?').bind(doc.id));
  try {
    await db.batch(statements);
  } catch (e) {
    await db.prepare('DELETE FROM docs WHERE id = ?').bind(doc.id).run();
    if (key) await c.var.ctx.files.delete(key).catch(() => {});
    throw e;
  }
  return c.json(doc, 201);
});

// One document with its passages, for the reader view.
app.get('/api/docs/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const doc = await db.prepare(`SELECT ${DOC_COLUMNS} FROM docs WHERE id = ?`).bind(id).first<Doc>();
  if (!doc) return c.json({ error: 'Document not found.' }, 404);
  const { results } = await db.prepare('SELECT * FROM passages WHERE doc_id = ? ORDER BY ord').bind(id).all<Passage>();
  return c.json({ doc, passages: results });
});

// The original file. PDFs open in the browser's viewer, so /file#page=3 opens page 3.
app.get('/api/docs/:id/file', async (c) => {
  const row = await c.var.ctx.db.prepare('SELECT file_key, file_name, kind FROM docs WHERE id = ?').bind(Number(c.req.param('id'))).first<{ file_key: string | null; file_name: string; kind: string }>();
  if (!row?.file_key) return c.json({ error: 'The original file is not stored for this document.' }, 404);
  const file = await c.var.ctx.files.get(row.file_key);
  if (!file) return c.json({ error: 'File not found.' }, 404);
  const headers = new Headers(file.headers);
  headers.set('content-type', row.kind === 'pdf' ? 'application/pdf' : 'text/plain; charset=utf-8');
  headers.set('content-disposition', `inline; filename="${row.file_name.replace(/[^\w.\- ]/g, '_')}"`);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(file.body, { headers });
});

app.delete('/api/docs/:id', async (c) => {
  if (!(await hasRole(c, 'editor'))) return c.json({ error: 'Only editors can remove documents.' }, 403);
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const doc = await db.prepare('SELECT file_key FROM docs WHERE id = ?').bind(id).first<{ file_key: string | null }>();
  if (!doc) return c.json({ error: 'Document not found.' }, 404);
  await db.batch([
    db.prepare('DELETE FROM passages_fts WHERE rowid IN (SELECT id FROM passages WHERE doc_id = ?)').bind(id),
    db.prepare('DELETE FROM passages WHERE doc_id = ?').bind(id),
    db.prepare('DELETE FROM docs WHERE id = ?').bind(id),
  ]);
  if (doc.file_key) await c.var.ctx.files.delete(doc.file_key).catch(() => {});
  return c.body(null, 204);
});

app.get('/api/search', async (c) => {
  const q = (c.req.query('q') ?? '').slice(0, 300);
  return c.json(await search(c.var.ctx.db, q));
});

// Search, then (when the key is set) have Claude answer from the best passages, with numbered sources.
app.post('/api/ask', async (c) => {
  const { question } = await c.req.json<{ question?: string }>().catch(() => ({}) as { question?: string });
  const q = question?.trim().slice(0, 500) ?? '';
  if (!q) return c.json({ error: 'Type a question.' }, 400);
  const db = c.var.ctx.db;
  const hits = await search(db, q, 20);
  const key = c.var.ctx.secrets.get('ANTHROPIC_API_KEY');
  if (!key || !hits.length) return c.json({ answer: null, sources: [], hits } satisfies Answer);

  const top = hits.slice(0, 8);
  const { results: bodies } = await db
    .prepare(`SELECT id, body FROM passages WHERE id IN (${top.map(() => '?').join(',')})`)
    .bind(...top.map((h) => h.passage_id))
    .all<{ id: number; body: string }>();
  const body = new Map(bodies.map((b) => [b.id, b.body]));
  const sources: Source[] = top.map((h, i) => ({ ...h, n: i + 1 }));
  const where = (h: Hit) => [h.page ? `page ${h.page}` : '', h.heading && !h.heading.startsWith('Page ') ? h.heading : ''].filter(Boolean).join(', ') || 'start';
  const result = await askClaude(key, q, sources.map((s) => ({ n: s.n, title: s.title, where: where(s), body: body.get(s.passage_id) ?? '' })));
  const answer: Answer = 'text' in result ? { answer: result.text, sources, hits } : { answer: null, sources: [], hits, error: result.error };
  return c.json(answer);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
