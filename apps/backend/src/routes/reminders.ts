// Per-customer follow-up reminders. In-dashboard only — surfaced as a "due"
// list and on the customer panel. Scoped by the same contact access rules as
// the chat.

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { canAccessContact, contactScopeSql } from '../lib/scope.js';

export async function registerReminderRoutes(app: FastifyInstance) {
  // The cross-customer "due" list. ?scope=open (default) hides done reminders.
  app.get('/api/reminders', { preHandler: app.requireAuth }, async (req) => {
    const q = req.query as Record<string, string>;
    const includeDone = q.scope === 'all';

    const args: unknown[] = [];
    const conds: string[] = [];
    const scope = contactScopeSql(args, req.user!, 'c');
    if (scope !== 'TRUE') conds.push(scope);
    if (!includeDone) conds.push('r.done = FALSE');
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const { rows } = await query(
      `SELECT r.id, r.contact_id, r.due_at, r.note, r.done, r.created_at,
              c.display_name, c.profile_name, c.phone_e164
         FROM reminders r
         JOIN contacts c ON c.id = r.contact_id
        ${where}
        ORDER BY r.done ASC, r.due_at ASC`,
      args
    );
    return { reminders: rows };
  });

  app.get('/api/contacts/:id/reminders', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await canAccessContact(req.user!, id))) {
      reply.code(403).send({ error: 'forbidden' }); return reply;
    }
    const { rows } = await query(
      `SELECT id, contact_id, due_at, note, done, created_at, updated_at
         FROM reminders WHERE contact_id = $1
        ORDER BY done ASC, due_at ASC`,
      [id]
    );
    return { reminders: rows };
  });

  app.post('/api/contacts/:id/reminders', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!(await canAccessContact(req.user!, id))) {
      reply.code(403).send({ error: 'forbidden' }); return reply;
    }
    const body = z.object({
      due_at: z.string().datetime({ offset: true }),
      note: z.string().max(2000).optional(),
    }).parse(req.body);

    const { rows } = await query(
      `INSERT INTO reminders (contact_id, due_at, note, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id, contact_id, due_at, note, done, created_at, updated_at`,
      [id, body.due_at, body.note ?? null, req.user!.id]
    );
    reply.code(201).send({ reminder: rows[0] });
    return reply;
  });

  app.patch('/api/reminders/:id', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const own = await query<{ contact_id: string }>(
      `SELECT contact_id FROM reminders WHERE id = $1`, [id]
    );
    if (!own.rows[0]) { reply.code(404).send({ error: 'not_found' }); return reply; }
    if (!(await canAccessContact(req.user!, own.rows[0].contact_id))) {
      reply.code(403).send({ error: 'forbidden' }); return reply;
    }
    const body = z.object({
      due_at: z.string().datetime({ offset: true }).optional(),
      note: z.string().max(2000).nullable().optional(),
      done: z.boolean().optional(),
    }).parse(req.body);

    const sets: string[] = [];
    const args: unknown[] = [];
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined) continue;
      args.push(v); sets.push(`${k} = $${args.length}`);
    }
    if (sets.length === 0) return { ok: true };
    sets.push('updated_at = NOW()');
    args.push(id);
    const { rows } = await query(
      `UPDATE reminders SET ${sets.join(', ')} WHERE id = $${args.length} RETURNING *`,
      args
    );
    return { reminder: rows[0] };
  });

  app.delete('/api/reminders/:id', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const own = await query<{ contact_id: string }>(
      `SELECT contact_id FROM reminders WHERE id = $1`, [id]
    );
    if (!own.rows[0]) { reply.code(404).send({ error: 'not_found' }); return reply; }
    if (!(await canAccessContact(req.user!, own.rows[0].contact_id))) {
      reply.code(403).send({ error: 'forbidden' }); return reply;
    }
    await query(`DELETE FROM reminders WHERE id = $1`, [id]);
    return { ok: true };
  });
}
