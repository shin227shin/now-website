// GET  /api/content            public: the saved content (null when nothing saved yet -> page uses the default JSON)
// PUT  /api/content            admin:  save new content (the old one is kept in history)
// GET  /api/history            admin:  list saved older versions
// GET  /api/history?key=...    admin:  one older version
import { getStore } from '@netlify/blobs';
import { json, isAdmin } from '../lib/auth.mjs';

const KEEP = 10;           // how many older versions to keep
const MAX_BYTES = 1500000; // the photo is stored inside the content, so allow some room

const site = () => getStore({ name: 'site', consistency: 'strong' });
const history = () => getStore({ name: 'history', consistency: 'strong' });

// Checks the overall shape so a broken save can't take the public page down
function problems(c) {
  const out = [];
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  if (!isObj(c)) return ['Content must be an object.'];
  if (!isObj(c.header)) out.push('header is missing.');
  if (!isObj(c.join)) out.push('join is missing.');
  for (const k of ['countries', 'activities', 'schedule', 'timeZones', 'quotes']) {
    if (!Array.isArray(c[k])) out.push(`${k} must be a list.`);
  }
  if (Array.isArray(c.countries) && c.countries.some(x => !x?.name)) out.push('Every country needs a name.');
  if (Array.isArray(c.schedule)) {
    for (const s of c.schedule) {
      if (s.date && !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) out.push(`"${s.label}": date must look like 2026-10-25.`);
      if (s.startJST && !/^\d{2}:\d{2}$/.test(s.startJST)) out.push(`"${s.label}": start time must look like 20:00.`);
    }
  }
  if (Array.isArray(c.join?.requirements) === false) out.push('join.requirements must be a list.');
  return out;
}

export default async (req, context) => {
  const url = new URL(req.url);
  try {
    if (url.pathname === '/api/content' && req.method === 'GET') {
      const saved = await site().get('content', { type: 'json' });
      return json(saved ?? null); // null = nothing saved yet
    }

    if (!isAdmin(req)) return json({ error: 'Please log in again.' }, 401);

    if (url.pathname === '/api/content' && req.method === 'PUT') {
      const text = await req.text();
      if (text.length > MAX_BYTES) return json({ error: 'Content is too large (the photo may be too big).' }, 413);
      let c;
      try { c = JSON.parse(text); } catch { return json({ error: 'Not valid JSON.' }, 400); }
      const errs = problems(c);
      if (errs.length) return json({ error: errs.join(' ') }, 400);

      const store = site();
      const old = await store.get('content', { type: 'json' });
      if (old) {
        const h = history();
        await h.setJSON(String(Date.now()), old);
        const { blobs } = await h.list();
        const keys = blobs.map(b => b.key).sort();
        await Promise.all(keys.slice(0, Math.max(0, keys.length - KEEP)).map(k => h.delete(k)));
      }
      c.updatedAt = new Date().toISOString();
      await store.setJSON('content', c);
      return json({ ok: true, updatedAt: c.updatedAt });
    }

    if (url.pathname === '/api/history' && req.method === 'GET') {
      const h = history();
      const key = url.searchParams.get('key');
      if (key) {
        const v = await h.get(key, { type: 'json' });
        return v ? json(v) : json({ error: 'Version not found.' }, 404);
      }
      const { blobs } = await h.list();
      const versions = blobs.map(b => b.key).sort().reverse().map(k => ({ key: k, savedAt: new Date(Number(k)).toISOString() }));
      return json({ versions });
    }

    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: ['/api/content', '/api/history'] };
