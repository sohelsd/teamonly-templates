import { Hono } from 'hono';
import { teamonly, type TeamOnly } from 'teamonly/server';
import type { Customer, CustomerInput, ImportRun, Me, Note, Summary } from '../shared/types';
import { hasRole, peopleRoutes, rolesOf } from './roles';

const app = new Hono<TeamOnly>();
app.use('*', teamonly());
peopleRoutes(app);

const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";
const COLUMNS = 'c.id, c.account_number, c.name, c.company, c.email, c.phone, c.plan, c.account_manager, c.customer_since, c.in_latest, c.updated_at';
const digits = (s: string) => s.replace(/\D/g, '');
const clean = (v: unknown, max = 300) => (v == null ? '' : String(v).trim().slice(0, max));

app.get('/api/me', async (c) => {
  const me: Me = { ...c.var.ctx.user, owner: c.var.ctx.app.owner, roles: await rolesOf(c) };
  return c.json(me);
});

// `since` is a week ago in the browser's timezone.
app.get('/api/summary', async (c) => {
  const db = c.var.ctx.db;
  const [count, notes, last] = await db.batch([
    db.prepare('SELECT COUNT(*) AS n FROM customers WHERE in_latest = 1'),
    db.prepare('SELECT COUNT(*) AS n FROM notes WHERE created_at >= ?').bind(c.req.query('since') ?? ''),
    db.prepare("SELECT * FROM imports WHERE status = 'done' ORDER BY id DESC LIMIT 1"),
  ]);
  const summary: Summary = {
    customers: (count.results[0] as { n: number }).n,
    notes_this_week: (notes.results[0] as { n: number }).n,
    lastImport: (last.results[0] as ImportRun | undefined) ?? null,
  };
  return c.json(summary);
});

// Search every field at once: each word has to match somewhere. An exact account number comes first.
app.get('/api/customers', async (c) => {
  const q = clean(c.req.query('q'), 200).toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
  const where: string[] = [];
  const params: string[] = [];
  for (const t of terms) {
    const esc = t.replace(/[\\%_]/g, (m) => `\\${m}`);
    const d = digits(t);
    if (d.length >= 3 && d !== t) {
      // "(555) 123" also finds the phone number stored as digits
      where.push("(c.search_text LIKE ? ESCAPE '\\' OR c.search_text LIKE ? ESCAPE '\\')");
      params.push(`%${esc}%`, `%${d}%`);
    } else {
      where.push("c.search_text LIKE ? ESCAPE '\\'");
      params.push(`%${esc}%`);
    }
  }
  if (c.req.query('all') !== '1') where.push('c.in_latest = 1');
  const sql = `SELECT ${COLUMNS},
      (SELECT COUNT(*) FROM notes n WHERE n.customer_id = c.id) AS note_count,
      (SELECT MAX(created_at) FROM notes n WHERE n.customer_id = c.id) AS last_note_at
    FROM customers c ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY (lower(c.account_number) = ?) DESC, c.name COLLATE NOCASE LIMIT 50`;
  const { results } = await c.var.ctx.db.prepare(sql).bind(...params, q).all<Customer>();
  return c.json(results);
});

app.get('/api/customers/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const customer = await db.prepare(`SELECT ${COLUMNS} FROM customers c WHERE id = ?`).bind(id).first<Customer>();
  if (!customer) return c.json({ error: 'Customer not found.' }, 404);
  const { results: notes } = await db.prepare('SELECT * FROM notes WHERE customer_id = ? ORDER BY id DESC').bind(id).all<Note>();
  return c.json({ customer, notes });
});

app.post('/api/customers/:id/notes', async (c) => {
  const { body } = await c.req.json<{ body?: string }>().catch(() => ({}) as { body?: string });
  const text = body?.trim();
  if (!text) return c.json({ error: 'Write a note first.' }, 400);
  const { email, name } = c.var.ctx.user;
  const note = await c.var.ctx.db
    .prepare('INSERT INTO notes (customer_id, body, author_email, author_name) SELECT id, ?, ?, ? FROM customers WHERE id = ? RETURNING *')
    .bind(text.slice(0, 5000), email, name, Number(c.req.param('id')))
    .first<Note>();
  if (!note) return c.json({ error: 'Customer not found.' }, 404);
  return c.json(note, 201);
});

// People remove their own notes; admins can remove any.
app.delete('/api/notes/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const { meta } = (await hasRole(c, 'admin'))
    ? await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run()
    : await db.prepare('DELETE FROM notes WHERE id = ? AND author_email = ?').bind(id, c.var.ctx.user.email).run();
  if (!meta.changes) return c.json({ error: 'Note not found.' }, 404);
  return c.body(null, 204);
});

