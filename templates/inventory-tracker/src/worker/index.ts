import { Hono } from 'hono';
import { teamonly, type TeamOnly } from 'teamonly/server';
import { ADJUST_REASONS, type AdjustReason, type ImportResult, type ImportRow, type Item, type Me, type Movement, type Summary } from '../shared/types';
import { hasRole, peopleRoutes, rolesOf } from './roles';

const app = new Hono<TeamOnly>();
app.use('*', teamonly());
peopleRoutes(app);

const MAX_QTY = 1_000_000_000;
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** A whole number from 0 up, or null. */
function whole(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v.trim().replace(/,/g, '')) : v;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_QTY ? n : null;
}

app.get('/api/me', async (c) => {
  const me: Me = { ...c.var.ctx.user, owner: c.var.ctx.app.owner, roles: await rolesOf(c) };
  return c.json(me);
});

// Counts for the top of the page. `since` is the start of today in the browser's timezone.
app.get('/api/summary', async (c) => {
  const since = c.req.query('since') ?? '';
  const db = c.var.ctx.db;
  const [items, changes] = await db.batch([
    db.prepare('SELECT COUNT(*) AS items, SUM(qty <= reorder_level) AS low, SUM(qty = 0) AS out FROM items'),
    db.prepare("SELECT COUNT(*) AS n FROM movements WHERE created_at >= ? AND reason != 'new_item'").bind(since),
  ]);
  const i = items.results[0] as { items: number; low: number | null; out: number | null };
  const summary: Summary = { items: i.items, low: i.low ?? 0, out: i.out ?? 0, changes_today: (changes.results[0] as { n: number }).n };
  return c.json(summary);
});

// Search by SKU, name or location. An exact SKU match comes first.
app.get('/api/items', async (c) => {
  const q = text(c.req.query('q'), 100);
  const db = c.var.ctx.db;
  if (!q) return c.json((await db.prepare('SELECT * FROM items ORDER BY name LIMIT 300').all<Item>()).results);
  const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
  const { results } = await db
    .prepare(
      `SELECT * FROM items
       WHERE sku LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' OR location LIKE ? ESCAPE '\\'
       ORDER BY (sku = ?) DESC, name LIMIT 300`,
    )
    .bind(like, like, like, q)
    .all<Item>();
  return c.json(results);
});

// At or below the reorder level, emptiest first (by share of the reorder level left).
app.get('/api/items/low', async (c) => {
  const { results } = await c.var.ctx.db
    .prepare('SELECT * FROM items WHERE qty <= reorder_level ORDER BY CAST(qty AS REAL) / MAX(reorder_level, 1), name LIMIT 1000')
    .all<Item>();
  return c.json(results);
});

app.get('/api/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Item>();
  if (!item) return c.json({ error: 'Item not found.' }, 404);
  const { results } = await db.prepare('SELECT * FROM movements WHERE item_id = ? ORDER BY id DESC LIMIT 100').bind(id).all<Movement>();
  return c.json({ item, history: results });
});

