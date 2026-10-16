// Builds the public page from the content JSON.
// Shared with the admin preview later, so keep it free of page-specific setup.

const ICONS = {
  terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>'
};
const SPARKLE = '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z"/></svg>';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// Tiny markup: **text** = strong, *text* = coral highlight, new line = line break
function md(s, hlTag = 'span class="hl"') {
  const close = hlTag.split(' ')[0];
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, `<${hlTag}>$1</${close}>`)
    .replace(/\n/g, '<br>');
}

function totals(c) {
  const members = c.countries.reduce((n, x) => n + (Number(x.count) || 0), 0);
  return {
    members: c.stats?.membersOverride ?? members,
    countries: c.stats?.countriesOverride ?? c.countries.length
  };
}

// ---------- Time zones ----------
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function tzOffsetHours(date, tz) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(date).find(x => x.type === 'timeZoneName').value; // "GMT+2"
  const m = p.match(/GMT([+-]\d+)(?::(\d+))?/);
  return m ? Number(m[1]) + Math.sign(Number(m[1])) * (Number(m[2] || 0) / 60) : 0;
}
function tzLabel(date, zone) {
  if (zone.label && zone.label !== 'auto') return zone.label;
  const off = tzOffsetHours(date, zone.tz);
  if (zone.tz.startsWith('Europe/') && (off === 1 || off === 2)) return off === 2 ? 'CEST' : 'CET';
  if (zone.tz === 'Europe/London' || zone.tz === 'Europe/Lisbon') return off === 1 ? 'BST' : 'GMT';
  return 'UTC' + (off >= 0 ? '+' : '') + off;
}
function hm(date, tz) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}
// Next start time (Date) for a schedule item, rolling forward when it repeats.
function nextStart(item, now = new Date()) {
  if (!item.date || !item.startJST) return null;
  let start = new Date(`${item.date}T${item.startJST}:00+09:00`);
  if (isNaN(start)) return null;
  const dur = (Number(item.durationMin) || 0) * 60000;
  const step = (Number(item.repeatEveryDays) || 0) * 86400000;
  if (step > 0) while (start.getTime() + dur < now.getTime()) start = new Date(start.getTime() + step);
  return start.getTime() + dur < now.getTime() ? null : start;
}
// "JST 20:00 – 20:45" rows for every time zone (labels follow summer time on that date)
function timeRows(c, start, durationMin) {
  const end = new Date(start.getTime() + (Number(durationMin) || 0) * 60000);
  return c.timeZones.map(z => `<span>${esc(tzLabel(start, z))}</span><span>${hm(start, z.tz)} – ${hm(end, z.tz)}</span>`).join('');
}

// ---------- Sections ----------
function renderMap(c) {
  const g = document.getElementById('pins');
  if (!g) return;
  // --i = place from west to east, so the opening intro can light the pins up in a sweep
  const xs = c.countries.map(x => countryPin(x.name, x.pin)?.[0]).filter(v => v != null).sort((a, b) => a - b);
  g.innerHTML = c.countries.map(x => {
    const p = countryPin(x.name, x.pin);
    if (!p) return '';
    const [cx, cy] = p;
    const n = Number(x.count) || 0;
    const badge = n > 1
      ? `<circle cx="${cx + 14}" cy="${cy - 14}" r="12" fill="#fff"/><text x="${cx + 14}" y="${cy - 9}" text-anchor="middle" font-family="Inter" font-weight="800" font-size="15" fill="#1a1a2e">${n}</text>`
      : '';
    return `<g class="pin-g" style="--i:${xs.indexOf(cx)}" tabindex="0" role="button" aria-label="${esc(x.name)}" data-name="${esc(x.name)}" data-count="${n}"><circle cx="${cx}" cy="${cy}" r="22" fill="transparent"/><circle class="pin" cx="${cx}" cy="${cy}" r="11" fill="#D97757" opacity=".28"/><circle class="dot" cx="${cx}" cy="${cy}" r="5" fill="#FF9A76" stroke="#fff" stroke-width="1.5"/>${badge}</g>`;
  }).join('');
  mapTips(g);
}