// ---- Spreadsheet upload (admins). The browser reads the CSV and sends it in chunks of 500. ----

app.get('/api/imports', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can see uploads.' }, 403);
  const { results } = await c.var.ctx.db.prepare('SELECT * FROM imports ORDER BY id DESC LIMIT 20').all<ImportRun>();
  return c.json(results);
});

app.post('/api/imports', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can upload the customer list.' }, 403);
  const { fileName } = await c.req.json<{ fileName?: string }>().catch(() => ({}) as { fileName?: string });
  const { email, name } = c.var.ctx.user;
  const run = await c.var.ctx.db
    .prepare('INSERT INTO imports (file_name, uploaded_by, uploaded_by_name) VALUES (?, ?, ?) RETURNING *')
    .bind(clean(fileName, 200) || 'customers.csv', email, name)
    .first<ImportRun>();
  return c.json(run, 201);
});

app.post('/api/imports/:id/rows', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can upload the customer list.' }, 403);
  const importId = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  if (!(await db.prepare("SELECT 1 FROM imports WHERE id = ? AND status = 'running'").bind(importId).first())) {
    return c.json({ error: 'This upload is not running. Start it again.' }, 409);
  }
  const rows = await c.req.json<Partial<CustomerInput>[]>().catch(() => null);
  if (!Array.isArray(rows) || rows.length > 1000) return c.json({ error: 'Send up to 1000 rows at a time.' }, 400);

  const prepared = rows
    .map((r) => {
      const row: CustomerInput = {
        account_number: clean(r.account_number, 100),
        name: clean(r.name),
        company: clean(r.company),
        email: clean(r.email).toLowerCase(),
        phone: clean(r.phone, 60),
        plan: clean(r.plan, 100),
        account_manager: clean(r.account_manager),
        customer_since: clean(r.customer_since, 40),
      };
      const search = [row.account_number, row.name, row.company, row.email, row.phone, digits(row.phone), row.plan, row.account_manager].join(' | ').toLowerCase();
      return { ...row, match_key: (row.account_number || row.email).toLowerCase(), search_text: search };
    })
    .filter((r) => r.match_key);

  if (prepared.length) {
    await db.batch([
      db.prepare(
        `INSERT INTO customers (match_key, account_number, name, company, email, phone, plan, account_manager, customer_since, search_text, last_import_id, in_latest, updated_at)
         SELECT json_extract(value, '$.match_key'), json_extract(value, '$.account_number'), json_extract(value, '$.name'),
                json_extract(value, '$.company'), json_extract(value, '$.email'), json_extract(value, '$.phone'), json_extract(value, '$.plan'),
                json_extract(value, '$.account_manager'), json_extract(value, '$.customer_since'), json_extract(value, '$.search_text'), ?, 1, ${NOW}
         FROM json_each(?) WHERE true
         ON CONFLICT (match_key) DO UPDATE SET
           account_number = excluded.account_number, name = excluded.name, company = excluded.company, email = excluded.email,
           phone = excluded.phone, plan = excluded.plan, account_manager = excluded.account_manager, customer_since = excluded.customer_since,
           search_text = excluded.search_text, last_import_id = excluded.last_import_id, in_latest = 1, updated_at = excluded.updated_at`,
      ).bind(importId, JSON.stringify(prepared)),
      db.prepare('UPDATE imports SET row_count = row_count + ? WHERE id = ?').bind(prepared.length, importId),
    ]);
  }
  return c.json({ imported: prepared.length, skipped: rows.length - prepared.length });
});

// Customers not in this upload are marked "not in the latest upload". Their notes are kept.
app.post('/api/imports/:id/finish', async (c) => {
  if (!(await hasRole(c, 'admin'))) return c.json({ error: 'Only admins can upload the customer list.' }, 403);
  const importId = Number(c.req.param('id'));
  const db = c.var.ctx.db;
  const run = await db.prepare("SELECT * FROM imports WHERE id = ? AND status = 'running'").bind(importId).first<ImportRun>();
  if (!run) return c.json({ error: 'This upload is not running.' }, 409);
  if (!run.row_count) return c.json({ error: 'No customers with an account number or email were found in the file.' }, 400);
  const [, done] = await db.batch([
    db.prepare('UPDATE customers SET in_latest = 0 WHERE in_latest = 1 AND (last_import_id IS NULL OR last_import_id != ?)').bind(importId),
    db.prepare(`UPDATE imports SET status = 'done', removed_count = changes(), finished_at = ${NOW} WHERE id = ? RETURNING *`).bind(importId),
  ]);
  return c.json(done.results[0] as ImportRun);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
