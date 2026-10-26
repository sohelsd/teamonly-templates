// Roles inside the app. The owner (the person who first deployed it) has every role and
// adds everyone else on the People page. Nobody can give themselves a role.
import type { Context, Hono } from 'hono';
import type { TeamOnly } from 'teamonly/server';
import { ROLES, type Role, type RoleRow } from '../shared/types';

type C = Context<TeamOnly>;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const isRole = (r: unknown): r is Role => ROLES.some((x) => x.id === r);

/** The signed-in person's roles. The owner has all of them. */
export async function rolesOf(c: C): Promise<Role[]> {
  if (c.var.ctx.user.isOwner) return ROLES.map((r) => r.id);
  const { results } = await c.var.ctx.db
    .prepare('SELECT role FROM roles WHERE email = ?')
    .bind(c.var.ctx.user.email)
    .all<{ role: string }>();
  return results.map((r) => r.role).filter(isRole);
}

export async function hasRole(c: C, ...roles: Role[]): Promise<boolean> {
  const mine = await rolesOf(c);
  return roles.some((r) => mine.includes(r));
}

/** GET/POST/DELETE /api/people. Only the owner and admins can see or change roles. */
export function peopleRoutes(app: Hono<TeamOnly>) {
  const canManage = (c: C) => hasRole(c, 'admin' as Role);

  app.get('/api/people', async (c) => {
    if (!(await canManage(c))) return c.json({ error: 'Only the app owner and admins can see this.' }, 403);
    const { results } = await c.var.ctx.db.prepare('SELECT * FROM roles ORDER BY role, email').all<RoleRow>();
    return c.json(results);
  });

  app.post('/api/people', async (c) => {
    if (!(await canManage(c))) return c.json({ error: 'Only the app owner and admins can change this.' }, 403);
    const body = await c.req.json<{ email?: string; role?: string }>().catch(() => ({}) as { email?: string; role?: string });
    const email = body.email?.trim().toLowerCase() ?? '';
    if (!EMAIL.test(email)) return c.json({ error: 'Enter a work email address.' }, 400);
    if (!isRole(body.role)) return c.json({ error: 'Pick a role.' }, 400);
    const row = await c.var.ctx.db
      .prepare('INSERT INTO roles (email, role, added_by) VALUES (?, ?, ?) ON CONFLICT DO NOTHING RETURNING *')
      .bind(email, body.role, c.var.ctx.user.email)
      .first<RoleRow>();
    if (!row) return c.json({ error: `${email} already has that role.` }, 409);
    return c.json(row, 201);
  });

  app.delete('/api/people/:role/:email', async (c) => {
    if (!(await canManage(c))) return c.json({ error: 'Only the app owner and admins can change this.' }, 403);
    const { meta } = await c.var.ctx.db
      .prepare('DELETE FROM roles WHERE email = ? AND role = ?')
      .bind(c.req.param('email').toLowerCase(), c.req.param('role'))
      .run();
    if (!meta.changes) return c.json({ error: 'Not found.' }, 404);
    return c.body(null, 204);
  });
}
