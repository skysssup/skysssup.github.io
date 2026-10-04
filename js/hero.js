/* Hero: the GitHub avatar as a stippled sculpture in WebGL2, wrapped in a ring of project names.
   Data comes from tools/hero/build.py (depth, ink and mask maps plus a blue-noise threshold tile).
   Pure helpers are exported for Node tests; the browser gets window.SkyHero. */
(function (global) {
  "use strict";

  var TAU = Math.PI * 2;

  /* ── pure helpers ─────────────────────────────────────── */

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  // 32-bit integer hash (same constants as the vertex shader) mapped to [0, 1).
  function hash(i) {
    i = i >>> 0;
    i = Math.imul(i ^ (i >>> 16), 0x7feb352d) >>> 0;
    i = Math.imul(i ^ (i >>> 15), 0x846ca68b) >>> 0;
    i = (i ^ (i >>> 16)) >>> 0;
    return i / 4294967296;
  }

  // Gear Two pulse: a double beat ("lub-dub") every 0.9 s, resting near zero between beats.
  function heartbeat(t) {
    var p = (((t % 0.9) + 0.9) % 0.9) / 0.9;
    return Math.exp(-Math.pow((p - 0.08) / 0.045, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.3) / 0.05, 2));
  }

  // Critically damped spring, integrated implicitly so it is stable at any frame time.
  function spring(state, target, dt, omega) {
    var f = 1 + 2 * dt * omega;
    var oo = omega * omega;
    var hoo = dt * oo;
    var hhoo = dt * hoo;
    var det = 1 / (f + hhoo);
    var x = (f * state.x + dt * state.v + hhoo * target) * det;
    var v = (state.v + hoo * (target - state.x)) * det;
    state.x = x;
    state.v = v;
    return state;
  }

  // A click ring: a gaussian band travelling outward at `speed` px/s that fades over `life` s.
  // Returns the outward displacement weight (0..1) at `dist` px from the click, `age` s after it.
  function rippleWeight(dist, age, speed, width, life) {
    if (age < 0 || age > life) return 0;
    var d = (dist - age * speed) / width;
    return Math.exp(-d * d) * (1 - age / life);
  }

  // Whether dot `id` is blinked off at time t (s). Each dot gets a random cycle offset; in a fraction of
  // its cycles it switches off for a short random window. Mirrors the vertex shader.
  var BLINK_PERIOD = 3.2, BLINK_CHANCE = 0.32, BLINK_MIN = 0.08, BLINK_MAX = 0.24;
  function blinkOff(id, t, rate) {
    var period = BLINK_PERIOD / rate;
    var phase = t / period + hash(id * 3 + 7);
    var cycle = Math.floor(phase);
    var local = (phase - cycle) * period;
    var key = (id * 7919 + cycle * 104729) >>> 0;
    if (hash(key) > BLINK_CHANCE) return false;
    var start = hash(key + 1) * (period - BLINK_MAX);
    var dur = BLINK_MIN + hash(key + 2) * (BLINK_MAX - BLINK_MIN);
    return local >= start && local < start + dur;
  }

  // Threshold stippling: every cell of a res x res grid over the figure keeps a dot when its ink
  // (bilinear from the size x size map) beats the tiled blue-noise threshold. Output is
  // [x, y, z, ink] per dot with x, y in figure units (0..1) and z the depth (0..1, near = 1).
  function stipple(rgba, size, noise, noiseSize, res, density, jitter) {
    var out = [];
    var scale = (size - 1) / res;
    for (var gy = 0; gy < res; gy++) {
      var v = (gy + 0.5) * scale;
      var i0 = Math.floor(v), fy = v - i0, i1 = Math.min(i0 + 1, size - 1);
      for (var gx = 0; gx < res; gx++) {
        var u = (gx + 0.5) * scale;
        var j0 = Math.floor(u), fx = u - j0, j1 = Math.min(j0 + 1, size - 1);
        var a = (i0 * size + j0) * 4, b = (i0 * size + j1) * 4, c = (i1 * size + j0) * 4, d = (i1 * size + j1) * 4;
        var w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
        var ink = (rgba[a + 1] * w00 + rgba[b + 1] * w01 + rgba[c + 1] * w10 + rgba[d + 1] * w11) / 255;
        if (ink <= 0) continue;
        var threshold = noise[(gy % noiseSize) * noiseSize + (gx % noiseSize)] / 255;
        if (ink * density <= threshold) continue;
        var depth = (rgba[a] * w00 + rgba[b] * w01 + rgba[c] * w10 + rgba[d] * w11) / 255;
        var k = gy * res + gx;
        var jx = jitter ? (hash(k * 2 + 1) - 0.5) * jitter : 0;
        var jy = jitter ? (hash(k * 2 + 2) - 0.5) * jitter : 0;
        out.push((gx + 0.5 + jx) / res, (gy + 0.5 + jy) / res, depth, ink);
      }
    }
    return new Float32Array(out);
  }

  // Grid resolution for a figure drawn `px` CSS pixels wide: about one cell per pixel, within limits.
  function resolutionFor(px) { return Math.round(clamp(px * 0.8, 280, 640)); }

  // A surface normal per dot from the depth map (red channel) by central differences, one-sided at the
  // mask's edge (blue channel), with the depth scaled to `relief` figure units like the vertex shader does.
  // Output is [nx, ny] per dot in world space (y up); the shader rebuilds nz = sqrt(1 - nx² - ny²).
  function depthNormals(rgba, size, points, relief) {
    var n = points.length / 4, out = new Float32Array(n * 2), step = 2, last = size - 1;
    var depth = function (x, y) { return rgba[(y * size + x) * 4] / 255; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x <= last && y <= last && rgba[(y * size + x) * 4 + 2] > 12; };
    var slope = function (x, y, dx, dy) {
      var a = inside(x - dx, y - dy), b = inside(x + dx, y + dy);
      if (a && b) return (depth(x + dx, y + dy) - depth(x - dx, y - dy)) / (2 * step);
      if (b) return (depth(x + dx, y + dy) - depth(x, y)) / step;
      if (a) return (depth(x, y) - depth(x - dx, y - dy)) / step;
      return 0;
    };
    for (var i = 0; i < n; i++) {
      var x = clamp(Math.round(points[i * 4] * last), 0, last), y = clamp(Math.round(points[i * 4 + 1] * last), 0, last);
      var gx = slope(x, y, step, 0) * last * relief, gy = slope(x, y, 0, step) * last * relief;
      var nx = -gx, ny = gy, len = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= len;
      ny /= len;
      var tilt = Math.sqrt(nx * nx + ny * ny), limit = 0.94;
      if (tilt > limit) { nx *= limit / tilt; ny *= limit / tilt; }
      out[i * 2] = nx;
      out[i * 2 + 1] = ny;
    }
    return out;
  }

  // Gear Two glitch tiles for one 24 fps frame: up to `count` blocks of the figure that jump sideways,
  // each [x, y, w, h, dx, dy] in canvas px inside `box` ({x, y, size}). Deterministic per frame; `onFigure`
  // (optional) rejects candidates whose centre misses the figure, so blocks tear out of the statue, not the air.
  function glitchTiles(frame, box, count, onFigure) {
    var tiles = [];
    for (var i = 0; i < count; i++) {
      var k = (frame * 7 + i) * 11;
      if (hash(k) > 0.72) continue;
      var w = box.size * (0.08 + hash(k + 1) * 0.12), h = box.size * (0.035 + hash(k + 2) * 0.07);
      var x = 0, y = 0, found = false;
      for (var tries = 0; tries < 6 && !found; tries++) {
        x = box.x + Math.min(box.size - w, box.size * (0.06 + hash(k + 3 + tries * 2) * 0.8));
        y = box.y + Math.min(box.size - h, box.size * (0.06 + hash(k + 4 + tries * 2) * 0.8));
        found = !onFigure || onFigure(x + w / 2, y + h / 2);
      }
      if (!found) continue;
      var dx = (hash(k + 5) < 0.5 ? -1 : 1) * box.size * (0.025 + hash(k + 6) * 0.06);
      var dy = (hash(k + 7) - 0.5) * box.size * 0.016;
      tiles.push([x, y, w, h, dx, dy]);
    }
    return tiles;
  }

  // Place the figure's bounds (figure units) centred in a square box of `size` px, leaving `pad` px.
  function fit(bounds, size, pad) {
    var w = bounds[2] - bounds[0], h = bounds[3] - bounds[1];
    var scale = (size - 2 * pad) / Math.max(w, h);
    return {
      scale: scale,
      x: (size - w * scale) / 2 - bounds[0] * scale,
      y: (size - h * scale) / 2 - bounds[1] * scale
    };
  }

  // The ring text: every name once per lap, separated by a middle dot, repeated to fill the circumference.
  function ringText(words, circumference, advance) {
    var lap = words.join(" · ") + " · ";
    var reps = Math.max(1, Math.round(circumference / (lap.length * advance)));
    var glyphs = [], owner = [];
    for (var r = 0; r < reps; r++) {
      var w = 0;
      for (var i = 0; i < lap.length; i++) {
        var ch = lap.charAt(i);
        glyphs.push(ch);
        owner.push(ch === " " || ch === "·" ? -1 : w);
        if (ch === "·") w++;
      }
    }
    return { glyphs: glyphs, owner: owner, reps: reps };
  }

  // Rotate a point by yaw (around y) then pitch (around x). Points use y up, z towards the viewer.
  function rotate(p, yaw, pitch) {
    var cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
    var y = p[1] * cp - z * sp;
    z = p[1] * sp + z * cp;
    return [x, y, z];
  }

  var FOCAL = 3.2;
  // Depth of the figure in figure units (its width is 1): the vertex shader and the normals share it.
  var RELIEF = 0.34;
  function project(p) {
    var k = FOCAL / (FOCAL - p[2]);
    return [p[0] * k, p[1] * k, k];
  }

  /* ── shaders ──────────────────────────────────────────── */

  var VERT = [
    "#version 300 es",
    "precision highp float;",
    "layout(location = 0) in vec4 a_p;",
    "layout(location = 1) in vec2 a_n;",
    "uniform vec2 u_res;",
    "uniform vec3 u_box;",
    "uniform vec2 u_pivot;",
    "uniform float u_depth;",
    "uniform vec2 u_rot;",
    "uniform float u_time;",
    "uniform float u_build;",
    "uniform vec4 u_pointer;",
    "uniform vec4 u_rip[4];",
    "uniform float u_blink;",
    "uniform float u_beat;",
    "uniform float u_dot;",
    "uniform float u_dpr;",
    "uniform float u_glitch;",
    "uniform vec4 u_tile[3];",
    "uniform vec2 u_shift[3];",
    "uniform vec2 u_offset;",
    "uniform float u_alpha;",
    "out float v_alpha;",
    "out float v_size;",
    "out float v_hot;",
    "uint h(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }",
    "float r01(uint x) { return float(h(x)) / 4294967296.0; }",
    "void main() {",
    "  uint id = uint(gl_VertexID);",
    "  float s1 = r01(id * 3u + 1u), s2 = r01(id * 3u + 2u), s3 = r01(id * 3u + 3u);",
    "  vec3 p = vec3(a_p.x - u_pivot.x, u_pivot.y - a_p.y, (a_p.z - 0.62) * u_depth);",
    // assemble from a scattered shell, centre first
    "  float reach = length(p.xy);",
    "  float k = clamp((u_build - 0.15 - reach * 0.9 - s3 * 0.35) / 0.9, 0.0, 1.0);",
    "  k = 1.0 - pow(1.0 - k, 4.0);",
    "  float th = s1 * 6.2831853, ph = acos(2.0 * s2 - 1.0);",
    "  vec3 shell = vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th)) * (0.9 + s3 * 0.6);",
    "  p = mix(shell, p, k);",
    // yaw then pitch, for the point and for its surface normal
    "  float cy = cos(u_rot.x), sy = sin(u_rot.x), cp = cos(u_rot.y), sp = sin(u_rot.y);",
    "  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);",
    "  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);",
    "  vec3 n = vec3(a_n, sqrt(max(0.0, 1.0 - dot(a_n, a_n))));",
    "  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);",
    "  n = vec3(n.x, n.y * cp - n.z * sp, n.y * sp + n.z * cp);",
    // light from the upper left, in front: lit stone gets sparser, smaller dots; grazing edges get heavier ones
    "  float lam = max(0.0, dot(n, normalize(vec3(-0.45, 0.6, 0.66))));",
    "  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);",
    "  float persp = 3.2 / (3.2 - p.z);",
    "  vec2 px = u_box.xy + (u_pivot + vec2(p.x, -p.y) * persp) * u_box.z;",
    // cursor push
    "  vec2 d = px - u_pointer.xy;",
    "  float dist = length(d) + 0.001;",
    "  float push = pow(max(0.0, 1.0 - dist / u_pointer.w), 2.0) * u_pointer.z;",
    "  px += d / dist * push * 22.0;",
    "  float lift = push;",
    // click ripples
    "  for (int i = 0; i < 4; i++) {",
    "    vec4 r = u_rip[i];",
    "    float age = u_time - r.z;",
    "    if (r.w <= 0.0 || age < 0.0 || age > 1.3) continue;",
    "    vec2 e = px - r.xy;",
    "    float de = length(e) + 0.001;",
    "    float band = (de - age * 900.0) / 46.0;",
    "    float g = exp(-band * band) * (1.0 - age / 1.3) * r.w;",
    "    px += e / de * g * 16.0;",
    "    lift += g * 0.8;",
    "  }",
    // Gear Two glitch: shift horizontal slices, and tear out tiles that jump sideways and run hot
    "  float hot = 0.0;",
    "  if (u_glitch > 0.0) {",
    "    uint slice = uint(floor(px.y / 18.0 + 64.0));",
    "    uint frame = uint(floor(u_time * 24.0));",
    "    if (r01(slice * 31u + frame * 977u) < 0.35 * u_glitch) px.x += (r01(slice + frame * 13u) - 0.5) * 48.0 * u_glitch;",
    "    for (int i = 0; i < 3; i++) {",
    "      vec4 tl = u_tile[i];",
    "      if (tl.z > 0.0 && px.x >= tl.x && px.x <= tl.x + tl.z && px.y >= tl.y && px.y <= tl.y + tl.w) { px += u_shift[i]; hot = 0.55; }",
    "    }",
    "  }",
    // Gear Two heartbeat: a few dots run white-hot at each beat
    "  if (u_beat > 0.45 && r01(id * 5u + 3u) < 0.035) hot = max(hot, u_beat);",
    "  px += u_offset;",
    // blink
    "  float period = 3.2 / u_blink;",
    "  float phase = u_time / period + r01(id * 3u + 7u);",
    "  float cycle = floor(phase);",
    "  float local = (phase - cycle) * period;",
    "  uint key = id * 7919u + uint(cycle) * 104729u;",
    "  bool off = r01(key) < 0.32;",
    "  float start = r01(key + 1u) * (period - 0.24);",
    "  float dur = 0.08 + r01(key + 2u) * 0.16;",
    "  off = off && local >= start && local < start + dur && u_blink > 0.0;",
    "  float size = u_dot * (0.78 + 0.5 * a_p.w) * persp * persp * (1.0 + 0.3 * u_beat) * (1.0 + 0.6 * lift);",
    "  size *= mix(1.12, 0.84, lam) * (1.0 + 0.18 * rim);",
    "  size = mix(size * 0.7, size, k);",
    "  v_alpha = (0.62 + 0.38 * smoothstep(-0.25, 0.2, p.z)) * mix(1.0, 0.86, lam) * mix(0.0, 1.0, smoothstep(0.0, 0.25, k)) * u_alpha;",
    "  if (off) v_alpha = 0.0;",
    "  v_hot = hot;",
    "  v_size = size * u_dpr;",
    "  gl_PointSize = v_size;",
    "  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    "#version 300 es",
    "precision mediump float;",
    "in float v_alpha;",
    "in float v_size;",
    "in float v_hot;",
    "uniform vec3 u_color;",
    "out vec4 o;",
    "void main() {",
    "  float d = length(gl_PointCoord - 0.5) * v_size;",
    "  float a = clamp(v_size * 0.5 - d + 0.5, 0.0, 1.0) * v_alpha;",
    "  if (a <= 0.0) discard;",
    "  o = vec4(mix(u_color, vec3(1.0, 0.93, 0.9), v_hot * 0.9) * a, a);",
    "}"
  ].join("\n");

  /* ── engine ───────────────────────────────────────────── */

  function readColors() {
    var s = getComputedStyle(document.documentElement);
    var get = function (name) { return s.getPropertyValue(name).trim(); };
    return { ink: get("--figure-ink"), accent: get("--accent"), paper: get("--paper"), text: get("--ink"), gear: document.documentElement.getAttribute("data-gear") === "two" };
  }

  function rgb(css) {
    var probe = rgb.ctx || (rgb.ctx = document.createElement("canvas").getContext("2d"));
    probe.fillStyle = "#000";
    probe.fillStyle = css;
    var v = probe.fillStyle;
    if (v.charAt(0) === "#") return [parseInt(v.slice(1, 3), 16) / 255, parseInt(v.slice(3, 5), 16) / 255, parseInt(v.slice(5, 7), 16) / 255];
    var m = v.match(/[\d.]+/g) || [0, 0, 0];
    return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  function loadImageData(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error("hero data " + r.status);
      return r.blob();
    }).then(function (blob) {
      return createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
    }).then(function (bmp) {
      var c = document.createElement("canvas");
      c.width = bmp.width;
      c.height = bmp.height;
      var ctx = c.getContext("2d", { willReadFrequently: true });
      try {
        ctx.drawImage(bmp, 0, 0);
        return { width: bmp.width, height: bmp.height, data: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
      } finally { bmp.close(); }
    });
  }

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    if (!sh) throw new Error("hero shader unavailable");
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var error = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(error || "hero shader failed");
    }
    return sh;
  }

  function mount(el, opts) {
    var motion = opts.motion || { reduced: function () { return false; }, subscribe: function () {} };
    var base = opts.base || "/assets/hero/";
    var words = opts.words || [];
    var canvas = document.createElement("canvas");
    var overlay = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    canvas.className = "hero-dots";
    overlay.className = "hero-words";
    var gl = null, ctx = null;
    try {
      gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
      ctx = overlay.getContext("2d");
    } catch (e) {}
    if (!gl || !ctx) {
      el.classList.remove("is-live");
      el.classList.add("is-fallback");
      return { highlight: function () {}, count: function () { return 0; }, ripple: function () {} };
    }
    el.appendChild(canvas);
    el.appendChild(overlay);

    var prog = null, vao = null, vbo = null, query = null, U = {}, queryPending = false, rendered = false, drawChecked = false;
    var maps = null, noise = null, meta = null, points = null, vertices = null, count = 0, res = 0;
    var cssW = 0, cssH = 0, dpr = 1, box = { x: 0, y: 0, size: 0 }, place = null, cell = 1;
    var colors = readColors();
    var inkNow = rgb(colors.ink), inkFrom = inkNow, inkTo = inkNow, inkAt = 0;
    var yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, pushK = { x: 0, v: 0 };
    var pointer = { x: -1e4, y: -1e4, inside: false, tx: 0, ty: 0 };
    var touch = null;
    var ripples = [[0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0]], nextRipple = 0;
    var ripFlat = new Float32Array(16);
    var startAt = 0, last = 0, raf = 0, visible = false, ready = false, clock = 0, spin = 0;
    var ring = null, ringFont = 0, fontReady = false, highlighted = null;
    var glitchUntil = 0, resizeTimer = 0, tiles = [], tileFlat = new Float32Array(12), shiftFlat = new Float32Array(6);
    var cpuMs = 0, telemetryAt = 0;

    function releaseTouch(event, cancelled) {
      if (!touch || (event && event.pointerId !== touch.id)) return;
      var id = touch.id;
      if (cancelled) touch.ripple[3] = 0;
      touch = null;
      pointer.tx = pointer.ty = 0;
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }

    function cancelInteractions() {
      releaseTouch(null, true);
      pointer.inside = false;
      pointer.x = pointer.y = -1e4;
      pointer.tx = pointer.ty = 0;
      pushK.x = pushK.v = yaw.v = pitch.v = 0;
      for (var i = 0; i < ripples.length; i++) ripples[i][3] = 0;
      glitchUntil = 0;
      tiles = [];
    }

    function fallback() {
      ready = rendered = queryPending = drawChecked = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      raf = last = 0;
      cancelInteractions();
      if (prog) gl.deleteProgram(prog);
      if (vao) gl.deleteVertexArray(vao);
      if (vbo) gl.deleteBuffer(vbo);
      if (query) gl.deleteQuery(query);
      prog = vao = vbo = query = null;
      U = {};
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      el.classList.remove("is-live");
      el.classList.add("is-fallback");
    }

    function initialize() {
      if (prog || !meta || gl.isContextLost()) return;
      var vert = null, frag = null;
      try {
        prog = gl.createProgram();
        if (!prog) throw new Error("hero program unavailable");
        vert = compile(gl, gl.VERTEX_SHADER, VERT);
        frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
        gl.attachShader(prog, vert);
        gl.attachShader(prog, frag);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        ["u_res", "u_box", "u_pivot", "u_depth", "u_rot", "u_time", "u_build", "u_pointer", "u_rip", "u_blink", "u_beat", "u_dot", "u_dpr", "u_glitch", "u_tile", "u_shift", "u_offset", "u_alpha", "u_color"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
        vao = gl.createVertexArray();
        vbo = gl.createBuffer();
        query = gl.createQuery();
        if (!vao || !vbo || !query) throw new Error("hero buffers unavailable");
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        ready = size();
        if (ready && !startAt) startAt = performance.now();
        sync();
      } catch (e) { fallback(); }
      finally {
        if (vert) gl.deleteShader(vert);
        if (frag) gl.deleteShader(frag);
      }
    }

    function reveal() {
      if (rendered || !queryPending || !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) return;
      queryPending = false;
      if (!gl.getQueryParameter(query, gl.QUERY_RESULT)) {
        if (motion.reduced()) fallback();
        return;
      }
      rendered = true;
      el.classList.remove("is-fallback");
      el.classList.add("is-live");
    }

    function size() {
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width), h = Math.round(rect.height);
      if (!w || !h) return false;
      var pad = Math.round(Math.max(w, h) * 0.18);
      cssW = w + pad * 2;
      cssH = h + pad * 2;
      dpr = Math.min(2, global.devicePixelRatio || 1);
      [canvas, overlay].forEach(function (c) {
        c.width = Math.round(cssW * dpr);
        c.height = Math.round(cssH * dpr);
        c.style.left = c.style.top = -pad + "px";
        c.style.width = cssW + "px";
        c.style.height = cssH + "px";
      });
      var s = Math.min(w, h);
      box = { x: pad + (w - s) / 2, y: pad + (h - s) / 2, size: s };
      place = fit(meta.bounds, s, s * 0.02);
      gl.viewport(0, 0, canvas.width, canvas.height);
      var want = resolutionFor(place.scale);
      if (want !== res) {
        res = want;
        points = stipple(maps.data, maps.width, noise.data, noise.width, res, meta.density, 0.7);
        count = points.length / 4;
        var normals = depthNormals(maps.data, maps.width, points, RELIEF);
        vertices = new Float32Array(count * 6);
        for (var i = 0; i < count; i++) {
          vertices.set(points.subarray(i * 4, i * 4 + 4), i * 6);
          vertices[i * 6 + 4] = normals[i * 2];
          vertices[i * 6 + 5] = normals[i * 2 + 1];
        }
        if (opts.onCount) opts.onCount(count);
      }
      if (!count) throw new Error("hero data is empty");
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      drawChecked = false;
      cell = place.scale / res;
      ringFont = clamp(Math.round(s / 56), 10, 12);
      ring = null;
      return true;
    }

    function setPointer(event) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      var er = el.getBoundingClientRect();
      pointer.tx = clamp((event.clientX - er.left) / er.width - 0.5, -0.6, 0.6);
      pointer.ty = clamp((event.clientY - er.top) / er.height - 0.5, -0.6, 0.6);
    }

    function figurePx(fx, fy) { return [box.x + place.x + fx * place.scale, box.y + place.y + fy * place.scale]; }

    function maskAt(sx, sy) {
      var u = (sx - box.x - place.x) / place.scale, v = (sy - box.y - place.y) / place.scale;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) return 0;
      var n = maps.width, i = (Math.floor(v * n) * n + Math.floor(u * n)) * 4;
      return maps.data[i + 2] / 255;
    }

    // Gear Two glitch tiles on the overlay: a thin accent frame around each torn-out block, drawn where it lands.
    function drawTiles() {
      if (!tiles.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineWidth = 1;
      ctx.strokeStyle = colors.accent;
      ctx.fillStyle = colors.accent;
      for (var i = 0; i < tiles.length; i++) {
        var tl = tiles[i];
        var x = Math.round(tl[0] + tl[4]) + 0.5, y = Math.round(tl[1] + tl[5]) + 0.5, w = Math.round(tl[2]), h = Math.round(tl[3]);
        ctx.globalAlpha = 0.08;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawRing(t, yawNow, pitchNow, fade, beat) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      drawTiles();
      if (!fontReady || fade <= 0.01 || !words.length) return;
      var spec = meta.ring || {};
      // the ring breathes with the Gear Two heartbeat
      var R = (spec.r || 0.42) * (1 + 0.02 * beat), tilt = spec.tilt == null ? 0.3 : spec.tilt;
      var pivot = [spec.x == null ? meta.center[0] : spec.x, spec.y == null ? meta.center[1] : spec.y];
      var pc = figurePx(pivot[0], pivot[1]);
      var Rpx = (spec.r || 0.42) * place.scale;
      var font = ringFont;
      ctx.font = "400 " + font + "px \"Fragment Mono\", ui-monospace, monospace";
      var advance = ctx.measureText("M").width * 1.32;
      if (!ring) ring = ringText(words, TAU * Rpx, advance);
      var n = ring.glyphs.length;
      var accent = colors.gear ? colors.text : colors.accent;
      var muted = colors.text;
      var ct = Math.cos(tilt), st = Math.sin(tilt);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(3, font * 0.42);
      ctx.strokeStyle = colors.paper;
      for (var i = 0; i < n; i++) {
        var ch = ring.glyphs[i];
        if (ch === " ") continue;
        var a = spin - (i / n) * TAU;
        var ca = Math.cos(a), sa = Math.sin(a);
        // ring point and reading direction in figure units (y up), tilted around x
        var p = [R * ca, 0, R * sa];
        var tg = [sa, 0, -ca];
        var up = [0, 1, 0];
        p = [p[0], p[1] * ct - p[2] * st, p[1] * st + p[2] * ct];
        tg = [tg[0], tg[1] * ct - tg[2] * st, tg[1] * st + tg[2] * ct];
        up = [up[0], up[1] * ct - up[2] * st, up[1] * st + up[2] * ct];
        var nrm = [ca, 0, sa];
        nrm = [nrm[0], nrm[1] * ct - nrm[2] * st, nrm[1] * st + nrm[2] * ct];
        p = rotate(p, yawNow, pitchNow);
        tg = rotate(tg, yawNow, pitchNow);
        up = rotate(up, yawNow, pitchNow);
        nrm = rotate(nrm, yawNow, pitchNow);
        var pr = project(p);
        var sx = pc[0] + pr[0] * place.scale, sy = pc[1] - pr[1] * place.scale;
        var front = nrm[2] > 0;
        var facing = Math.abs(nrm[2]);
        if (!front && maskAt(sx, sy) > 0.3) continue;
        var owner = ring.owner[i];
        var lit = highlighted && owner >= 0 && highlighted.indexOf(words[owner]) >= 0;
        var dim = highlighted && !lit;
        var alpha = (front ? 1 : 0.3) * fade * (dim ? 0.3 : 1) * (0.35 + 0.65 * Math.pow(facing, 0.6));
        if (alpha < 0.02) continue;
        var k = pr[2];
        var tx = tg[0] * k, ty = -tg[1] * k, ux = -up[0] * k, uy = up[1] * k;
        ctx.setTransform(tx * dpr, ty * dpr, ux * dpr, uy * dpr, sx * dpr, sy * dpr);
        ctx.globalAlpha = alpha;
        if (front) ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = dim ? muted : accent;
        ctx.fillText(ch, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function frame(now) {
      raf = 0;
      if (!ready || !visible || document.hidden) return;
      if (gl.isContextLost()) { fallback(); return; }
      if (motion.reduced()) {
        reveal();
        if (queryPending) raf = requestAnimationFrame(frame);
        return;
      }
      render(now);
      if (ready) raf = requestAnimationFrame(frame);
    }

    function render(now) {
      if (gl.isContextLost()) { fallback(); return; }
      reveal();
      if (!ready) return;
      var began = performance.now();
      var live = !motion.reduced();
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var gear = colors.gear;
      if (live) clock += dt * (gear ? 1.6 : 1);
      var t = live ? now / 1000 : 0;
      var built = live ? (now - startAt) / 1000 : 99;
      var swayYaw = live ? 0.28 * Math.sin((TAU * clock) / 14) : 0.12;
      var swayPitch = live ? 0.07 * Math.sin((TAU * clock) / 19 + 1) : 0.02;
      var tilt = pointer.inside || (touch && touch.dragging);
      if (live) {
        spring(yaw, swayYaw + (tilt ? pointer.tx * 0.5 : 0), dt, 3.2);
        spring(pitch, swayPitch - (tilt ? pointer.ty * 0.25 : 0), dt, 3.2);
        spring(pushK, pointer.inside ? 1 : 0, dt, 9);
        spin += dt * (gear ? 0.32 : 0.11);
      } else {
        yaw.x = swayYaw;
        pitch.x = swayPitch;
        yaw.v = pitch.v = pushK.x = pushK.v = 0;
      }
      if (inkAt) {
        var q = clamp((now - inkAt) / 320, 0, 1);
        inkNow = [0, 1, 2].map(function (c) { return inkFrom[c] + (inkTo[c] - inkFrom[c]) * q; });
        if (q >= 1) inkAt = 0;
      }
      for (var i = 0; i < 4; i++) {
        ripFlat[i * 4] = ripples[i][0];
        ripFlat[i * 4 + 1] = ripples[i][1];
        ripFlat[i * 4 + 2] = ripples[i][2];
        ripFlat[i * 4 + 3] = live ? ripples[i][3] : 0;
      }
      var beat = gear && live ? heartbeat(t) : 0;
      var glitch = live && now < glitchUntil ? 1 : 0;
      tiles = glitch ? glitchTiles(Math.floor(t * 24), box, 3, function (x, y) { return maskAt(x, y) > 0.2; }) : [];
      tileFlat.fill(0);
      shiftFlat.fill(0);
      for (var j = 0; j < tiles.length; j++) {
        tileFlat.set(tiles[j].slice(0, 4), j * 4);
        shiftFlat[j * 2] = tiles[j][4];
        shiftFlat[j * 2 + 1] = tiles[j][5];
      }
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.u_res, cssW, cssH);
      gl.uniform3f(U.u_box, box.x + place.x, box.y + place.y, place.scale);
      gl.uniform2f(U.u_pivot, meta.center[0], meta.center[1]);
      gl.uniform1f(U.u_depth, RELIEF);
      gl.uniform2f(U.u_rot, yaw.x, pitch.x);
      gl.uniform1f(U.u_time, t);
      gl.uniform1f(U.u_build, built);
      gl.uniform4f(U.u_pointer, pointer.x, pointer.y, pushK.x * (gear ? 1.5 : 1), Math.max(70, box.size * 0.13));
      gl.uniform4fv(U.u_rip, ripFlat);
      gl.uniform1f(U.u_blink, live ? (gear ? 2 : 1) : 0);
      gl.uniform1f(U.u_beat, beat);
      gl.uniform1f(U.u_dot, Math.max(1.1, cell * 1.3));
      gl.uniform1f(U.u_dpr, dpr);
      gl.uniform1f(U.u_glitch, glitch);
      gl.uniform4fv(U.u_tile, tileFlat);
      gl.uniform2fv(U.u_shift, shiftFlat);
      gl.uniform3f(U.u_color, inkNow[0], inkNow[1], inkNow[2]);
      gl.bindVertexArray(vao);
      // while glitching, two faint afterimages sit 2 px either side of the figure
      if (glitch) {
        gl.uniform1f(U.u_alpha, 0.3);
        gl.uniform2f(U.u_offset, -2, 0);
        gl.drawArrays(gl.POINTS, 0, count);
        gl.uniform2f(U.u_offset, 2, 0);
        gl.drawArrays(gl.POINTS, 0, count);
      }
      gl.uniform1f(U.u_alpha, 1);
      gl.uniform2f(U.u_offset, 0, 0);
      var measure = !rendered && !queryPending;
      if (measure) gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
      gl.drawArrays(gl.POINTS, 0, count);
      if (measure) { gl.endQuery(gl.ANY_SAMPLES_PASSED); queryPending = true; }
      var fade = live ? smoothstep(1.2, 1.9, built) : 1;
      drawRing(t, yaw.x, pitch.x, fade, beat);
      if (!drawChecked) {
        drawChecked = true;
        if (gl.getError() !== gl.NO_ERROR) fallback();
      }
      cpuMs += (performance.now() - began - cpuMs) * 0.1;
      if (opts.onTelemetry && (now - telemetryAt > 150 || !live)) {
        telemetryAt = now;
        opts.onTelemetry({ yaw: yaw.x, pitch: pitch.x, ms: cpuMs, dots: count, gear: gear, live: live });
      }
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (motion.reduced() || !visible || document.hidden) cancelInteractions();
      if (!ready || !visible || document.hidden) return;
      if (motion.reduced()) {
        inkNow = rgb(colors.ink);
        inkAt = 0;
        render(performance.now());
        if (queryPending) raf = requestAnimationFrame(frame);
        return;
      }
      raf = requestAnimationFrame(frame);
    }

    function onTheme() {
      var was = colors;
      colors = readColors();
      var next = rgb(colors.ink);
      if (motion.reduced() || !ready) { inkNow = next; inkAt = 0; }
      else if (next.join() !== inkNow.join()) { inkFrom = inkNow; inkTo = next; inkAt = performance.now(); }
      var phase = document.documentElement.getAttribute("data-phase");
      if (phase === "glitch" || phase === "flash") glitchUntil = performance.now() + 520;
      // leaving Gear Two: the tearing stops just after the palette comes back
      if (was.gear && !colors.gear) glitchUntil = Math.min(glitchUntil, performance.now() + 140);
      if (was.gear !== colors.gear) ring = null;
      // the palette turning red rolls through the figure as a ripple from its centre
      if (!was.gear && colors.gear && canInteract()) ripple(box.x + box.size / 2, box.y + box.size / 2);
      sync();
    }

    function canInteract() { return ready && visible && !document.hidden && !motion.reduced(); }

    function ripple(x, y) {
      var wave = [x, y, performance.now() / 1000, colors.gear ? 1.4 : 1];
      ripples[nextRipple] = wave;
      nextRipple = (nextRipple + 1) % 4;
      return wave;
    }

    el.addEventListener("pointermove", function (e) {
      if (!canInteract()) return;
      if (e.pointerType === "touch") {
        if (!touch || e.pointerId !== touch.id) return;
        var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
        if (!touch.dragging) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
          if (Math.abs(dy) >= Math.abs(dx)) { releaseTouch(e, true); return; }
          touch.dragging = true;
          el.setPointerCapture(e.pointerId);
        }
        var rect = el.getBoundingClientRect();
        pointer.tx = clamp(dx / rect.width, -0.45, 0.45);
        pointer.ty = clamp(dy / rect.height, -0.16, 0.16);
        return;
      }
      if (touch) return;
      pointer.inside = true;
      setPointer(e);
    });
    el.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") {
        if (!el.hasPointerCapture(e.pointerId)) releaseTouch(e, true);
      } else pointer.inside = false;
    });
    el.addEventListener("pointerdown", function (e) {
      if (!canInteract() || touch || (e.pointerType === "touch" && !e.isPrimary)) return;
      setPointer(e);
      var wave = ripple(pointer.x, pointer.y);
      if (e.pointerType === "touch") {
        pointer.inside = false;
        pointer.tx = pointer.ty = pushK.x = pushK.v = 0;
        touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false, ripple: wave };
      } else pointer.inside = true;
    });
    el.addEventListener("pointerup", function (e) { releaseTouch(e, false); });
    el.addEventListener("pointercancel", function (e) { releaseTouch(e, true); pointer.inside = false; });
    el.addEventListener("lostpointercapture", function (e) { releaseTouch(e, true); });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); fallback(); });
    canvas.addEventListener("webglcontextrestored", initialize);
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-gear", "data-phase"] });
    var mq = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) mq.addEventListener("change", onTheme);
    motion.subscribe(sync);
    document.addEventListener("visibilitychange", sync);
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }).observe(el);
    new ResizeObserver(function () {
      if (!prog || !meta || gl.isContextLost()) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (!prog || gl.isContextLost()) return;
        try {
          ready = size();
          if (ready && !startAt) startAt = performance.now();
          sync();
        } catch (e) { fallback(); }
      }, 120);
    }).observe(el);

    if (document.fonts && document.fonts.load) {
      var onFont = function () { fontReady = true; ring = null; sync(); };
      document.fonts.load("400 11px \"Fragment Mono\"").then(onFont, onFont);
    } else fontReady = true;

    Promise.all([
      loadImageData(base + "data.png"),
      loadImageData(base + "bluenoise.png"),
      fetch(base + "hero.json").then(function (r) {
        if (!r.ok) throw new Error("hero metadata " + r.status);
        return r.json();
      })
    ]).then(function (all) {
      if (all[0].width < 2 || all[0].width !== all[0].height || all[1].width !== all[1].height) throw new Error("hero maps must be square");
      var data = all[2];
      var normalized = function (n) { return Number.isFinite(n) && n >= 0 && n <= 1; };
      if (!data || data.size !== all[0].width || !Array.isArray(data.bounds) || data.bounds.length !== 4 || !data.bounds.every(normalized) ||
          data.bounds[2] <= data.bounds[0] || data.bounds[3] <= data.bounds[1] ||
          !Array.isArray(data.center) || data.center.length !== 2 || !data.center.every(normalized) ||
          !normalized(data.density) || data.density <= 0) throw new Error("hero metadata is invalid");
      maps = all[0];
      noise = { width: all[1].width, data: (function () { var d = all[1].data, o = new Uint8Array(d.length / 4); for (var i = 0; i < o.length; i++) o[i] = d[i * 4]; return o; })() };
      meta = data;
      initialize();
    }).catch(fallback);

    return {
      highlight: function (list) { highlighted = list && list.length ? list : null; if (motion.reduced()) sync(); },
      count: function () { return count; },
      ripple: function () { if (canInteract()) ripple(box.x + box.size / 2, box.y + box.size / 2); }
    };
  }

  var api = {
    mount: mount,
    clamp: clamp,
    smoothstep: smoothstep,
    hash: hash,
    heartbeat: heartbeat,
    spring: spring,
    rippleWeight: rippleWeight,
    blinkOff: blinkOff,
    stipple: stipple,
    depthNormals: depthNormals,
    glitchTiles: glitchTiles,
    resolutionFor: resolutionFor,
    fit: fit,
    ringText: ringText,
    rotate: rotate,
    project: project
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SkyHero = api;
})(typeof window !== "undefined" ? window : globalThis);
