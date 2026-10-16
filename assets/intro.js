// Opening intro: drift through space toward a small glowing Earth, it fills the screen with light,
// then the light falls away onto the hero world map and the member pins light up (see style.css).
// Only runs when the <head> script turned it on (html.intro). Click, tap, scroll or any key skips it.
(function () {
  const root = document.documentElement, ov = document.getElementById('intro');
  if (!root.classList.contains('intro') || !ov) return;

  const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
  const LAND = 2.65; // seconds until the map shows through
  let w, h, dpr, t0, raf, done = false;

  const fit = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  fit();
  addEventListener('resize', fit);

  // Stars in 3D (x, y spread around the view, z = distance); we fly toward +z
  const stars = Array.from({ length: 520 }, () => ({
    x: (Math.random() - .5) * 2, y: (Math.random() - .5) * 2, z: Math.random(),
    s: Math.random() * 1.1 + .3, tw: Math.random() * 6.28
  }));

  const clamp = v => Math.max(0, Math.min(1, v));

  // Earth globe: NASA "Blue Marble" photo (public domain, assets/img/earth.jpg) wrapped on a sphere,
  // lit by the sun from the upper left, with a thin blue atmosphere at the edge.
  // Drawn into a small canvas once per frame and then scaled to the size on screen.
  const S = 512, earth = { cv: document.createElement('canvas'), ready: false };
  earth.cv.width = earth.cv.height = S;
  const ectx = earth.cv.getContext('2d'), out = ectx.createImageData(S, S);
  const tex = new Image();
  tex.onload = () => {
    const c = document.createElement('canvas');
    c.width = tex.width; c.height = tex.height;
    c.getContext('2d').drawImage(tex, 0, 0);
    earth.tex = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    // Per pixel of the disk: longitude offset, texture row, sunlight, and how close to the edge it is
    const tilt = .41, ct = Math.cos(tilt), st = Math.sin(tilt); // Earth's axis leans about 23°
    const L = [-.68, -.42, .6], idx = [], lon = [], row = [], sun = [], rim = [];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const nx = (x + .5) / S * 2 - 1, ny = (y + .5) / S * 2 - 1, q = nx * nx + ny * ny;
      if (q >= 1) continue;
      const nz = Math.sqrt(1 - q), ax = nx * ct + ny * st, ay = -nx * st + ny * ct;
      idx.push((y * S + x) * 4);
      lon.push(Math.atan2(ax, nz) / (2 * Math.PI));
      row.push(Math.min(c.height - 1, Math.floor((Math.asin(ay) / Math.PI + .5) * c.height)));
      const l = nx * L[0] + ny * L[1] + nz * L[2];
      sun.push(.04 + 1.05 * clamp(l * 1.6 + .08)); // soft edge between day and night
      rim.push(Math.pow(1 - nz, 2.2) * .7);
    }
    Object.assign(earth, { idx, lon: Float32Array.from(lon), row: Int32Array.from(row), sun: Float32Array.from(sun), rim: Float32Array.from(rim), ready: true });
  };
  tex.src = 'assets/img/earth.jpg';

  function drawEarth(turn) {
    const { tex: { data: T, width: TW }, idx, lon, row, sun, rim } = earth, D = out.data;
    for (let i = 0; i < idx.length; i++) {
      let u = lon[i] + turn / (2 * Math.PI) + .5;
      u -= Math.floor(u);
      const s = (row[i] * TW + Math.floor(u * TW)) * 4, o = idx[i], k = sun[i], a = rim[i];
      D[o] = T[s] * k * (1 - a) + 110 * a * Math.min(1, k + .15);
      D[o + 1] = T[s + 1] * k * (1 - a) + 170 * a * Math.min(1, k + .15);
      D[o + 2] = T[s + 2] * k * (1 - a) + 255 * a * Math.min(1, k + .15);
      D[o + 3] = 255;
    }
    ectx.putImageData(out, 0, 0);
  }

  function frame(now) {
    t0 ??= now;
    const t = (now - t0) / 1000, cx = w / 2, cy = h / 2, view = Math.max(w, h);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, w, h);

    // Stars: slow drift at first, then rushing past as we close in
    const speed = .03 + .9 * Math.pow(clamp(t / LAND), 3);
    for (const p of stars) {
      p.z -= speed / 60;
      if (p.z <= .02) { p.z += 1; p.x = (Math.random() - .5) * 2; p.y = (Math.random() - .5) * 2; }
      const k = .5 / p.z, sx = cx + p.x * view * k, sy = cy + p.y * view * k;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      const a = clamp((1 - p.z) * 1.4) * (.7 + .3 * Math.sin(t * 3 + p.tw));
      const r = p.s * (1.2 - p.z);
      ctx.strokeStyle = ctx.fillStyle = `rgba(220,228,255,${a})`;
      if (speed > .25) { // streaks once we speed up
        const k2 = .5 / (p.z + speed / 20);
        ctx.lineWidth = r;
        ctx.beginPath(); ctx.moveTo(cx + p.x * view * k2, cy + p.y * view * k2); ctx.lineTo(sx, sy); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.29); ctx.fill();
      }
    }

    // Earth: small and far away at first, then it grows fast at the end
    const d = Math.max(.003, 1 - .997 * Math.pow(clamp(t / 2.5), 2));
    const r = 14 / d;
    // Thin atmosphere glow just outside the edge
    const halo = ctx.createRadialGradient(cx, cy, r * .98, cx, cy, r * 1.18);
    halo.addColorStop(0, 'rgba(120,180,255,.55)');
    halo.addColorStop(.35, 'rgba(90,150,255,.18)');
    halo.addColorStop(1, 'rgba(90,150,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, 6.29); ctx.fill();
    if (earth.ready) {
      drawEarth(.95 - t * .12); // the globe turns slowly (Europe, Africa and Asia face us)
      ctx.drawImage(earth.cv, cx - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = '#4f86d9';
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
    }

    // Flash of light as we reach it: spreads out from Earth until it covers the screen
    const flash = clamp((t - 2.25) / .35);
    if (flash) {
      const R = view * (.15 + flash * 1.1), glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      glow.addColorStop(0, `rgba(250,248,242,${flash})`);
      glow.addColorStop(.5, `rgba(214,232,255,${flash * .85})`);
      glow.addColorStop(1, `rgba(214,232,255,${flash * flash * .9})`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    }

    if (t >= LAND) land();
    if (!done || t < LAND + 1) raf = requestAnimationFrame(frame);
  }

  function land() {
    if (done) return;
    done = true;
    root.classList.add('landed');
    setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', fit); ov.remove(); }, 1000);
  }

  raf = requestAnimationFrame(frame);
  setTimeout(land, LAND * 1000 + 400); // in case animation frames are paused (e.g. tab opened in the background)
  ['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach(ev => addEventListener(ev, land, { once: true, passive: true }));
})();
