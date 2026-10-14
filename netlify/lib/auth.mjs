// Small helpers shared by the functions: signed login tokens and JSON responses.
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const TOKEN_HOURS = 12;

function secret() {
  const s = process.env.ADMIN_SECRET;
  if (!s || s.length < 16) throw new Error('ADMIN_SECRET is not set (use at least 16 characters).');
  return s;
}
const sign = data => createHmac('sha256', secret()).update(data).digest('base64url');
const same = (a, b) => timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export function checkPassword(password) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) throw new Error('ADMIN_PASSWORD is not set.');
  return typeof password === 'string' && same(password, real);
}

export function makeToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_HOURS * 3600000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

// True when the request has a valid, unexpired "Authorization: Bearer <token>" header
export function isAdmin(req) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (.+)\.(.+)$/);
  if (!m) return false;
  const [, payload, sig] = m;
  if (!same(sig, sign(payload))) return false;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now();
  } catch {
    return false;
  }
}