app.post('/api/items', async (c) => {
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const sku = text(body.sku, 64);
  const name = text(body.name, 200);
  const location = text(body.location, 64);
  const qty = whole(body.qty ?? 0);
  const reorder = whole(body.reorder_level ?? 0);
  if (!sku) return c.json({ error: 'SKU is required.' }, 400);
  if (!name) return c.json({ error: 'Name is required.' }, 400);
  if (qty === null) return c.json({ error: 'Quantity must be a whole number, 0 or more.' }, 400);
  if (reorder === null) return c.json({ error: 'Reorder level must be a whole number, 0 or more.' }, 400);

  const db = c.var.ctx.db;
  const { email, name: by } = c.var.ctx.user;
  if (await db.prepare('SELECT 1 FROM items WHERE sku = ?').bind(sku).first()) return c.json({ error: `An item with SKU ${sku} already exists.` }, 409);
  const [, , created] = await db.batch([
    db.prepare('INSERT INTO items (sku, name, location, qty, reorder_level, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(sku, name, location, qty, reorder, email),
    db.prepare("INSERT INTO movements (item_id, change, qty_after, reason, by_email, by_name) SELECT id, qty, qty, 'new_item', ?, ? FROM items WHERE sku = ?").bind(email, by, sku),
    db.prepare('SELECT * FROM items WHERE sku = ?').bind(sku),
  ]);
  return c.json((created.results as Item[])[0], 201);
});

// Edit details. Counts change only through /adjust, so every change is in the history.
app.patch('/api/items/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const db = c.var.ctx.db;
  const item = await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Item>();
  if (!item) return c.json({ error: 'Item not found.' }, 404);
  const sku = body.sku === undefined ? item.sku : text(body.sku, 64);
  const name = body.name === undefined ? item.name : text(body.name, 200);
  const location = body.location === undefined ? item.location : text(body.location, 64);
  const reorder = body.reorder_level === undefined ? item.reorder_level : whole(body.reorder_level);
  if (!sku) return c.json({ error: 'SKU is required.' }, 400);
  if (!name) return c.json({ error: 'Name is required.' }, 400);
  if (reorder === null) return c.json({ error: 'Reorder level must be a whole number, 0 or more.' }, 400);
  if (sku.toLowerCase() !== item.sku.toLowerCase() && (await db.prepare('SELECT 1 FROM items WHERE sku = ? AND id <> ?').bind(sku, id).first())) {
    return c.json({ error: `An item with SKU ${sku} already exists.` }, 409);
  }
  const updated = await db
    .prepare(`UPDATE items SET sku = ?, name = ?, location = ?, reorder_level = ?, updated_at = ${NOW} WHERE id = ? RETURNING *`)
    .bind(sku, name, location, reorder, id)
    .first<Item>();
  return c.json(updated);
});

app.delete('/api/items/:id', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can delete items.' }, 403);
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const [, del] = await db.batch([
    db.prepare('DELETE FROM movements WHERE item_id = ?').bind(id),
    db.prepare('DELETE FROM items WHERE id = ?').bind(id),
  ]);
  if (!del.meta.changes) return c.json({ error: 'Item not found.' }, 404);
  return c.body(null, 204);
});

// Change a count. received adds, used and damaged take away, count sets the counted total.
app.post('/api/items/:id/adjust', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({}) as Record<string, unknown>);
  const reason = body.reason as AdjustReason;
  if (!ADJUST_REASONS.includes(reason)) return c.json({ error: 'Pick a reason.' }, 400);
  const amount = whole(body.qty);
  if (amount === null) return c.json({ error: 'Enter a whole number, 0 or more.' }, 400);
  if (reason !== 'count' && amount === 0) return c.json({ error: 'Enter how many.' }, 400);
  const note = text(body.note, 500);

  const db = c.var.ctx.db;
  const { email, name } = c.var.ctx.user;
  if (!(await db.prepare('SELECT 1 FROM items WHERE id = ?').bind(id).first())) return c.json({ error: 'Item not found.' }, 404);

  // One transaction: the history row is written from the current count, and the item changes only
  // if that row was written, so two people at once can't lose a change or take the count below zero.
  const delta = reason === 'received' ? amount : -amount;
  const statements =
    reason === 'count'
      ? [
          db.prepare('INSERT INTO movements (item_id, change, qty_after, reason, note, by_email, by_name) SELECT id, ? - qty, ?, ?, ?, ?, ? FROM items WHERE id = ?')
            .bind(amount, amount, reason, note, email, name, id),
          db.prepare(`UPDATE items SET qty = ?, updated_at = ${NOW} WHERE id = ? AND changes() > 0`).bind(amount, id),
        ]
      : [
          db.prepare('INSERT INTO movements (item_id, change, qty_after, reason, note, by_email, by_name) SELECT id, ?, qty + ?, ?, ?, ?, ? FROM items WHERE id = ? AND qty + ? >= 0')
            .bind(delta, delta, reason, note, email, name, id, delta),
          db.prepare(`UPDATE items SET qty = qty + ?, updated_at = ${NOW} WHERE id = ? AND changes() > 0`).bind(delta, id),
        ];
  const [ins] = await db.batch(statements);
  if (!ins.meta.changes) {
    const current = await db.prepare('SELECT qty FROM items WHERE id = ?').bind(id).first<{ qty: number }>();
    return c.json({ error: `Only ${current?.qty ?? 0} on hand, so you can't take away ${amount}.` }, 400);
  }
  return c.json(await db.prepare('SELECT * FROM items WHERE id = ?').bind(id).first<Item>());
});

