// Hero globe: a slowly turning, lit Earth with the member pins on it.
// No photo: the surface is painted here from Natural Earth coastlines (public domain, assets/data/land-50m.json)
// with soft colours for forests, deserts and ice, a little relief noise and thin clouds, then wrapped on a sphere with WebGL.
// render.js puts the pins into #pins and calls heroGlobe.update(); this file moves them with the globe.
// Drag to turn it. It stops turning while a country label is open (.map.hold, set in render.js).
const heroGlobe = (function () {
  const stage = document.getElementById('globe');
  if (!stage) return { update() {} };
  const cv = stage.querySelector('canvas'), svg = stage.querySelector('svg'), map = stage.closest('.map');
  const TILT = .38;             // we look from a little north of the equator, so Europe sits well in view
  const R = 1 / 1.24;           // globe radius as a share of half the canvas (the rest is room for the glow)
  const SPEED = -2 * Math.PI / 70; // one turn in 70 s; minus = the surface moves west to east, like the real Earth
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let spin = 15 * Math.PI / 180, pins = [], size = 0, gl, draw;

  // ---------- Painting the surface (equirectangular, 2048 × 1024) ----------
  const W = 2048, H = 1024;
  const X = lon => (lon + 180) / 360 * W, Y = lat => (90 - lat) / 180 * H;
  const rand = (seed => () => ((seed = (seed + 0x6D2B79F5) | 0, seed = Math.imul(seed ^ (seed >>> 15), seed | 1),
    seed ^= seed + Math.imul(seed ^ (seed >>> 7), seed | 61), ((seed ^ (seed >>> 14)) >>> 0) / 4294967296)))(7);

  // Smooth random pattern that joins up at the left and right edges (so there is no seam on the globe)
  function noise(w, h, octaves) {
    const out = new Float32Array(w * h);
    let amp = 1, total = 0;
    for (let o = 0; o < octaves; o++) {
      const gw = 6 << o, gh = 3 << o, g = Float32Array.from({ length: gw * (gh + 1) }, rand);
      for (let y = 0; y < h; y++) {
        const fy = y / h * gh, y0 = fy | 0, ty = fy - y0, sy = ty * ty * (3 - 2 * ty);
        for (let x = 0; x < w; x++) {
          const fx = x / w * gw, x0 = fx | 0, tx = fx - x0, sx = tx * tx * (3 - 2 * tx), x1 = (x0 + 1) % gw;
          const a = g[y0 * gw + x0], b = g[y0 * gw + x1], c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x1];
          out[y * w + x] += amp * (a + (b - a) * sx + (c - a + (d - c - b + a) * sx) * sy);
        }
      }
      total += amp; amp *= .55;
    }
    for (let i = 0; i < out.length; i++) out[i] /= total;
    return out;
  }

  function landPath(topo) {
    const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => [X((x += dx) * sx + tx), Y((y += dy) * sy + ty)]); });
    const path = new Path2D();
    for (const g of topo.objects.land.geometries) for (const poly of g.type === 'Polygon' ? [g.arcs] : g.arcs) for (const ring of poly) {
      // Islands across the 180° line (Fiji, far-east Russia) would jump across the whole map:
      // keep the outline in one piece, then draw it again one map-width over so both halves show
      const pts = ring.flatMap(i => i < 0 ? arcs[~i].slice().reverse() : arcs[i]);
      // (Antarctica already runs edge to edge down to the pole, so it is left as it is)
      const pole = pts.some(p => p[1] > H * .97);
      let shift = 0, min = Infinity, max = -Infinity;
      const flat = [];
      pts.forEach(([x, y], j) => {
        if (j && !pole) { const d = x + shift - flat[j - 1][0]; if (d > W / 2) shift -= W; else if (d < -W / 2) shift += W; }
        flat.push([x + shift, y]); min = Math.min(min, x + shift); max = Math.max(max, x + shift);
      });
      for (const off of [0, min < 0 ? W : 0, max > W ? -W : 0].filter((o, k) => !k || o)) {
        flat.forEach(([x, y], j) => j ? path.lineTo(x + off, y) : path.moveTo(x + off, y));
        path.closePath();
      }
    }
    return path;
  }

  function paint(topo) {
    const land = landPath(topo);
    const make = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
    const [tex, t] = make(), [mask, m] = make(W / 2, H / 2), [cloud, cl] = make(W / 2, H / 2);

    // Sea: deep blue, a bit lighter toward the equator, with lighter shallow water along the coasts
    const sea = t.createLinearGradient(0, 0, 0, H);
    [[0, '#0b2448'], [.3, '#0f3a72'], [.5, '#14548f'], [.7, '#0f3a72'], [1, '#0b2448']].forEach(s => sea.addColorStop(...s));
    t.fillStyle = sea; t.fillRect(0, 0, W, H);
    t.filter = 'blur(7px)'; t.strokeStyle = 'rgba(70,160,200,.55)'; t.lineWidth = 9; t.stroke(land);
    t.filter = 'blur(2px)'; t.strokeStyle = 'rgba(110,200,220,.45)'; t.lineWidth = 3; t.stroke(land);
    t.filter = 'none';

    // Land: colour by latitude first (ice, tundra, forest, dry belts, jungle) ...
    t.save(); t.clip(land, 'evenodd');
    const band = t.createLinearGradient(0, 0, 0, H);
    [[90, '#e8eef3'], [76, '#d9e0e2'], [70, '#8d8f72'], [60, '#566d43'], [48, '#45703a'], [38, '#7c8450'], [30, '#b89f68'],
     [18, '#a99560'], [12, '#4f7a35'], [0, '#2f6429'], [-10, '#3d6c30'], [-18, '#8d8a52'], [-30, '#a8915e'], [-40, '#5f7d47'],
     [-50, '#6f7b5c'], [-58, '#dfe6ea'], [-90, '#f1f5f8']].forEach(([lat, c]) => band.addColorStop((90 - lat) / 180, c));
    t.fillStyle = band; t.fillRect(0, 0, W, H);
    // ... then soft patches for the big deserts, rain forests, mountains and ice sheets
    t.filter = 'blur(26px)';
    const patch = (lon1, lat1, lon2, lat2, c, a = 1) => {
      t.globalAlpha = a; t.fillStyle = c;
      t.beginPath(); t.ellipse((X(lon1) + X(lon2)) / 2, (Y(lat1) + Y(lat2)) / 2, Math.abs(X(lon2) - X(lon1)) / 2, Math.abs(Y(lat2) - Y(lat1)) / 2, 0, 0, 7); t.fill();
    };
    patch(-17, 31, 33, 15, '#d3a96a'); patch(-8, 33, 12, 27, '#cf9f62', .8);              // Sahara
    patch(35, 31, 60, 14, '#d0ac72'); patch(50, 38, 70, 25, '#b99b68', .8);               // Arabia, Iran
    patch(74, 46, 118, 36, '#bea474', .85); patch(80, 37, 100, 29, '#a9a397', .8);         // Gobi / Taklamakan, Tibet
    patch(114, -18, 146, -33, '#c48f58'); patch(118, -20, 135, -28, '#c9864f', .7);       // Australia
    patch(-121, 40, -103, 28, '#b39467', .8); patch(13, -18, 27, -29, '#b99a62', .8);       // US south-west, Kalahari
    patch(-76, -16, -66, -50, '#a59173', .7); patch(-74, -40, -64, -54, '#9d917a', .7);    // Atacama, Patagonia
    patch(-78, 6, -44, -16, '#2a5f25'); patch(8, 6, 30, -6, '#2b6226', .9);                 // Amazon, Congo
    patch(95, 28, 125, -8, '#356a2c', .85); patch(72, 30, 90, 12, '#6d7f3f', .7);          // South-east Asia, India
    patch(-96, 42, -70, 28, '#4b7536', .8); patch(-130, 70, -60, 50, '#4f6a40', .7);       // Eastern US, Canada
    patch(-74, 84, -12, 59, '#eef3f6'); patch(-58, 80, -25, 63, '#f4f7f9');                // Greenland ice
    patch(-80, 82, -60, 70, '#d4dcdf', .8); patch(90, 82, 150, 72, '#c9d1d0', .6);         // Arctic islands
    t.globalAlpha = 1; t.filter = 'none';
    // Relief: big and small lumps, so the land is not flat colour
    const [rel, r] = make(W / 2, H / 2), n = noise(W / 2, H / 2, 6), img = r.createImageData(W / 2, H / 2);
    for (let i = 0; i < n.length; i++) {
      const v = Math.max(0, Math.min(255, (n[i] - .5) * 2.4 * 255 + 128));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    r.putImageData(img, 0, 0);
    t.globalCompositeOperation = 'soft-light'; t.drawImage(rel, 0, 0, W, H);
    t.globalCompositeOperation = 'source-over'; t.restore();
    // A faint lighter line right on the coast
    t.strokeStyle = 'rgba(230,220,180,.25)'; t.lineWidth = 1; t.stroke(land);

    // Land / sea mask (the sea gets a soft shine from the sun)
    m.scale(.5, .5); m.fillStyle = '#fff'; m.fill(land, 'evenodd');

    // Thin clouds: wispy, more of them in the stormy belts, fewer over the deserts
    const c = noise(W / 2, H / 2, 6), ci = cl.createImageData(W / 2, H / 2);
    for (let y = 0; y < H / 2; y++) {
      const lat = 90 - y / (H / 2) * 180, belt = .62 - .1 * Math.cos(lat / 90 * Math.PI * 3) + .04 * Math.abs(lat) / 90;
      for (let x = 0; x < W / 2; x++) {
        const i = y * W / 2 + x, v = Math.max(0, Math.min(1, (c[i] - belt) / .12));
        ci.data[i * 4] = v * v * 255; ci.data[i * 4 + 3] = 255;
      }
    }
    cl.putImageData(ci, 0, 0);
    return { tex, mask, cloud };
  }

  // ---------- Drawing the sphere ----------
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform sampler2D tex,mask,cloud;uniform vec2 res;uniform float spin,tilt,R,ready;
const vec3 L=vec3(-.52,.46,.72);
void main(){
  vec2 p=(gl_FragCoord.xy/res*2.-1.)/R;float q=dot(p,p),d=sqrt(q),px=2./(res.x*R);
  vec3 l=normalize(L);
  float out_=max(d-1.,0.);
  float side=.45+.55*clamp(dot(normalize(p),normalize(l.xy))*.5+.6,0.,1.);
  vec4 glow=vec4(vec3(.36,.62,1.),1.)*exp(-out_*15.)*.75*side;
  if(q>1.+px*4.){gl_FragColor=glow;return;}
  vec3 n=vec3(p,sqrt(max(0.,1.-q)));
  float ct=cos(tilt),st=sin(tilt);
  vec3 w=vec3(n.x,n.y*ct+n.z*st,-n.y*st+n.z*ct);
  float lat=asin(clamp(w.y,-1.,1.)),lon=atan(w.x,w.z)+spin;
  vec2 uv=vec2(fract(lon/6.28318+.5),.5-lat/3.14159);
  vec3 c=texture2D(tex,uv).rgb;float land=texture2D(mask,uv).r;
  float cl=texture2D(cloud,vec2(fract(uv.x+.013),uv.y)).r;
  float dif=dot(n,l),day=smoothstep(-.3,.45,dif);
  c*=.3+.9*day;
  c=mix(c,vec3(.94,.96,1.)*(.32+.75*day),cl*.7);
  vec3 h=normalize(l+vec3(0.,0.,1.));
  c+=vec3(1.,.95,.85)*pow(max(dot(n,h),0.),38.)*.5*(1.-land)*(1.-cl);
  float rim=pow(1.-n.z,2.4);
  c=mix(c,vec3(.45,.7,1.)*(.35+.8*day),rim*.8);
  c=mix(vec3(.10,.17,.32),c,ready);
  float a=clamp((1.-d)/px+.5,0.,1.);
  gl_FragColor=vec4(c,1.)*a+glow*(1.-a);
}`;

  function setupGL() {
    gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    if (!gl) return false;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    ['tex', 'mask', 'cloud'].forEach((n, i) => gl.uniform1i(u(n), i));
    gl.uniform1f(u('tilt'), TILT); gl.uniform1f(u('R'), R); gl.uniform1f(u('ready'), 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    draw = () => {
      gl.viewport(0, 0, cv.width, cv.height);
      gl.uniform2f(u('res'), cv.width, cv.height); gl.uniform1f(u('spin'), spin);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    draw.ready = imgs => {
      [imgs.tex, imgs.mask, imgs.cloud].forEach((img, i) => {
        gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      });
      gl.uniform1f(u('ready'), 1);
    };
    return true;
  }

  // ---------- Pins ----------
  function placePins() {
    const half = size / 2, rad = half * R, ct = Math.cos(TILT), st = Math.sin(TILT);
    for (const p of pins) {
      const la = p.lat * Math.PI / 180, lo = p.lon * Math.PI / 180 - spin;
      const wx = Math.cos(la) * Math.sin(lo), wy = Math.sin(la), wz = Math.cos(la) * Math.cos(lo);
      const ny = wy * ct - wz * st, nz = wy * st + wz * ct;
      const show = nz > 0;
      if (show !== p.shown) { p.el.style.display = show ? '' : 'none'; p.shown = show; }
      if (!show) continue;
      const k = .55 + .45 * Math.min(1, nz * 1.6); // smaller and fainter toward the edge of the globe
      p.el.setAttribute('transform', `translate(${(half + wx * rad).toFixed(1)} ${(half - ny * rad).toFixed(1)}) scale(${k.toFixed(3)})`);
      p.el.style.opacity = Math.min(1, nz * 4).toFixed(2);
    }
  }

  function fit() {
    const s = cv.getBoundingClientRect().width, dpr = Math.min(devicePixelRatio || 1, 2);
    if (!s) return;
    size = s;
    cv.width = cv.height = Math.round(s * dpr);
    svg.setAttribute('viewBox', `0 0 ${s} ${s}`);
  }

  // ---------- Turning ----------
  let last = 0, drag = null, visible = true;
  function frame(now) {
    const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
    if (!drag && !still && !map.classList.contains('hold')) spin += SPEED * dt;
    draw?.(); placePins();
    if (visible || drag) requestAnimationFrame(frame); else last = 0;
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting;
    if (visible && !was) requestAnimationFrame(frame);
  }).observe(stage);

  stage.addEventListener('pointerdown', e => {
    if (e.button || e.target.closest('.pin-g')) return;
    drag = { x: e.clientX, spin, moved: false };
    stage.setPointerCapture(e.pointerId); stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    spin = drag.spin - dx / (size / 2 * R); // the surface follows the finger
  });
  const end = () => { if (drag) { drag = null; stage.classList.remove('dragging'); } };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);

  fit();
  addEventListener('resize', fit);
  if (setupGL()) {
    fetch('assets/data/land-50m.json').then(r => r.json()).then(topo => {
      // Paint after the first frames are out, so the opening intro stays smooth
      (window.requestIdleCallback || setTimeout)(() => { draw.ready(paint(topo)); stage.classList.add('ready'); });
    }).catch(() => stage.classList.add('ready'));
  } else stage.classList.add('flat'); // no WebGL: a plain shaded ball (style.css) with the pins still on it
  requestAnimationFrame(frame);

  return {
    // Re-read the pins after render.js has drawn them
    update() {
      pins = [...svg.querySelectorAll('.pin-pos')].map(el => ({ el, lat: +el.dataset.lat, lon: +el.dataset.lon, shown: true }));
      placePins();
    }
  };
})();
