import { Hono, type Context } from 'hono';
import { teamonly, type TeamOnly } from 'teamonly/server';
import { CATEGORIES, CATEGORY_LABELS, type Category, type Expense, type Me, type MonthReport } from '../shared/types';
import { hasRole, peopleRoutes, rolesOf } from './roles';

type C = Context<TeamOnly>;

// Receipt types we accept and serve back. SVG and HTML are left out on purpose (they can run scripts).
const RECEIPT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'image/heic': 'heic', 'image/heif': 'heif', 'application/pdf': 'pdf',
};
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
const COLUMNS = `id, amount_cents, category, description, spent_on, receipt_name, receipt_type, status,
  created_by, created_by_name, created_at, decided_by, decided_by_name, decided_at, decision_note`;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const app = new Hono<TeamOnly>();
app.use('*', teamonly());
peopleRoutes(app);

app.get('/api/me', async (c) => {
  const { user, app: info } = c.var.ctx;
  const me: Me = { ...user, owner: info.owner, roles: await rolesOf(c) };
  return c.json(me);
});

// ---------- your own expenses ----------

function parseAmount(v: unknown): number | null {
  if (typeof v !== 'string') return null;
  const s = v.replace(/[^\d.]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  return cents > 0 && cents <= 100_000_000 ? cents : null;
}

app.post('/api/expenses', async (c) => {
  const form = await c.req.parseBody();
  const amount = parseAmount(form.amount);
  if (amount === null) return c.json({ error: 'Enter an amount greater than zero, like 42.50.' }, 400);
  const category = form.category as Category;
  if (!CATEGORIES.includes(category)) return c.json({ error: 'Pick a category.' }, 400);
  const description = typeof form.description === 'string' ? form.description.trim() : '';
  if (!description) return c.json({ error: 'Say what it was for.' }, 400);
  if (description.length > 500) return c.json({ error: 'Keep the description under 500 characters.' }, 400);
  const spentOn = typeof form.spent_on === 'string' && DAY.test(form.spent_on) ? form.spent_on : null;
  if (!spentOn) return c.json({ error: 'Add the date of the purchase.' }, 400);

  const file = form.file;
  if (!(file instanceof File) || file.size === 0) return c.json({ error: 'Add a photo of the receipt.' }, 400);
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) return c.json({ error: 'The receipt must be a photo (JPG, PNG, HEIC, WebP) or a PDF.' }, 400);
  if (file.size > MAX_RECEIPT_BYTES) return c.json({ error: 'The receipt must be under 10 MB.' }, 400);

  const { email, name } = c.var.ctx.user;
  const key = `receipts/${crypto.randomUUID()}.${ext}`;
  await c.var.ctx.files.put(key, file, file.type);
  try {
    const row = await c.var.ctx.db
      .prepare(
        `INSERT INTO expenses (amount_cents, category, description, spent_on, receipt_key, receipt_name, receipt_type, created_by, created_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING ${COLUMNS}`,
      )
      .bind(amount, category, description, spentOn, key, file.name.slice(0, 200) || `receipt.${ext}`, file.type, email, name)
      .first<Expense>();
    return c.json(row, 201);
  } catch (err) {
    await c.var.ctx.files.delete(key).catch(() => {});
    throw err;
  }
});

app.get('/api/expenses/mine', async (c) => {
  const { results } = await c.var.ctx.db
    .prepare(`SELECT ${COLUMNS} FROM expenses WHERE created_by = ? ORDER BY id DESC LIMIT 500`)
    .bind(c.var.ctx.user.email)
    .all<Expense>();
  return c.json(results);
});

// People can withdraw their own expense while it is still pending.
app.delete('/api/expenses/:id', async (c) => {
  const row = await c.var.ctx.db
    .prepare("DELETE FROM expenses WHERE id = ? AND created_by = ? AND status = 'pending' RETURNING receipt_key")
    .bind(Number(c.req.param('id')), c.var.ctx.user.email)
    .first<{ receipt_key: string }>();
  if (!row) return c.json({ error: 'Only your own pending expenses can be withdrawn.' }, 404);
  await c.var.ctx.files.delete(row.receipt_key).catch(() => {});
  return c.body(null, 204);
});

// The receipt: for the person who submitted it, approvers and finance.
app.get('/api/expenses/:id/receipt', async (c) => {
  const row = await c.var.ctx.db
    .prepare('SELECT receipt_key, receipt_name, receipt_type, created_by FROM expenses WHERE id = ?')
    .bind(Number(c.req.param('id')))
    .first<{ receipt_key: string; receipt_name: string; receipt_type: string; created_by: string }>();
  if (!row) return c.json({ error: 'Expense not found.' }, 404);
  if (row.created_by !== c.var.ctx.user.email && !(await hasRole(c, 'approver', 'finance'))) {
    return c.json({ error: 'You can only see your own receipts.' }, 403);
  }
  const file = await c.var.ctx.files.get(row.receipt_key);
  if (!file) return c.json({ error: 'Receipt file not found.' }, 404);
  const headers = new Headers(file.headers);
  headers.set('content-type', RECEIPT_TYPES[row.receipt_type] ? row.receipt_type : 'application/octet-stream');
  headers.set('content-disposition', `inline; filename="${row.receipt_name.replace(/[^\w.\- ]/g, '_')}"`);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'private, max-age=3600');
  return new Response(file.body, { headers });
});

