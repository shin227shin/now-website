// Admin dashboard: log in, edit every part of the content, see it live, save to Netlify.
// Uses esc / ICONS / nextStart / dayLabel / tzLabel / hm / totals from render.js and COUNTRIES / countryLatLon from countries.js.

const DEFAULT_URL = '/data/default-content.json';
const DEFAULT_PHOTO = 'assets/img/contact.jpg';
const ZONES = ['Asia/Tokyo', 'Europe/Berlin', 'Europe/London', 'Europe/Lisbon', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Manila',
  'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'Asia/Dubai', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Sao_Paulo', 'UTC'];

let token = localStorage.getItem('cce-token') || '';
let state = null;      // content being edited
let savedText = '';    // last saved / loaded version, to know if there are unsaved changes
let previewReady = false;
let lastSection = '';

const $ = id => document.getElementById(id);

// ---------- Small helpers ----------
function toast(msg, bad = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.className = 'toast' + (bad ? ' bad' : '')), bad ? 5000 : 2500);
}
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] ??= {}), obj);
  if (value === undefined) delete target[last]; else target[last] = value;
}
const clone = v => JSON.parse(JSON.stringify(v));
const content = () => { const c = clone(state); delete c.updatedAt; return c; };
const isDirty = () => JSON.stringify(content()) !== savedText;
function validZone(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; }
}
function tokenAlive(t) {
  try { return JSON.parse(atob(t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))).exp > Date.now() + 60000; } catch { return false; }
}
function when(iso) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...opts.headers } });
  const body = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/login') { logout('Your login has expired. Please log in again.'); throw new Error('login'); }
  if (!r.ok) throw Object.assign(new Error(body.error || `Error ${r.status}`), { status: r.status });
  return body;
}

// ---------- Login ----------
function showLogin(msg = '') {
  $('app').hidden = true;
  $('login').hidden = false;
  $('login-err').textContent = msg;
  $('password').focus();
}
function logout(msg) {
  token = '';
  localStorage.removeItem('cce-token');
  showLogin(msg);
}
$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  $('login-err').textContent = '';
  try {
    const { token: t } = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: $('password').value }) });
    token = t;
    localStorage.setItem('cce-token', t);
    $('password').value = '';
    start();
  } catch (err) {
    $('login-err').textContent = err.status === 404 ? 'The login service is not available here. Run "netlify dev" or use the deployed site.' : err.message;
  }
});

// ---------- Load / save ----------
async function loadContent() {
  try {
    const saved = await api('/api/content');
    if (saved) return saved;
  } catch (e) {
    if (e.message === 'login') throw e;
    toast('Could not read saved content, showing the default. (' + e.message + ')', true);
  }
  return fetch(DEFAULT_URL, { cache: 'no-store' }).then(r => r.json());
}
function setContent(c, markSaved) {
  state = c;
  if (markSaved) savedText = JSON.stringify(content());
  renderEditor();
  changed();
}
async function start() {
  $('login').hidden = true;
  $('app').hidden = false;
  const c = await loadContent();
  setContent(c, true);
  status();
}

function problems() {
  const out = [];
  state.timeZones.forEach(z => { if (!validZone(z.tz)) out.push(`Time zone "${z.tz}" is not valid.`); });
  state.countries.forEach(x => { if (!x.name?.trim()) out.push('A country has no name.'); });
  state.schedule.forEach(s => { if (!s.date || !s.startJST) out.push(`"${s.label}" needs a date and a start time.`); });
  return out;
}
async function save() {
  const errs = problems();
  if (errs.length) return toast(errs.join(' '), true);
  $('btn-save').disabled = true;
  try {
    const c = content();
    const r = await api('/api/content', { method: 'PUT', body: JSON.stringify(c) });
    state.updatedAt = r.updatedAt;
    savedText = JSON.stringify(c);
    toast('Saved. The public page is updated.');
  } catch (e) {
    if (e.message !== 'login') toast('Could not save: ' + e.message, true);
  }
  status();
}
function status() {
  const s = $('status');
  const dirty = isDirty();
  s.className = 'status' + (dirty ? ' dirty' : '');
  s.textContent = dirty ? 'Unsaved changes' : (state.updatedAt ? 'Published · last saved ' + when(state.updatedAt) : 'Showing the default content (not saved yet)');
  $('btn-save').disabled = !dirty;
}

