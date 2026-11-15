// GET /api/slides/<name>  public: a slide PDF or its thumbnail (names look like 1731650000000-ab12.pdf / .jpg)
// PUT /api/slides/<name>  admin:  upload one (the admin page makes the name)
import { getStore } from '@netlify/blobs';
import { json, isAdmin } from '../lib/auth.mjs';

const MAX_BYTES = 5 * 1024 * 1024; // Netlify functions accept about 6 MB per request
const NAME = /^[a-z0-9-]{1,60}\.(pdf|jpg)$/;
const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg' };
const store = () => getStore({ name: 'slides', consistency: 'strong' });

export default async (req) => {
  const name = decodeURIComponent(new URL(req.url).pathname.split('/').pop());
  if (!NAME.test(name)) return json({ error: 'Not found.' }, 404);
  const ext = name.split('.').pop();
  try {
    if (req.method === 'GET') {
      const data = await store().get(name, { type: 'arrayBuffer' });
      if (!data) return json({ error: 'Not found.' }, 404);
      return new Response(data, { headers: { 'content-type': TYPES[ext], 'cache-control': 'public, max-age=31536000, immutable' } });
    }
    if (req.method === 'PUT') {
      if (!isAdmin(req)) return json({ error: 'Please log in again.' }, 401);
      const buf = await req.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return json({ error: 'The file is too big (max 5 MB).' }, 413);
      const head = new Uint8Array(buf.slice(0, 4));
      const ok = ext === 'pdf' ? head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 : head[0] === 0xff && head[1] === 0xd8;
      if (!ok) return json({ error: `That is not a real ${ext.toUpperCase()} file.` }, 400);
      await store().set(name, buf);
      return json({ ok: true, url: '/api/slides/' + name });
    }
    return json({ error: 'Not found.' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
};

export const config = { path: '/api/slides/*' };