// ---------- approvers ----------

app.get('/api/approvals', async (c) => {
  if (!(await hasRole(c, 'approver'))) return c.json({ error: 'Only approvers can see this.' }, 403);
  const decided = c.req.query('status') === 'decided';
  const { results } = await c.var.ctx.db
    .prepare(
      decided
        ? `SELECT ${COLUMNS} FROM expenses WHERE status != 'pending' ORDER BY decided_at DESC LIMIT 100`
        : `SELECT ${COLUMNS} FROM expenses WHERE status = 'pending' ORDER BY id ASC LIMIT 500`,
    )
    .all<Expense>();
  return c.json(results);
});

app.post('/api/expenses/:id/decision', async (c) => {
  if (!(await hasRole(c, 'approver'))) return c.json({ error: 'Only approvers can approve or reject expenses.' }, 403);
  const body = await c.req.json<{ decision?: string; note?: string }>().catch(() => ({}) as { decision?: string; note?: string });
  if (body.decision !== 'approved' && body.decision !== 'rejected') return c.json({ error: 'Choose approve or reject.' }, 400);
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';
  if (body.decision === 'rejected' && !note) return c.json({ error: 'Add a note saying why, so they can fix it.' }, 400);
  const { email, name } = c.var.ctx.user;
  const id = Number(c.req.param('id'));

  // One decision per expense, and never on your own.
  const row = await c.var.ctx.db
    .prepare(
      `UPDATE expenses SET status = ?, decided_by = ?, decided_by_name = ?, decision_note = ?,
         decided_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE id = ? AND status = 'pending' AND created_by != ? RETURNING ${COLUMNS}`,
    )
    .bind(body.decision, email, name, note || null, id, email)
    .first<Expense>();
  if (row) return c.json(row);

  const existing = await c.var.ctx.db.prepare('SELECT status, created_by FROM expenses WHERE id = ?').bind(id).first<{ status: string; created_by: string }>();
  if (!existing) return c.json({ error: 'Expense not found.' }, 404);
  if (existing.created_by === email) return c.json({ error: 'Someone else has to approve your own expense.' }, 403);
  return c.json({ error: `This expense was already ${existing.status}.` }, 409);
});

// ---------- finance ----------
// The browser sends the start and end of the month in its own timezone, as UTC instants.

function range(c: C): { from: string; to: string } | null {
  const from = c.req.query('from') ?? '';
  const to = c.req.query('to') ?? '';
  return INSTANT.test(from) && INSTANT.test(to) && from < to ? { from: from.replace(/\.\d+Z$/, 'Z'), to: to.replace(/\.\d+Z$/, 'Z') } : null;
}

async function approvedBetween(c: C, from: string, to: string) {
  const { results } = await c.var.ctx.db
    .prepare(`SELECT ${COLUMNS} FROM expenses WHERE status = 'approved' AND decided_at >= ? AND decided_at < ? ORDER BY decided_at ASC`)
    .bind(from, to)
    .all<Expense>();
  return results;
}

app.get('/api/finance', async (c) => {
  if (!(await hasRole(c, 'finance'))) return c.json({ error: 'Only finance can see this.' }, 403);
  const r = range(c);
  if (!r) return c.json({ error: 'Pick a month.' }, 400);
  const expenses = await approvedBetween(c, r.from, r.to);
  const totals = new Map<Category, { total_cents: number; count: number }>();
  for (const e of expenses) {
    const t = totals.get(e.category) ?? { total_cents: 0, count: 0 };
    t.total_cents += e.amount_cents;
    t.count++;
    totals.set(e.category, t);
  }
  const report: MonthReport = {
    total_cents: expenses.reduce((s, e) => s + e.amount_cents, 0),
    by_category: [...totals].map(([category, t]) => ({ category, ...t })).sort((a, b) => b.total_cents - a.total_cents),
    expenses,
  };
  return c.json(report);
});

function csvCell(v: string | number | null): string {
  let s = v === null ? '' : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`; // stop spreadsheets running it as a formula
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

app.get('/api/finance.csv', async (c) => {
  if (!(await hasRole(c, 'finance'))) return c.json({ error: 'Only finance can download this.' }, 403);
  const r = range(c);
  if (!r) return c.json({ error: 'Pick a month.' }, 400);
  const label = (c.req.query('label') ?? 'month').replace(/[^\w-]/g, '');
  const origin = new URL(c.req.url).origin;
  const lines = [['ID', 'Date of purchase', 'Submitted by', 'Email', 'Category', 'Description', 'Amount', 'Approved by', 'Approved at (UTC)', 'Note', 'Receipt'].join(',')];
  for (const e of await approvedBetween(c, r.from, r.to)) {
    lines.push(
      [e.id, e.spent_on, e.created_by_name, e.created_by, CATEGORY_LABELS[e.category], e.description, (e.amount_cents / 100).toFixed(2),
        e.decided_by_name, e.decided_at, e.decision_note, `${origin}/api/expenses/${e.id}/receipt`].map(csvCell).join(','),
    );
  }
  return c.body('﻿' + lines.join('\r\n') + '\r\n', 200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': `attachment; filename="approved-expenses-${label}.csv"`,
  });
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));
app.onError((err, c) => {
  if (err instanceof Error && err.message.startsWith("File storage isn't turned on")) {
    return c.json({ error: "Receipt uploads need file storage, which isn't turned on for this app yet." }, 503);
  }
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