// Tap (or hover) a pin to show the country name in a small label above it.
function mapTips(g) {
  const map = g.closest('.map');
  if (!map || map._tips) return;
  map._tips = true;
  const tip = document.createElement('div');
  tip.className = 'map-tip';
  map.appendChild(tip);
  let cur = null;
  const show = pin => {
    if (cur) cur.classList.remove('on');
    cur = pin;
    pin.classList.add('on');
    const n = Number(pin.dataset.count);
    tip.innerHTML = `<b>${esc(pin.dataset.name)}</b>${n ? `<span>${n} member${n > 1 ? 's' : ''}</span>` : ''}`;
    const d = pin.querySelector('.dot').getBoundingClientRect(), m = map.getBoundingClientRect();
    // Keep the label inside the map; the little arrow still points at the pin
    const x = d.left + d.width / 2 - m.left, half = tip.offsetWidth / 2;
    const left = Math.min(Math.max(x, half + 8), m.width - half - 8);
    tip.style.left = `${left}px`;
    tip.style.setProperty('--arrow', `${x - left}px`);
    // Sit above the count badge too, when there is one
    const badge = pin.querySelector('circle[fill="#fff"]');
    tip.style.top = `${Math.min(d.top, badge ? badge.getBoundingClientRect().top : d.top) - m.top}px`;
    tip.classList.add('show');
  };
  const hide = () => { if (cur) cur.classList.remove('on'); cur = null; tip.classList.remove('show'); };
  const pinOf = e => e.target.closest?.('.pin-g');
  map.addEventListener('click', e => { const p = pinOf(e); p && p !== cur ? show(p) : hide(); });
  map.addEventListener('pointerover', e => { const p = pinOf(e); if (p && e.pointerType === 'mouse') show(p); });
  map.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
  map.addEventListener('keydown', e => {
    const p = pinOf(e);
    if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(p); }
    if (e.key === 'Escape') hide();
  });
  addEventListener('resize', hide);
}

function renderCard(a, c) {
  const soon = a.status === 'coming-soon';
  const icon = ICONS[a.icon] ? `<div class="ic"><svg viewBox="0 0 24 24">${ICONS[a.icon]}</svg></div>` : '';
  const sub = soon ? (a.statusLabel || 'COMING SOON') : a.sub;
  const body = a.steps?.length
    ? `<ol>${a.steps.map(s => `<li>${md(s)}</li>`).join('')}</ol>`
    : (a.body ? `<p>${md(a.body)}</p>` : '');
  // Fixed-time activities show their time in each zone, taken from the linked schedule item
  const item = a.timesFrom && c.schedule.find(x => x.id === a.timesFrom);
  const start = item && (nextStart(item) || new Date(`${item.date}T${item.startJST}:00+09:00`));
  const times = start && !isNaN(start) ? `<div class="times">${timeRows(c, start, item.durationMin)}</div>` : '';
  const meet = a.meetup ? `<div class="meet">${SPARKLE}${esc(a.meetupText || 'After the session: Casual Meetup!!')}</div>` : '';
  return `<div class="card${soon ? ' soon' : ''}">${icon}<h3>${esc(a.title)}</h3>${sub ? `<div class="sub">${esc(sub)}</div>` : ''}${body}${times}${meet}</div>`;
}

function dayLabel(start) {
  const jst = new Date(start.getTime() + 9 * 3600000);
  return `${ordinal(jst.getUTCDate())} ${jst.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })}`;
}

function renderSchedule(c, now = new Date()) {
  return c.schedule.map(item => {
    const start = nextStart(item, now);
    if (!start) {
      return `<div class="tbd"><div class="k">${esc(item.label)}</div><div class="d">Date TBD</div><div class="t"><span></span><span>Next date coming soon.</span></div></div>`;
    }
    return `<div><div class="k">${esc(item.label)}</div><div class="d">${dayLabel(start)}</div><div class="t">${timeRows(c, start, item.durationMin)}</div></div>`;
  }).join('');
}

// Every session for the hero stats row: upcoming ones soonest first, then the ones with no date yet
function upcoming(c, now = new Date()) {
  return c.schedule
    .map(item => ({ item, start: nextStart(item, now) }))
    .sort((a, b) => (!a.start - !b.start) || (a.start && b.start ? a.start - b.start : 0));
}
const titleCase = s => s.toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());

