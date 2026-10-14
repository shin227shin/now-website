# Claude Code on Earth — status site

- **Public page**: `/` shows the community status (members, countries, activities, next sessions, join info).
- **Admin page**: `/admin` (password protected). Every item on the public page can be edited here, with a live preview. **Save & publish** updates the public page right away — no Git commit needed.

## How it works

| Part | File |
|---|---|
| Public page | `index.html`, `assets/style.css`, `assets/render.js`, `assets/countries.js` |
| Admin page | `admin/index.html`, `assets/admin.js`, `assets/admin.css` |
| Default content (used until the first save) | `data/default-content.json` |
| Login (password → token valid for 12 hours) | `netlify/functions/login.mjs` |
| Read / save content, older versions | `netlify/functions/content.mjs` |

Saved content is kept in **Netlify Blobs** (Netlify's built-in storage). Each save keeps a copy of the previous version (last 10), which you can load again from **History** in the admin page.

Session times are entered in **JST**. The page works out the other time zones (CET / CEST switches by itself in March and October). Sessions with "Repeat every … days" move to the next date by themselves; one-time sessions show "Date TBD" once they have passed.

## Deploy on Netlify (first time)

1. Netlify → **Add new site → Import an existing project** → GitHub → `shin227shin/Claude-Code-on-Earth`.
2. Build settings:
   - **Base directory**: `now-website`
   - **Build command**: *(leave empty)*
   - **Publish directory**: `now-website` (Netlify fills this in from `netlify.toml`)
   - **Functions directory**: `now-website/netlify/functions` (also from `netlify.toml`)
3. **Site configuration → Environment variables**, add:
   - `ADMIN_PASSWORD` — the password for `/admin`
   - `ADMIN_SECRET` — a long random text (at least 16 characters) used to sign logins. Changing it logs everyone out.
4. Deploy. Open `https://<your-site>.netlify.app/admin`, log in, edit, and press **Save & publish**.

Netlify Blobs needs no extra setup.

## Run locally

```bash
cd now-website
npm install
# .env (not committed):
#   ADMIN_PASSWORD=...
#   ADMIN_SECRET=...
npx netlify-cli dev
```

Then open http://localhost:8888/ and http://localhost:8888/admin.
Locally the content is saved in a local copy of Netlify Blobs, not the live site.

## Text markup

In text fields: `**bold**`, `*coral text*`, and a new line (Enter) becomes a line break.