// ---------- Preview ----------
function previewContent() {
  const c = content();
  c.timeZones = c.timeZones.filter(z => validZone(z.tz));
  return c;
}
function sendPreview() {
  if (!previewReady || !state) return;
  try { $('pv').contentWindow.postMessage({ type: 'cce-preview', content: previewContent() }, location.origin); } catch { }
}
addEventListener('message', e => {
  if (e.origin === location.origin && e.data?.type === 'cce-preview-ready') { previewReady = true; sendPreview(); }
});
let deviceW = 1280;
function fitPreview() {
  const f = $('frame'), pv = $('pv');
  if (!f.clientWidth) return;
  const scale = Math.min(1, f.clientWidth / deviceW);
  pv.style.width = deviceW + 'px';
  pv.style.height = f.clientHeight / scale + 'px';
  pv.style.transform = `scale(${scale})`;
  pv.style.left = Math.max(0, (f.clientWidth - deviceW * scale) / 2) + 'px';
}
$('device').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  deviceW = Number(b.dataset.w);
  $('device').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
  fitPreview();
});
addEventListener('resize', fitPreview);

let pvTimer;
function changed() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(sendPreview, 120);
  renderLive();
  status();
}

// ---------- Form building blocks (each input knows its path in the content) ----------
const attr = (path, kind) => `data-path="${path}" data-kind="${kind}"`;
function text(label, path, o = {}) {
  return `<label class="f"><span>${label}</span><input type="${o.type || 'text'}" ${attr(path, 'text')} value="${esc(getPath(state, path) ?? '')}" placeholder="${esc(o.ph || '')}"${o.list ? ` list="${o.list}"` : ''}>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}
function area(label, path, o = {}) {
  return `<label class="f"><span>${label}</span><textarea rows="${o.rows || 3}" ${attr(path, 'text')} placeholder="${esc(o.ph || '')}">${esc(getPath(state, path) ?? '')}</textarea>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}
