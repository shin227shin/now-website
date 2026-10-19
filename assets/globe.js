// Hero globe: a slowly turning, lit Earth with the member pins on it.
// The surface pictures and the WebGL drawing come from assets/earth.js (shared with the opening intro).
// render.js puts the pins into #pins and calls heroGlobe.update(); this file moves them with the globe.
// Drag to turn it; zoom with the + / − buttons, Ctrl (⌘) + scroll, a trackpad or two-finger pinch, or a double-click.
// Zoomed in, dragging up and down shows the north and the south. It stops turning while a country label is open (.map.hold, set in render.js).
// The canvas spans the full width of the screen so a zoomed-in globe can grow past its square.
const heroGlobe = (function () {
  const stage = document.getElementById('globe');
  if (!stage) return { update() {} };
  const cv = stage.querySelector('canvas'), svg = stage.querySelector('svg'), map = stage.closest('.map');
  const TILT = .38;             // we look from a little north of the equator, so Europe sits well in view
  const ZMAX = 3.5;
  const SPEED = -2 * Math.PI / 70; // one turn in 70 s; minus = the surface moves west to east, like the real Earth
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spin = 15 * Math.PI / 180, tilt = TILT, zoom = 1, zoomTo = 1, pins = [], size = 0, cw = 0, ch = 0;
  const gl = earth.renderer(cv), root = document.documentElement;

  // ---------- Pins ----------
  function placePins() {
    const rad = size / 2 * zoom, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const p of pins) {
      const la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180 - spin;
      const wx = Math.cos(la) * Math.sin(lo), wy = Math.sin(la), wz = Math.cos(la) * Math.cos(lo);
      const ny = wy * ct - wz * st, nz = wy * st + wz * ct, y = ch / 2 - ny * rad;
      // Pins fade out with the top of the canvas (its top 9%, style.css); zoomed in, pins below the globe's square sit in the
      // faded-out part above the numbers. Nearly invisible pins are hidden so they can't be clicked by accident.
      const top = Math.min(1, y / (ch * .09));
      const show = nz > 0 && top > .15 && !(zoomTo > 1 && y > ch / 2 + size / 2 - 20);
      if (show !== p.shown) { p.el.style.display = show ? '' : 'none'; p.shown = show; }
      if (!show) continue;
      const k = .55 + .45 * Math.min(1, nz * 1.6); // smaller and fainter toward the edge of the globe
      p.el.setAttribute('transform', `translate(${(cw / 2 + wx * rad).toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})`);
      p.el.style.opacity = (Math.min(1, nz * 4) * top).toFixed(2);
    }
  }

  function fit() {
    // Layout sizes, not getBoundingClientRect(): those would include the intro's zoom-out (html.intro .map, style.css)
    const dpr = Math.min(devicePixelRatio || 1, 2);
    if (!cv.offsetWidth) return;
    size = stage.offsetWidth; cw = cv.offsetWidth; ch = cv.offsetHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    svg.setAttribute('viewBox', `0 0 ${cw} ${ch}`);
  }

  // ---------- Turning ----------
  let last = 0, drag = null, pinch = null, visible = true;
  const touches = new Map();
  function frame(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!drag && !touches.size && !still && !map.classList.contains('hold')) spin += SPEED * (zoomTo > 1 ? .3 : 1) * dt;
    zoom += (zoomTo - zoom) * Math.min(1, dt * 9);
    if (zoomTo === 1 && !drag) tilt += (TILT - tilt) * Math.min(1, dt * 4); // back to the usual view when zoomed out
    // Hidden under the opening intro: keep turning, but leave the drawing to the intro
    if (!root.classList.contains('intro') || root.classList.contains('landed')) { gl?.draw(spin, tilt, size / 2 * zoom * cv.width / cw); placePins(); }
    if (visible || drag) requestAnimationFrame(frame); else last = 0;
  }

  const moved = () => map.dispatchEvent(new Event('globe-move')); // closes an open country label (render.js)
  const [zin, zout] = stage.querySelectorAll('.zoom button');
  function setZoom(z) {
    zoomTo = Math.max(1, Math.min(ZMAX, z));
    if (zoomTo < 1.02) zoomTo = 1;
    stage.classList.toggle('zoomed', zoomTo > 1); // zoomed in, a finger drag turns the globe instead of scrolling the page
    zin.disabled = zoomTo >= ZMAX; zout.disabled = zoomTo === 1;
    moved();
  }
  zin.addEventListener('click', () => setZoom(zoomTo * 1.6));
  zout.addEventListener('click', () => setZoom(zoomTo / 1.6));
  zout.disabled = true;
  // Is a point on the globe itself (not the empty space around it)?
  const onGlobe = e => { const b = cv.getBoundingClientRect(); return Math.hypot(e.clientX - b.left - cw / 2, e.clientY - b.top - ch / 2) < size / 2 * zoom; };
  stage.addEventListener('dblclick', e => { if (onGlobe(e) && !e.target.closest('.pin-g,.zoom')) setZoom(zoomTo * 1.8); });
  // Ctrl / ⌘ + scroll and trackpad pinch zoom; a plain scroll keeps scrolling the page (with a short hint)
  const hint = stage.querySelector('.globe-hint');
  if (/Mac|iP/.test(navigator.platform)) hint.textContent = hint.textContent.replace('Ctrl', '⌘');
  let hintT;
  stage.addEventListener('wheel', e => {
    if (!onGlobe(e)) return;
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(zoomTo * Math.exp(-e.deltaY * (Math.abs(e.deltaY) < 30 ? .02 : .004))); return; }
    stage.classList.add('hint'); clearTimeout(hintT); hintT = setTimeout(() => stage.classList.remove('hint'), 1400);
  }, { passive: false });
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(stage);

  stage.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('.pin-g,.zoom') || !onGlobe(e)) return;
    if (e.pointerType === 'touch') touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (touches.size === 2) { // two fingers: pinch to zoom
      const [a, b] = [...touches.values()];
      drag = null; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: zoomTo };
      return;
    }
    drag = { x: e.clientX, y: e.clientY, spin, tilt, id: e.pointerId };
    stage.setPointerCapture(e.pointerId); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      return setZoom(pinch.z * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d);
    }
    if (!drag || e.pointerId !== drag.id) return;
    const r = size / 2 * zoom, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) moved();
    spin = drag.spin - dx / r; // the surface follows the finger
    // Up and down: always with a mouse, and with a finger once zoomed in (otherwise that is a page scroll)
    if (e.pointerType === 'mouse' || zoomTo > 1) tilt = Math.max(-1.2, Math.min(1.35, drag.tilt + dy / r));
  });
  const end = e => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (drag && e.pointerId === drag.id) { drag = null; stage.classList.remove('dragging'); }
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  fit();
  addEventListener('resize', fit);
  if (!gl) stage.classList.add('flat'); // no WebGL: a plain shaded ball (style.css) with the pins still on it
  const api = {
    view: () => ({ spin, tilt }), // the opening intro ends on the same view
    // Re-read the pins after render.js has drawn them
    update() {
      pins = [...svg.querySelectorAll('.pin-pos')].map(el => ({ el, lat: +el.dataset.lat, lon: +el.dataset.lon, shown: true }));
      placePins();
    }
  };
  earth.load().then(s => {
    gl?.ready(s);
    stage.classList.add('ready');
    // Bigger screens get the sharper surface for zooming in, once the intro is over and the pins are out
    if (!gl || innerWidth <= 700 || gl.maxTexture < 4096) return;
    new Promise(ok => root.classList.contains('intro') && !root.classList.contains('landed') ? addEventListener('intro-landed', ok, { once: true }) : ok())
      .then(() => new Promise(ok => setTimeout(ok, 3000)))
      .then(earth.surfaceBig).then(img => gl.sharper(img)).catch(() => {});
  }).catch(() => stage.classList.add('ready'));
  requestAnimationFrame(frame);
  return api;
})();
