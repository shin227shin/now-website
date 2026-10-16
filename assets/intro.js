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

    // Earth: a tiny blue point far away that grows fast at the end
    const d = Math.max(.003, 1 - .997 * Math.pow(clamp(t / 2.5), 2));
    const r = 2.6 / d;
    const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 7);
    halo.addColorStop(0, 'rgba(160,205,255,.55)');
    halo.addColorStop(.35, 'rgba(255,154,118,.12)');
    halo.addColorStop(1, 'rgba(255,154,118,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, cy, r * 7, 0, 6.29); ctx.fill();
    const core = ctx.createRadialGradient(cx - r * .3, cy - r * .3, 0, cx, cy, r);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(.45, '#9fd0ff');
    core.addColorStop(1, 'rgba(60,120,220,.9)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();

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
