// POST /api/login  { password }  ->  { token }
import { json, checkPassword, makeToken } from '../lib/auth.mjs';

export default async req => {
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);
  try {
    const { password } = await req.json().catch(() => ({}));
    if (!checkPassword(password)) {
      await new Promise(r => setTimeout(r, 800)); // slow down guessing
      return json({ error: 'Wrong password.' }, 401);
    }
    return json({ token: makeToken() });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: '/api/login' };