function renderPage(c, root = document) {
  const $ = id => root.getElementById ? root.getElementById(id) : root.querySelector('#' + id);
  const t = totals(c);
  const h = c.header;

  $('label').textContent = h.label;
  $('year').textContent = h.year;
  $('title').innerHTML = `${esc(h.titleLine1)}<em>${esc(h.titleLine2)}</em>`;
  $('members').textContent = t.members;
  $('countries').textContent = t.countries;
  const stats = $('stats');
  stats.querySelectorAll('.is-next').forEach(el => el.remove());
  const next = upcoming(c);
  stats.insertAdjacentHTML('beforeend', next.length
    ? next.map(x => `<div class="stat is-next${x.start ? '' : ' tbd'}"><b>${x.start ? dayLabel(x.start).replace(/ (\w{3})\w*$/, ' $1') : 'Date TBD'}</b><span>Next: ${esc(titleCase(x.item.label))}</span></div>`).join('')
    : '<div class="stat is-next"><b>TBD</b><span>Next session</span></div>');

  renderMap(c);
  $('intro-title').textContent = h.introTitle;
  $('tagline').innerHTML = md(h.tagline);
  $('chips').innerHTML = c.countries.map(x =>
    `<span class="chip${x.count > 1 ? ' many' : ''}"><span>${esc(x.name)}</span><s>${String(Number(x.count) || 0).padStart(2, '0')}</s></span>`).join('');

  const quotes = (c.quotes || []).filter(q => q.text);
  const showQuote = i => {
    const q = quotes[i % quotes.length];
    $('quote').innerHTML = `<div><q>${esc(q.text)}</q><small>— ${esc([q.name, q.country].filter(Boolean).join(', ').toUpperCase())}</small></div>`;
  };
  $('quote').style.display = quotes.length ? '' : 'none';
  clearInterval(renderPage._quoteTimer);
  if (quotes.length) {
    showQuote(0);
    if (quotes.length > 1) {
      let i = 0;
      renderPage._quoteTimer = setInterval(() => {
        $('quote').firstElementChild.style.opacity = 0;
        setTimeout(() => showQuote(++i), 500);
      }, 8000);
    }
  }

  $('activities-title').textContent = c.activitiesTitle || 'What You Can Do';
  $('cards').innerHTML = c.activities.map(a => renderCard(a, c)).join('');

  $('nextup-title').textContent = c.nextUpTitle || 'Next Up';
  $('ticket').innerHTML = renderSchedule(c);
  $('next').style.display = c.schedule.length ? '' : 'none';

  const j = c.join;
  $('join-title').textContent = j.title;
  $('join-sub').textContent = j.subtitle;
  // Content saved before this field existed has no "recruiting", so fall back to the current notice
  const rec = j.recruiting ?? 'Now recruiting members from **North & South America** only';
  $('join-rec').innerHTML = rec ? `<span class="live"></span><span>${md(rec)}</span>` : '';
  $('join-rec').style.display = rec ? '' : 'none';
  $('need-title').textContent = j.needTitle;
  $('need-list').innerHTML = j.requirements.map(r => `<li>${md(r)}</li>`).join('');
  const p = j.contact || {};
  $('contact').innerHTML =
    (p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : '') +
    `<div><div class="eyebrow">${esc(p.label || 'Contact')}</div><div class="name">${esc(p.name)}</div>` +
    (p.location ? `<div class="loc"><svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(p.location)}</div>` : '') +
    (p.link ? `<a class="btn" href="${esc(p.link)}" target="_blank" rel="noopener">Get in touch</a>` : '') + '</div>';
  $('foot').textContent = `${h.titleLine1} ${h.titleLine2} © ${h.year} · ${titleCase(h.label)}`;

  // When the soonest session ends, draw the page again so every date moves on without a reload.
  // Also redraw when the tab comes back, since timers can be late in hidden tabs or after sleep.
  clearTimeout(renderPage._rollTimer);
  const ends = c.schedule
    .map(item => { const s = nextStart(item); return s && s.getTime() + (Number(item.durationMin) || 0) * 60000; })
    .filter(Boolean);
  const wait = ends.length ? Math.min(...ends) - Date.now() + 1000 : null;
  if (wait !== null && wait < 2147483647) renderPage._rollTimer = setTimeout(() => renderPage(c, root), Math.max(wait, 1000));
  if (renderPage._onShow) document.removeEventListener('visibilitychange', renderPage._onShow);
  renderPage._onShow = () => { if (document.visibilityState === 'visible') renderPage(c, root); };
  document.addEventListener('visibilitychange', renderPage._onShow);
}