function lines(label, path, o = {}) {
  return `<label class="f"><span>${label}</span><textarea rows="${o.rows || 3}" ${attr(path, 'lines')}>${esc((getPath(state, path) || []).join('\n'))}</textarea><div class="hint">${o.hint || 'One per line.'}</div></label>`;
}
function num(label, path, o = {}) {
  const v = getPath(state, path);
  return `<label class="f"><span>${label}</span><input type="number" min="${o.min ?? 0}" ${attr(path, o.nullable ? 'numOrNull' : 'num')} value="${v ?? ''}" placeholder="${esc(o.ph || '')}">${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}
function check(label, path) {
  return `<label class="check"><input type="checkbox" ${attr(path, 'bool')}${getPath(state, path) ? ' checked' : ''}>${label}</label>`;
}
function select(label, path, options, o = {}) {
  const v = getPath(state, path) ?? '';
  return `<label class="f"><span>${label}</span><select ${attr(path, 'text')}>${options.map(([val, lab]) => `<option value="${esc(val)}"${val === v ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}
const btn = (act, list, i, label, cls = 'icon', title = '') => `<button type="button" class="${cls}" data-act="${act}" data-list="${list}" data-i="${i}" title="${title}">${label}</button>`;
function itemHead(title, list, i, n) {
  return `<div class="item-h"><b>${esc(title || 'Untitled')}</b>${btn('up', list, i, '↑', 'icon', 'Move up')}${btn('down', list, i, '↓', 'icon', 'Move down')}${btn('remove', list, i, '✕', 'icon danger', 'Remove')}</div>`;
}
const section = (id, scrollTo, title, body, note = '') =>
  `<details class="sec" open data-scroll="${scrollTo}" id="sec-${id}"><summary>${title}${note ? `<small data-live="${note}"></small>` : ''}</summary><div class="sec-body">${body}</div></details>`;
const MARKUP_HINT = 'Use <code>**bold**</code> and <code>*coral text*</code>. Press Enter for a new line.';

// ---------- Sections ----------
function headerSection() {
  return section('header', 'top', 'Header', `
    ${text('Small label above the title', 'header.label')}
    <div class="row">${text('Title, first part', 'header.titleLine1')}${text('Title, second part (italic)', 'header.titleLine2')}</div>
    ${text('Year (top right and footer)', 'header.year')}
    <div class="sub-h">Community intro</div>
    ${text('Heading', 'header.introTitle')}
    ${area('Text under the heading', 'header.tagline', { hint: MARKUP_HINT })}`);
}

function countriesSection() {
  const rows = state.countries.map((x, i) => {
    const known = !!COUNTRIES[x.name];
    const pin = Array.isArray(x.pin) ? x.pin.join(', ') : '';
    return `<div class="ctry">
      <input ${attr(`countries.${i}.name`, 'text')} value="${esc(x.name)}" list="country-names" placeholder="Country name">
      <div class="count">${btn('dec', 'countries', i, '−', '')}<input type="number" min="1" ${attr(`countries.${i}.count`, 'num')} value="${Number(x.count) || 0}">${btn('inc', 'countries', i, '+', '')}</div>
      ${btn('remove', 'countries', i, '✕', 'icon danger', 'Remove country')}
      ${(known || !x.name) && !pin ? '' : `<div class="ctry-extra">${known ? '' : '<span class="warn">Not on the built-in map list.</span>'} Globe position lat, lon:
        <input ${attr(`countries.${i}.pin`, 'pair')} value="${esc(pin)}" placeholder="e.g. 35.7, 139.7"> <span>(degrees; south and west are minus)</span></div>`}
    </div>`;
  }).join('');
  return section('countries', 'top', 'Members &amp; countries', `
    <div class="totals" data-live="totals"></div>
    <div>${rows}</div>
    <button type="button" class="add" data-act="add" data-list="countries">+ Add country</button>
    <datalist id="country-names">${Object.keys(COUNTRIES).sort().map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="hint">The totals, the globe pins and the country chips all follow this list. Pins are placed automatically for countries on the built-in list.</div>
    <div class="sub-h">Override the totals (optional)</div>
    <div class="row">${num('Members shown', 'stats.membersOverride', { nullable: true, ph: 'auto' })}${num('Countries shown', 'stats.countriesOverride', { nullable: true, ph: 'auto' })}</div>
    <div class="hint">Leave empty to count automatically.</div>`, 'countries-note');
}

function quotesSection() {
  const items = state.quotes.map((q, i) => `<div class="item">${itemHead(q.name ? `${q.name}${q.country ? ', ' + q.country : ''}` : 'Quote', 'quotes', i)}
    ${area('Quote', `quotes.${i}.text`, { rows: 2 })}
    <div class="row">${text('Name', `quotes.${i}.name`)}${text('Country', `quotes.${i}.country`)}</div></div>`).join('');
  return section('quotes', 'community', 'Member quotes', `${items}
    <button type="button" class="add" data-act="add" data-list="quotes">+ Add quote</button>
    <div class="hint">With more than one quote, they take turns every 8 seconds.</div>`);
}

function activitiesSection() {
  const icons = [['', 'No icon'], ...Object.keys(ICONS).map(k => [k, k])];
  const links = [['', 'No times'], ...state.schedule.map(s => [s.id, `${s.label} (${s.id})`])];
  const items = state.activities.map((a, i) => {
    const p = `activities.${i}`;
    const steps = Array.isArray(a.steps);
    const soon = a.status === 'coming-soon';
    return `<div class="item">${itemHead(a.title, 'activities', i)}
      ${text('Title', `${p}.title`)}
      <div class="row">${select('Icon', `${p}.icon`, icons)}${select('Status', `${p}.status`, [['', 'Running'], ['coming-soon', 'Coming soon (dashed card)']])}</div>
      ${soon ? text('Coming-soon label', `${p}.statusLabel`, { ph: 'COMING SOON' }) : text('Small line under the title', `${p}.sub`, { ph: 'e.g. 45 MIN · EVERY OTHER SUNDAY' })}
      <div class="item-h"><span class="hint" style="flex:1;margin:0">Text shown as:</span>${btn('mode', 'activities', i, steps ? 'Switch to paragraph' : 'Switch to numbered steps', '')}</div>
      ${steps ? lines('Steps', `${p}.steps`, { hint: 'One step per line. ' + MARKUP_HINT.split('.')[0] + '.' }) : area('Text', `${p}.body`, { hint: MARKUP_HINT })}
      ${select('Show session times from', `${p}.timesFrom`, links, { hint: 'Shows the JST / CET / IST times of a "Next Up" item on this card.' })}
      ${check('Show the “Casual Meetup” badge', `${p}.meetup`)}
      ${a.meetup ? text('Badge text', `${p}.meetupText`, { ph: 'After the session: Casual Meetup!!' }) : ''}
    </div>`;
  }).join('');
  return section('activities', 'activities', 'What You Can Do', `
    ${text('Section heading', 'activitiesTitle')}
    ${items}
    <button type="button" class="add" data-act="add" data-list="activities">+ Add activity</button>`);
}

function scheduleSection() {
  const items = state.schedule.map((s, i) => {
    const p = `schedule.${i}`;
    return `<div class="item">${itemHead(s.label, 'schedule', i)}
      <div class="row">${text('Name on the ticket', `${p}.label`)}${text('Link name', `${p}.id`, { hint: 'Used to show these times on an activity card.' })}</div>
      <div class="row3">${text('Date (Japan)', `${p}.date`, { type: 'date' })}${text('Start time (JST)', `${p}.startJST`, { type: 'time' })}${num('Length (minutes)', `${p}.durationMin`, { min: 5 })}</div>
      ${num('Repeat every … days', `${p}.repeatEveryDays`, { nullable: true, ph: 'no repeat', hint: '14 = every other week. Leave empty for a one-time session. Repeating sessions move to the next date by themselves.' })}
      <div class="conv" data-live="conv-${i}"></div>
    </div>`;
  }).join('');
  const zones = state.timeZones.map((z, i) => `<div class="zone">
      <input ${attr(`timeZones.${i}.tz`, 'text')} value="${esc(z.tz)}" list="zone-names" placeholder="e.g. Europe/Berlin">
      <input ${attr(`timeZones.${i}.label`, 'text')} value="${esc(z.label ?? '')}" placeholder="auto">
      ${btn('up', 'timeZones', i, '↑', 'icon', 'Move up')}${btn('down', 'timeZones', i, '↓', 'icon', 'Move down')}${btn('remove', 'timeZones', i, '✕', 'icon danger', 'Remove')}
      <span class="warn" data-live="zone-${i}"></span></div>`).join('');
  return section('schedule', 'next', 'Next Up (sessions &amp; times)', `
    ${text('Section heading', 'nextUpTitle')}
    ${items}
    <button type="button" class="add" data-act="add" data-list="schedule">+ Add session</button>
    <div class="sub-h">Time zones shown</div>
    <div><div class="zone zone-h"><span>Time zone</span><span>Label</span></div>${zones}
    <div class="hint">Label <code>auto</code> picks CET / CEST (or GMT / BST) by the date.</div></div>
    <button type="button" class="add" data-act="add" data-list="timeZones">+ Add time zone</button>
    <datalist id="zone-names">${ZONES.map(z => `<option value="${z}">`).join('')}</datalist>`);
}

function joinSection() {
  const photo = state.join.contact?.photo || '';
  const src = /^(data:|https?:|\/)/.test(photo) ? photo : '/' + photo;
  return section('join', 'join', 'Join Us', `
    <div class="row">${text('Heading', 'join.title')}${text('Text under the heading', 'join.subtitle')}</div>
    ${text('Recruiting notice (optional)', 'join.recruiting', { hint: 'Shown as a small badge under the heading. Leave empty to hide it.' })}
    ${text('“All you need” title', 'join.needTitle')}
    ${lines('Requirements', 'join.requirements')}
    <div class="sub-h">Contact person</div>
    <div class="photo">${photo ? `<img src="${esc(src)}" alt="">` : ''}<div class="btns">
      <label class="btn">Upload new photo<input type="file" accept="image/*" id="photo-file" hidden></label>
      ${photo !== DEFAULT_PHOTO ? `<button type="button" data-act="photo-default">Use original photo</button>` : ''}
      ${photo ? `<button type="button" class="danger" data-act="photo-none">No photo</button>` : ''}</div></div>
    <div class="hint">Photos are cropped to a square and made smaller automatically.</div>
    ${text('Label', 'join.contact.label')}
    <div class="row">${text('Name', 'join.contact.name')}${text('Location', 'join.contact.location')}</div>
    ${text('“Get in touch” link (optional)', 'join.contact.link', { ph: 'https://teams.microsoft.com/l/chat/… or mailto:…', hint: 'When set, a “Get in touch” button is shown.' })}`);
}

function renderEditor() {
  const ed = $('editor');
  const top = ed.scrollTop;
  const closed = [...ed.querySelectorAll('details:not([open])')].map(d => d.id);
  ed.innerHTML = headerSection() + countriesSection() + activitiesSection() + scheduleSection() + quotesSection() + joinSection();
  closed.forEach(id => $(id)?.removeAttribute('open'));
  ed.scrollTop = top;
  $('photo-file').addEventListener('change', uploadPhoto);
}

// Parts that change while typing (totals, converted times, warnings)
function renderLive() {
  const live = k => document.querySelector(`[data-live="${k}"]`);
  const t = totals(state);
  const box = live('totals');
  if (box) box.innerHTML = `<div><b>${t.members}</b><span>Members${state.stats?.membersOverride != null ? ' (set by hand)' : ''}</span></div><div><b>${t.countries}</b><span>Countries${state.stats?.countriesOverride != null ? ' (set by hand)' : ''}</span></div>`;
  const note = live('countries-note');
  if (note) note.textContent = `${t.members} members · ${t.countries} countries`;

  const zones = state.timeZones.filter(z => validZone(z.tz));
  state.schedule.forEach((s, i) => {
    const el = live('conv-' + i);
    if (!el) return;
    const start = nextStart(s);
    if (!s.date || !s.startJST) { el.textContent = 'Set a date and a start time.'; return; }
    if (!start) { el.innerHTML = '<b>This date has passed.</b> The page shows “Date TBD” until you set a new date.'; return; }
    const end = new Date(start.getTime() + (Number(s.durationMin) || 0) * 60000);
    el.innerHTML = `<b>Next: ${dayLabel(start)}</b> &nbsp;·&nbsp; ` + zones.map(z => `${esc(tzLabel(start, z))} ${hm(start, z.tz)}–${hm(end, z.tz)}`).join(' &nbsp;·&nbsp; ');
  });
  state.timeZones.forEach((z, i) => {
    const el = live('zone-' + i);
    if (el) el.textContent = validZone(z.tz) ? '' : 'Not a valid time zone (e.g. Europe/Berlin).';
  });
}

// ---------- Editing ----------
const NEW = {
  countries: () => ({ name: '', count: 1 }),
  quotes: () => ({ text: '', name: '', country: '' }),
  activities: () => ({ id: 'activity-' + Date.now(), icon: 'terminal', title: 'New activity', sub: '', body: '' }),
  schedule: () => ({ id: 'session-' + Date.now(), label: 'NEW SESSION', date: new Date(Date.now() + 9 * 3600000 + 7 * 86400000).toISOString().slice(0, 10), startJST: '20:00', durationMin: 45, repeatEveryDays: null }),
  timeZones: () => ({ tz: 'Europe/London', label: 'auto' })
};

$('editor').addEventListener('input', e => {
  const el = e.target;
  const path = el.dataset.path;
  if (!path) return;
  let v = el.value;
  switch (el.dataset.kind) {
    case 'num': v = v === '' ? 0 : Number(v); break;
    case 'numOrNull': v = v === '' ? null : Number(v); break;
    case 'bool': v = el.checked; break;
    case 'lines': v = v.split('\n').map(s => s.trim()).filter(Boolean); break;
    case 'pair': {
      const m = v.match(/^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$/);
      v = m ? [Number(m[1]), Number(m[2])] : undefined;
      break;
    }
    default: if (el.tagName === 'SELECT' && v === '') v = undefined;
  }
  setPath(state, path, v);
  changed();
  // Some changes show or hide other fields
  if (el.tagName === 'SELECT' || el.type === 'checkbox') return renderEditor();
  if (/^(activities\.\d+\.title|schedule\.\d+\.label)$/.test(path)) el.closest('.item').querySelector('.item-h b').textContent = v || 'Untitled';
  if (/^schedule\.\d+\.(id|label)$/.test(path)) updateTitles();
});
// The "Show session times from" menus list the sessions by name
function updateTitles() {
  const links = document.querySelectorAll('select[data-path$=".timesFrom"]');
  links.forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = `<option value="">No times</option>` + state.schedule.map(s => `<option value="${esc(s.id)}"${s.id === cur ? ' selected' : ''}>${esc(s.label)} (${esc(s.id)})</option>`).join('');
  });
}
$('editor').addEventListener('change', e => {
  // A country name was changed: re-draw only if the map-position row has to appear or go away
  const m = (e.target.dataset.path || '').match(/^countries\.(\d+)\.name$/);
  if (!m) return;
  const x = state.countries[m[1]];
  const hasRow = !!e.target.closest('.ctry').querySelector('.ctry-extra');
  if (hasRow !== !((COUNTRIES[x.name] || !x.name) && !x.pin)) renderEditor();
});

$('editor').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  const { act, list } = b.dataset;
  const i = Number(b.dataset.i);
  const arr = list && state[list];
  switch (act) {
    case 'add': arr.push(NEW[list]()); break;
    case 'remove':
      if (list !== 'countries' && !confirm('Remove this item?')) return;
      arr.splice(i, 1); break;
    case 'up': if (i > 0) [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; break;
    case 'down': if (i < arr.length - 1) [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; break;
    case 'inc': arr[i].count = (Number(arr[i].count) || 0) + 1; break;
    case 'dec': arr[i].count = Math.max(1, (Number(arr[i].count) || 0) - 1); break;
    case 'mode': {
      const a = arr[i];
      if (Array.isArray(a.steps)) { a.body = a.steps.join('\n'); delete a.steps; }
      else { a.steps = (a.body || '').split('\n').map(s => s.trim()).filter(Boolean); delete a.body; }
      break;
    }
    case 'photo-default': state.join.contact.photo = DEFAULT_PHOTO; break;
    case 'photo-none': state.join.contact.photo = ''; break;
  }
  renderEditor();
  changed();
  if (act === 'add') document.querySelector(`[data-path^="${list}.${arr.length - 1}."]`)?.focus();
});

// Scroll the preview to the part being edited
$('editor').addEventListener('focusin', e => {
  const sec = e.target.closest('[data-scroll]');
  if (!sec || sec.dataset.scroll === lastSection || !previewReady) return;
  lastSection = sec.dataset.scroll;
  $('pv').contentWindow.postMessage({ type: 'cce-scroll', id: lastSection }, location.origin);
});

// Photo upload: crop to a square, shrink to 400 px, store inside the content as a JPEG
function uploadPhoto(e) {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const size = Math.min(img.width, img.height);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 400;
    cv.getContext('2d').drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 400, 400);
    state.join.contact.photo = cv.toDataURL('image/jpeg', 0.85);
    URL.revokeObjectURL(img.src);
    renderEditor();
    changed();
  };
  img.onerror = () => toast('Could not read that image.', true);
  img.src = URL.createObjectURL(file);
}

// ---------- Top bar ----------
$('btn-save').addEventListener('click', save);
addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's' && !$('app').hidden) { e.preventDefault(); if (isDirty()) save(); }
});
$('btn-logout').addEventListener('click', () => {
  if (isDirty() && !confirm('You have unsaved changes. Log out anyway?')) return;
  logout('');
});
$('btn-default').addEventListener('click', async () => {
  if (!confirm('Load the original default content into the editor? Nothing changes on the site until you save.')) return;
  const c = await fetch(DEFAULT_URL, { cache: 'no-store' }).then(r => r.json());
  c.updatedAt = state.updatedAt;
  setContent(c, false);
  toast('Default content loaded. Press “Save & publish” to use it.');
});
$('btn-backup').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(content(), null, 2)], { type: 'application/json' }));
  a.download = `cce-content-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('btn-history').addEventListener('click', async () => {
  const ul = $('history-list');
  ul.innerHTML = '<li>Loading…</li>';
  $('history').showModal();
  try {
    const { versions } = await api('/api/history');
    ul.innerHTML = versions.length
      ? versions.map(v => `<li><span>Version replaced on <b>${when(v.savedAt)}</b></span><button data-key="${v.key}">Load</button></li>`).join('')
      : '<li>No older versions yet. One is kept each time you save.</li>';
  } catch (e) {
    ul.innerHTML = `<li>${esc(e.message)}</li>`;
  }
});
$('history-list').addEventListener('click', async e => {
  const key = e.target.dataset.key;
  if (!key) return;
  try {
    const c = await api('/api/history?key=' + encodeURIComponent(key));
    c.updatedAt = state.updatedAt;
    setContent(c, false);
    $('history').close();
    toast('Older version loaded. Press “Save & publish” to use it.');
  } catch (err) {
    if (err.message !== 'login') toast(err.message, true);
  }
});
addEventListener('beforeunload', e => { if (state && isDirty()) e.preventDefault(); });

// ---------- Go ----------
new ResizeObserver(fitPreview).observe($('frame'));
$('pv').src = '/index.html?preview'; // set here, after the "ready" listener exists
if (tokenAlive(token)) start(); else showLogin();
