// Opening intro: drift through space toward a small glowing Earth, it fills the screen with light,
// then the light falls away onto the hero globe and the member pins light up (see style.css).
// Only runs when the <head> script turned it on (html.intro). Click, tap, scroll or any key skips it.
(function () {
  const root = document.documentElement, ov = document.getElementById('intro');
  if (!root.classList.contains('intro') || !ov) return;

  // Three layers: stars at the back, the Earth (WebGL, assets/earth.js) in the middle, the flash of light on top
  const cv = ov.querySelector('canvas'), ctx = cv.getContext('2d');
  const ecv = document.createElement('canvas'), fcv = document.createElement('canvas'), fctx = fcv.getContext('2d');
  cv.after(ecv, fcv);
  const globe = earth.renderer(ecv);
  const LAND = 2.65; // seconds from the start of the approach until the hero shows through
  let w, h, dpr, t0, last, raf, done = false, ready = !globe; // without WebGL: a plain blue ball, straight away

  const fit = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    for (const c of [cv, ecv, fcv]) { c.width = w * dpr; c.height = h * dpr; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const dt = Math.min(.05, (now - (last ?? now)) / 1000); last = now;
    // The approach starts once the Earth's surface is loaded; until then the stars just drift
    if (ready) t0 ??= now;
    const t = t0 === undefined ? 0 : (now - t0) / 1000, cx = w / 2, cy = h / 2, view = Math.max(w, h);
    ctx.fillStyle = '#05060d';
    ctx.fillRect(0, 0, w, h);

    // Stars: slow drift at first, then rushing past as we close in
    const speed = .03 + .9 * Math.pow(clamp(t / LAND), 3);
    for (const p of stars) {
      p.z -= speed * dt;
      if (p.z <= .02) { p.z += 1; p.x = (Math.random() - .5) * 2; p.y = (Math.random() - .5) * 2; }
      const k = .5 / p.z, sx = cx + p.x * view * k, sy = cy + p.y * view * k;
      if (sx < -10 || sx > w + 10 || sy < -10 || sy > h + 10) continue;
      const a = clamp((1 - p.z) * 1.4) * (.7 + .3 * Math.sin(now / 1000 * 3 + p.tw));
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

    if (t0 !== undefined) {
      // Earth: small and far away at first (fading in), then it grows fast at the end
      const d = Math.max(.003, 1 - .997 * Math.pow(clamp(t / 2.5), 2));
      const r = 14 / d;
      if (globe) {
        // Turning a little faster than the hero globe, and ending on exactly the view the hero shows
        const v = typeof heroGlobe !== 'undefined' && heroGlobe.view ? heroGlobe.view() : { spin: .26, tilt: .38 };
        ecv.style.opacity = clamp(t / .4);
        globe.draw(v.spin + .5 * Math.pow(1 - clamp(t / LAND), 2), v.tilt, r * dpr);
      } else {
        const halo = ctx.createRadialGradient(cx, cy, r * .98, cx, cy, r * 1.18);
        halo.addColorStop(0, 'rgba(120,180,255,.55)');
        halo.addColorStop(1, 'rgba(90,150,255,0)');
        ctx.fillStyle = halo;
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.18, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#4f86d9';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.fill();
      }

      // Flash of light as we reach it: spreads out from Earth until it covers the screen
      const flash = clamp((t - 2.25) / .35);
      if (flash) {
        const R = view * (.15 + flash * 1.1), glow = fctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        glow.addColorStop(0, `rgba(250,248,242,${flash})`);
        glow.addColorStop(.5, `rgba(214,232,255,${flash * .85})`);
        glow.addColorStop(1, `rgba(214,232,255,${flash * flash * .9})`);
        fctx.clearRect(0, 0, w, h); fctx.fillStyle = glow; fctx.fillRect(0, 0, w, h);
      }
    }

    if (t >= LAND) land();
    if (!done || t < LAND + 1) raf = requestAnimationFrame(frame);
  }

  function land() {
    if (done) return;
    done = true;
    clearTimeout(cap);
    root.classList.add('landed');
    dispatchEvent(new Event('intro-landed')); // globe.js then loads its sharper surface
    setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', fit); ov.remove(); }, 1000);
  }

  // If that takes too long (slow connection), skip straight to the page
  let cap = setTimeout(land, 4000);
  const go = () => {
    ready = true;
    clearTimeout(cap);
    cap = setTimeout(land, LAND * 1000 + 400); // in case animation frames are paused (e.g. tab opened in the background)
  };
  // Start the approach once the surface is in, the web fonts are loaded and the page content is laid out (index.html),
  // so none of them interrupts the flight
  const rendered = new Promise(ok => addEventListener('page-rendered', ok, { once: true }));
  const surface = globe ? earth.load().then(s => { if (!done) { globe.ready(s); globe.draw(0, .38, 14 * dpr); } }) : null; // (plus one hidden draw, so the first frame of the flight is quick)
  Promise.all([surface, rendered, document.fonts?.ready]).then(() => { document.body.offsetHeight; done || go(); }, land); // (offsetHeight: lay out now, not in the first frame of the flight)
  ecv.style.opacity = 0;
  raf = requestAnimationFrame(frame);
  ['pointerdown', 'wheel', 'touchmove', 'keydown'].forEach(ev => addEventListener(ev, land, { once: true, passive: true }));
})();
