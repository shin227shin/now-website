// The Earth shared by the opening intro (intro.js) and the hero globe (globe.js): the surface pictures and the WebGL code
// that wraps them on a lit sphere. The pictures are painted from Natural Earth coastlines by tools/globe-texture.html
// and saved in assets/img/earth/ (index.html starts loading the smaller ones right away).
const earth = (function () {
  const dir = 'assets/img/earth/';
  const img = name => { const i = new Image(); i.src = dir + name; return i.decode().then(() => i); };
  let surface;
  // Surface (2048 px wide), land / sea mask and clouds. surfaceBig() is the 4096 px one, for zooming in on bigger screens.
  const load = () => surface ??= Promise.all(['surface-2048.webp', 'land.webp', 'clouds.webp'].map(img))
    .then(([tex, mask, cloud]) => ({ tex, mask, cloud }));
  const surfaceBig = () => img('surface-4096.webp');

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform sampler2D tex,mask,cloud;uniform vec2 mid;uniform float spin,tilt,Rp,ready;
const vec3 L=vec3(-.52,.46,.72);
void main(){
  vec2 p=(gl_FragCoord.xy-mid)/Rp;float q=dot(p,p),d=sqrt(q),px=1./Rp;
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

  // Draws the globe into a canvas: draw(spin, tilt, radius, centerX, centerY), all in canvas pixels (y down).
  // Returns null without WebGL.
  function renderer(cv) {
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const u = n => gl.getUniformLocation(prog, n);
    ['tex', 'mask', 'cloud'].forEach((n, i) => gl.uniform1i(u(n), i));
    gl.uniform1f(u('ready'), 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const texture = (i, img) => {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    return {
      maxTexture: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      draw(spin, tilt, r, x = cv.width / 2, y = cv.height / 2) {
        gl.viewport(0, 0, cv.width, cv.height);
        gl.uniform2f(u('mid'), x, cv.height - y);
        gl.uniform1f(u('spin'), spin); gl.uniform1f(u('tilt'), tilt); gl.uniform1f(u('Rp'), r);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
      // Hand over the surface pictures (from load()); the globe is a plain dark ball until then
      ready(s) { texture(0, s.tex); texture(1, s.mask); texture(2, s.cloud); gl.uniform1f(u('ready'), 1); },
      // Swap in the sharper surface
      sharper(img) { texture(0, img); }
    };
  }

  return { load, surfaceBig, renderer };
})();
