import { Hono, type Context } from 'hono';
import { teamonly, type TeamOnly } from 'teamonly/server';
import { STATUSES, type Features, type Me, type QueueCounts, type Request, type Status } from '../shared/types';
import { hasRole, peopleRoutes, rolesOf } from './roles';

type C = Context<TeamOnly>;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NOW = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now')";

const app = new Hono<TeamOnly>();
app.use('*', teamonly());
peopleRoutes(app);

const isHandler = (c: C) => hasRole(c, 'handler');

app.get('/api/me', async (c) => {
  const me: Me = { ...c.var.ctx.user, owner: c.var.ctx.app.owner, roles: await rolesOf(c) };
  return c.json(me);
});

// Optional features turn on when their secret is set.
app.get('/api/features', (c) => c.json({ slack: !!c.var.ctx.secrets.get('SLACK_WEBHOOK_URL') } satisfies Features));

app.post('/api/requests', async (c) => {
  const body = await c.req.json<{ title?: string; details?: string; needed_by?: string }>().catch(() => null);
  const title = body?.title?.trim() ?? '';
  if (!title) return c.json({ error: 'Say what you need.' }, 400);
  const neededBy = body?.needed_by && DAY.test(body.needed_by) ? body.needed_by : null;
  const { email, name } = c.var.ctx.user;
  const row = await c.var.ctx.db
    .prepare('INSERT INTO requests (title, details, needed_by, created_by, created_by_name) VALUES (?, ?, ?, ?, ?) RETURNING *')
    .bind(title.slice(0, 200), (body?.details ?? '').trim().slice(0, 5000), neededBy, email, name || email)
    .first<Request>();

  // Post to Slack after the response. A webhook failure never breaks the request.
  const hook = c.var.ctx.secrets.get('SLACK_WEBHOOK_URL');
  if (row && hook) {
    const link = `${new URL(c.req.url).origin}/#/requests/${row.id}`;
    const text = `New request from ${row.created_by_name}: ${row.title}${row.needed_by ? ` (needed by ${row.needed_by})` : ''}\n${link}`;
    c.executionCtx.waitUntil(
      fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) })
        .then((r) => { if (!r.ok) console.error('Webhook failed', r.status); })
        .catch((e) => console.error('Webhook error', e)),
    );
  }
  return c.json(row, 201);
});

app.get('/api/requests/mine', async (c) => {
  const { results } = await c.var.ctx.db
    .prepare('SELECT * FROM requests WHERE created_by = ? ORDER BY id DESC LIMIT 200')
    .bind(c.var.ctx.user.email)
    .all<Request>();
  return c.json(results);
});

// One request: for the person who asked and for the people who handle requests.
app.get('/api/requests/:id', async (c) => {
  const row = await c.var.ctx.db.prepare('SELECT * FROM requests WHERE id = ?').bind(Number(c.req.param('id'))).first<Request>();
  if (!row || (row.created_by !== c.var.ctx.user.email && !(await isHandler(c)))) return c.json({ error: 'Request not found.' }, 404);
  return c.json(row);
});

// The person who asked can take back a request nobody has started.
app.delete('/api/requests/:id', async (c) => {
  const { meta } = await c.var.ctx.db
    .prepare("DELETE FROM requests WHERE id = ? AND created_by = ? AND status = 'new'")
    .bind(Number(c.req.param('id')), c.var.ctx.user.email)
    .run();
  if (!meta.changes) return c.json({ error: 'Only your own requests that nobody has started can be withdrawn.' }, 409);
  return c.body(null, 204);
});

// The queue: oldest first for open requests, newest first for done ones.
app.get('/api/queue', async (c) => {
  if (!(await isHandler(c))) return c.json({ error: 'Only the people who handle requests can see the queue.' }, 403);
  const status = c.req.query('status');
  const db = c.var.ctx.db;
  const where = STATUSES.includes(status as Status) ? 'WHERE status = ?' : status === 'open' ? "WHERE status != 'done'" : '';
  const order = status === 'done' ? 'ORDER BY done_at DESC' : "ORDER BY CASE status WHEN 'done' THEN 1 ELSE 0 END, COALESCE(needed_by, '9999') ASC, id ASC";
  const stmt = db.prepare(`SELECT * FROM requests ${where} ${order} LIMIT 500`);
  const [list, counts] = await db.batch([
    where.includes('?') ? stmt.bind(status) : stmt,
    db.prepare('SELECT status, COUNT(*) AS n FROM requests GROUP BY status'),
  ]);
  const totals: QueueCounts = { new: 0, in_progress: 0, done: 0 };
  for (const r of counts.results as { status: Status; n: number }[]) totals[r.status] = r.n;
  return c.json({ requests: list.results as Request[], counts: totals });
});

app.patch('/api/requests/:id', async (c) => {
  if (!(await isHandler(c))) return c.json({ error: 'Only the people who handle requests can change them.' }, 403);
  const id = Number(c.req.param('id'));
  const body = await c.req.json<{ status?: string; reply?: string | null; assign?: 'me' | 'nobody' }>().catch(() => null);
  if (!body) return c.json({ error: 'Nothing to change.' }, 400);
  const db = c.var.ctx.db;
  const current = await db.prepare('SELECT * FROM requests WHERE id = ?').bind(id).first<Request>();
  if (!current) return c.json({ error: 'Request not found.' }, 404);

  const status = body.status === undefined ? current.status : (body.status as Status);
  if (!STATUSES.includes(status)) return c.json({ error: 'Pick a status.' }, 400);
  const reply = body.reply === undefined ? current.reply : body.reply?.trim().slice(0, 5000) || null;
  const { email, name } = c.var.ctx.user;
  let assignee: [string | null, string | null] = [current.assigned_to, current.assigned_to_name];
  if (body.assign === 'me') assignee = [email, name];
  if (body.assign === 'nobody') assignee = [null, null];
  // Starting work on an unassigned request assigns it to you.
  if (status === 'in_progress' && !assignee[0]) assignee = [email, name];

  const row = await db
    .prepare(
      `UPDATE requests SET status = ?, reply = ?, assigned_to = ?, assigned_to_name = ?, updated_by_name = ?, updated_at = ${NOW},
         done_at = CASE WHEN ? = 'done' THEN COALESCE(done_at, ${NOW}) ELSE NULL END
       WHERE id = ? RETURNING *`,
    )
    .bind(status, reply, assignee[0], assignee[1], name, status, id)
    .first<Request>();
  return c.json(row);
});

app.notFound((c) => c.json({ error: 'Not found.' }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong.' }, 500);
});

export default app;