// Recent changes across every item.
app.get('/api/history', async (c) => {
  const { results } = await c.var.ctx.db
    .prepare('SELECT m.*, i.sku, i.name FROM movements m JOIN items i ON i.id = m.item_id ORDER BY m.id DESC LIMIT 200')
    .all<Movement>();
  return c.json(results);
});

// Add or update items from a pasted spreadsheet. The browser sends up to 100 rows at a time.
app.post('/api/import', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can import items.' }, 403);
  const body = await c.req.json<{ rows?: unknown }>().catch(() => ({}) as { rows?: unknown });
  if (!Array.isArray(body.rows) || body.rows.length === 0) return c.json({ error: 'No rows to import.' }, 400);
  if (body.rows.length > 100) return c.json({ error: 'Send at most 100 rows at a time.' }, 400);

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of (body.rows as Record<string, unknown>[]).entries()) {
    const sku = text(raw?.sku, 64);
    const name = text(raw?.name, 200);
    const qty = whole(raw?.qty ?? 0);
    const reorder = whole(raw?.reorder_level ?? 0);
    const where = sku ? `SKU ${sku}` : `Row ${i + 1}`;
    if (!sku) return c.json({ error: `Row ${i + 1} has no SKU.` }, 400);
    if (!name) return c.json({ error: `${where} has no name.` }, 400);
    if (qty === null) return c.json({ error: `${where}: quantity must be a whole number, 0 or more.` }, 400);
    if (reorder === null) return c.json({ error: `${where}: reorder level must be a whole number, 0 or more.` }, 400);
    if (seen.has(sku.toLowerCase())) return c.json({ error: `SKU ${sku} appears more than once.` }, 400);
    seen.add(sku.toLowerCase());
    rows.push({ sku, name, location: text(raw?.location, 64), qty, reorder_level: reorder });
  }

  const db = c.var.ctx.db;
  const { email, name: by } = c.var.ctx.user;
  const result: ImportResult = { added: 0, updated: 0, unchanged: 0 };
  const statements: D1PreparedStatement[] = [];

  // Which SKUs exist already (in groups: at most 100 bound values per statement).
  const existing = new Map<string, Item>();
  for (let i = 0; i < rows.length; i += 90) {
    const group = rows.slice(i, i + 90).map((r) => r.sku);
    const { results } = await db.prepare(`SELECT * FROM items WHERE sku IN (${group.map(() => '?').join(',')})`).bind(...group).all<Item>();
    for (const it of results) existing.set(it.sku.toLowerCase(), it);
  }

  for (const r of rows) {
    const old = existing.get(r.sku.toLowerCase());
    if (!old) {
      result.added++;
      statements.push(
        db.prepare('INSERT INTO items (sku, name, location, qty, reorder_level, created_by) VALUES (?, ?, ?, ?, ?, ?)').bind(r.sku, r.name, r.location, r.qty, r.reorder_level, email),
        db.prepare("INSERT INTO movements (item_id, change, qty_after, reason, note, by_email, by_name) SELECT id, qty, qty, 'import', 'Added by spreadsheet import', ?, ? FROM items WHERE sku = ?").bind(email, by, r.sku),
      );
      continue;
    }
    if (old.name === r.name && old.location === r.location && old.qty === r.qty && old.reorder_level === r.reorder_level) {
      result.unchanged++;
      continue;
    }
    result.updated++;
    if (old.qty !== r.qty) {
      statements.push(
        db.prepare("INSERT INTO movements (item_id, change, qty_after, reason, note, by_email, by_name) SELECT id, ? - qty, ?, 'import', 'Count set by spreadsheet import', ?, ? FROM items WHERE id = ?").bind(r.qty, r.qty, email, by, old.id),
      );
    }
    statements.push(
      db.prepare(`UPDATE items SET name = ?, location = ?, qty = ?, reorder_level = ?, updated_at = ${NOW} WHERE id = ?`).bind(r.name, r.location, r.qty, r.reorder_level, old.id),
    );
  }
  if (statements.length) await db.batch(statements);
  return c.json(result);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
