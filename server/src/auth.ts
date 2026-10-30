import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';

const COOKIE = 'hd_session';
const MAX_AGE_S = 180 * 24 * 3600;

/** Random secret kept in the data volume so sessions survive restarts. */
export function cookieSecret(): string {
  const file = path.join(config.dataDir, '.session-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

// Tying the session to the PIN means changing SETTINGS_PIN signs everyone out.
const pinTag = crypto.createHash('sha256').update(`hd:${config.settingsPin}`).digest('hex').slice(0, 16);

export const pinRequired = () => config.settingsPin.length > 0;

export function isAuthed(req: FastifyRequest): boolean {
  if (!pinRequired()) return true;
  const raw = req.cookies[COOKIE];
  if (!raw) return false;
  const { valid, value } = req.unsignCookie(raw);
  if (!valid || !value) return false;
  const [exp, tag] = value.split(':');
  return tag === pinTag && Number(exp) > Date.now();
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!isAuthed(req)) return reply.code(401).send({ error: 'Not signed in' });
}

const attempts = new Map<string, { count: number; reset: number }>();

export function checkPin(req: FastifyRequest, reply: FastifyReply, pin: unknown): boolean {
  const now = Date.now();
  const entry = attempts.get(req.ip) ?? { count: 0, reset: now + 10 * 60_000 };
  if (entry.reset < now) Object.assign(entry, { count: 0, reset: now + 10 * 60_000 });
  if (entry.count >= 10) return false;

  const given = crypto.createHash('sha256').update(String(pin ?? '')).digest();
  const expected = crypto.createHash('sha256').update(config.settingsPin).digest();
  if (!crypto.timingSafeEqual(given, expected)) {
    entry.count++;
    attempts.set(req.ip, entry);
    return false;
  }
  attempts.delete(req.ip);
  reply.setCookie(COOKIE, `${now + MAX_AGE_S * 1000}:${pinTag}`, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
  return true;
}

export function signOut(reply: FastifyReply) {
  reply.clearCookie(COOKIE, { path: '/' });
}
