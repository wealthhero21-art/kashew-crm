import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query } from '../db/client.js';
import { issueOtp, verifyOtp } from '../auth/otp.js';
import { signSession } from '../auth/jwt.js';
import { verifyPassword, maskPhone } from '../auth/password.js';
import type { User } from '@crm/shared';

interface UserWithSecret extends User {
  password_hash: string | null;
}

function normalisePhone(input: string): string {
  // Accept '9999999999', '919999999999', '+919999999999' — store as E.164.
  const digits = input.replace(/[^\d]/g, '');
  if (!digits) throw new Error('invalid phone');
  return input.startsWith('+') ? `+${digits}` : `+${digits}`;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  // ---- Step 1: email + password ----
  // On success, an OTP is issued to the user's WhatsApp number; the frontend
  // then collects the OTP (step 2) and verifies it to get a JWT session.
  app.post('/auth/login', async (req, reply) => {
    const body = z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const { rows } = await query<UserWithSecret>(
      `SELECT id, phone_e164, name, email, role, active, password_hash, created_at
         FROM users WHERE LOWER(email) = LOWER($1)`,
      [body.email]
    );
    const user = rows[0];
    if (!user || !user.active || !user.password_hash) {
      // Generic message — don't reveal which factor failed.
      reply.code(401).send({ error: 'invalid_credentials' });
      return reply;
    }
    const ok = await verifyPassword(body.password, user.password_hash);
    if (!ok) {
      reply.code(401).send({ error: 'invalid_credentials' });
      return reply;
    }
    try {
      const result = await issueOtp(user.phone_e164);
      if (!result.sent) {
        reply.code(429).send({ error: 'cooldown', retry_after: result.cooldownRemaining });
        return reply;
      }
      return { sent: true, phone_masked: maskPhone(user.phone_e164) };
    } catch (err) {
      req.log.error({ err }, 'failed to send OTP after password verify');
      reply.code(502).send({ error: 'otp_send_failed' });
      return reply;
    }
  });

  // ---- Request OTP (legacy phone-keyed; kept for backward compat) ----
  app.post('/auth/otp/request', async (req, reply) => {
    const body = z.object({ phone: z.string().min(8) }).parse(req.body);
    const phone = normalisePhone(body.phone);

    // Only known users may receive OTPs. Prevents spamming arbitrary numbers via our WA template.
    const { rows } = await query<User>(
      `SELECT id, phone_e164, name, email, role, active FROM users WHERE phone_e164 = $1`,
      [phone]
    );
    const user = rows[0];
    if (!user || !user.active) {
      // Do not reveal existence — but rate-limit middleware on the route will still cap.
      // We still respond 200 to avoid user enumeration; client will see no OTP.
      return { sent: false };
    }

    try {
      const result = await issueOtp(phone);
      if (!result.sent) {
        reply.code(429).send({ error: 'cooldown', retry_after: result.cooldownRemaining });
        return reply;
      }
      return { sent: true };
    } catch (err) {
      req.log.error({ err }, 'failed to send OTP');
      reply.code(502).send({ error: 'otp_send_failed' });
      return reply;
    }
  });

  // ---- Verify OTP ----
  // Accepts either email (preferred — paired with /auth/login) or phone
  // (legacy). Either way we look up the user's phone and run the OTP check.
  app.post('/auth/otp/verify', async (req, reply) => {
    const body = z.object({
      email: z.string().email().optional(),
      phone: z.string().min(8).optional(),
      code: z.string().regex(/^\d{4,8}$/),
    }).refine((b) => !!(b.email || b.phone), { message: 'email or phone required' }).parse(req.body);

    let phone: string;
    if (body.email) {
      const r = await query<{ phone_e164: string; active: boolean }>(
        `SELECT phone_e164, active FROM users WHERE LOWER(email) = LOWER($1)`,
        [body.email]
      );
      if (!r.rows[0] || !r.rows[0].active) {
        reply.code(401).send({ error: 'invalid_credentials' });
        return reply;
      }
      phone = r.rows[0].phone_e164;
    } else {
      phone = normalisePhone(body.phone!);
    }

    const result = await verifyOtp(phone, body.code);
    if (!result.ok) {
      reply.code(401).send({ error: 'otp_invalid', reason: result.reason });
      return reply;
    }

    const { rows } = await query<User>(
      `SELECT id, phone_e164, name, email, role, active, created_at
         FROM users WHERE phone_e164 = $1`,
      [phone]
    );
    const user = rows[0];
    if (!user || !user.active) {
      reply.code(401).send({ error: 'user_inactive' });
      return reply;
    }

    await query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id]);

    const session = signSession({ sub: user.id, role: user.role, phone: user.phone_e164 });
    return { token: session.token, expires_at: session.expires_at, user };
  });

  // ---- Who am I ----
  app.get('/auth/me', { preHandler: app.requireAuth }, async (req) => {
    return { user: req.user };
  });

  // ---- Logout (client just drops the token; this is a no-op stub for future server-side revoke) ----
  app.post('/auth/logout', { preHandler: app.requireAuth }, async () => {
    return { ok: true };
  });
}
