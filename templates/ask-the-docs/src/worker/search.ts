// Full-text search over passages with SQLite FTS5 (built into D1).
import type { Hit } from '../shared/types';

const STOP = new Set(
  'a about all also am an and any are as at be been but by can could did do does for from get gets got has have how i if in into is it its just many me more most much my need no not of on only or other our should so some than that the their them then there these they this those to up us very was we what when where which who why will with would you your'.split(' '),
);

/** Words from the user's text, quoted so FTS5 treats them as plain words, never as query syntax. */
export function terms(q: string): string[] {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const useful = words.filter((w) => !STOP.has(w));
  return [...new Set(useful.length ? useful : words)].slice(0, 12);
}

const SQL = `
  SELECT p.id AS passage_id, p.doc_id, d.title, d.kind, (d.file_key IS NOT NULL) AS has_file, p.page, p.heading,
         snippet(passages_fts, 1, char(2), char(3), '...', 28) AS snippet
  FROM passages_fts
  JOIN passages p ON p.id = passages_fts.rowid
  JOIN docs d ON d.id = p.doc_id
  WHERE passages_fts MATCH ?
  ORDER BY bm25(passages_fts, 3.0, 1.0)
  LIMIT ?`;

/** Every word first (precise). If that finds nothing, any of the words, best matches first. */
export async function search(db: D1Database, q: string, limit = 20): Promise<Hit[]> {
  const t = terms(q);
  if (!t.length) return [];
  const quoted = t.map((w) => `"${w}"`);
  if (quoted.length > 1) {
    const { results } = await db.prepare(SQL).bind(quoted.join(' AND '), limit).all<Hit>();
    if (results.length >= 3) return results;
    const { results: loose } = await db.prepare(SQL).bind(quoted.join(' OR '), limit).all<Hit>();
    const seen = new Set(results.map((r) => r.passage_id));
    return [...results, ...loose.filter((r) => !seen.has(r.passage_id))].slice(0, limit);
  }
  const { results } = await db.prepare(SQL).bind(quoted[0], limit).all<Hit>();
  return results;
}
