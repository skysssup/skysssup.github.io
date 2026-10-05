/* Hero: the GitHub avatar as a stippled sculpture in WebGL2, wrapped in a ring that carries one line in its voice.
   Data comes from tools/hero/build.py (depth, ink, light, and color maps plus a blue-noise threshold tile).
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

  // Gear Two's tears, one plan per heartbeat (beats are numbered on the heartbeat's clock, seconds / 0.9).
  // Each block of seven beats (6.3 s) gives its third, fourth, or fifth beat a long tear: 8 frames at 24 fps,
  // 3 tiles, one afterimage. About 35% of the other beats get a short one: 2-4 frames, 1-2 tiles. Every tear
  // starts at its beat's first peak. Returns null for a clean beat; the same beat always gets the same plan.
  var BEAT = 0.9, TEAR_AT = 0.072, TEAR_BLOCK = 7, TEAR_CHANCE = 0.35;
  function longTearBeat(block) { return block * TEAR_BLOCK + 2 + Math.floor(hash(block * 7 + 101) * 3); }
  function tearSchedule(beat) {
    if (beat === longTearBeat(Math.floor(beat / TEAR_BLOCK))) return { frames: 8, tiles: 3, glitch: 0.8, after: true, long: true };
    if (hash(beat * 5 + 3) >= TEAR_CHANCE) return null;
    return { frames: 2 + Math.floor(hash(beat * 5 + 4) * 3), tiles: hash(beat * 5 + 5) < 0.5 ? 1 : 2, glitch: 0.6, after: false, long: false };
  }

  // The base sway: ±16° of yaw over 14 s on the sway clock (which runs 1.6× in Gear Two).
  var SWAY = 14;
  function sway(clock) { return 0.28 * Math.sin((TAU * clock) / SWAY); }

  // When the light sweeps the figure: once as the assembly finishes, then at every turn of the sway (where its
  // yaw peaks and the turn reverses, every 7 s on alternating sides). Returns the latest trigger at or before
  // `clock`: its number (-1 before the first), its time on the sway clock, and the direction the band travels
  // (+1 left to right, the way the figure was turning). The first turn sweeps left to right, so the assembly's
  // sweep runs the other way and the directions alternate from the start.
  // A sheen lasts its sweep and SHEEN_AFTER more seconds, while the bits it carried off turn to crystal and the
  // dots they left re-form.
  var SHEEN_FIRST = 1.9, SHEEN_SWEEP = 1.1, SHEEN_AFTER = 2.3;
  // When the paper turns between light and dark, the band of light that swaps the dots of one map for the other's
  // takes SWAP seconds to cross the figure.
  var SWAP = 1.1;
  function sheenPhase(clock) {
    if (!(clock >= SHEEN_FIRST)) return { index: -1, at: 0, dir: 0 };
    var turns = Math.floor((clock - SWAY / 4) / (SWAY / 2)) + 1;
    if (turns < 1) return { index: 0, at: SHEEN_FIRST, dir: -1 };
    var at = SWAY / 4 + (turns - 1) * (SWAY / 2);
    return { index: turns, at: at, dir: sway(at) > 0 ? 1 : -1 };
  }

  // --ease-in-out, cubic-bezier(.65, 0, .35, 1), which is the cubic in-out curve.
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(2 - 2 * x, 3) / 2; }

  // The opening, when the page is opened (opts.intro), in seconds: the figure holds still in its ink for `hold`; a
  // slower shine crosses it and leaves its colors in its wake; the sway runs `rate` times as fast until the figure has
  // turned once and come back to the middle (half a sway on its clock). From light or dark paper the page then goes
  // to Gear Two; as the switch settles a shine crosses the red figure, the figure turns once more the other way at
  // `redRate`, and the page comes back. `wait` bounds each wait for the page to switch.
  var INTRO = { hold: 2, sweep: 1.4, rate: 2.5, red: 0.55, redRate: 3.2, wait: 2 };
  var INTRO_RATE = { hold: 0, shine: 0, turn: INTRO.rate, red: 0, redshine: 0, redturn: INTRO.redRate, back: 0 };
  // One step of the opening at `now` (s) with the sway clock at `clock` and Gear Two on or off. Returns the next
  // state (null once it is over), the clock (held in the middle at each return), and what happens now, if anything:
  // "shine" (the opening's, right to left, colors in its wake), "ring" (the ring fades in), "red" (go to Gear Two),
  // "redshine" (left to right), or "back" (leave Gear Two).
  function introStep(state, now, clock, gear) {
    var age = now - state.at, to = function (stage, act, held) {
      return { state: stage ? { stage: stage, at: now, redAt: null } : null, clock: held == null ? clock : held, act: act || null };
    };
    if (state.stage === "hold" && age >= INTRO.hold) return to("shine", "shine");
    if (state.stage === "shine" && age >= INTRO.sweep) return to("turn", "ring");
    if (state.stage === "turn" && clock >= SWAY / 2) return gear ? to(null, null, SWAY / 2) : to("red", "red", SWAY / 2);
    if (state.stage === "red") {
      var on = state.redAt != null ? state.redAt : gear ? now : null;
      if (on != null && now - on >= INTRO.red) return to("redshine", "redshine");
      if (on == null && age > INTRO.wait) return to(null);
      if (on !== state.redAt) return { state: { stage: "red", at: state.at, redAt: on }, clock: clock, act: null };
    }
    if (state.stage === "redshine" && age >= SHEEN_SWEEP) return to("redturn");
    if (state.stage === "redturn" && clock >= SWAY) return to("back", "back", SWAY);
    if (state.stage === "back" && (!gear || age > INTRO.wait)) return to(null);
    return { state: state, clock: clock, act: null };
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

  // The face and the hands are stippled on a grid twice as fine, with smaller dots, inside soft ellipses listed in
  // hero.json as `fine` ([x, y, rx, ry, turn] in figure units and radians), on screens that have the pixels for it. The weight is 1 inside an
  // ellipse and falls to 0 over the outer 30% of its radius; a cell there splits with that probability, chosen
  // by a hash of the cell, so the finer texture fades in instead of starting at a seam.
  function fineWeight(zones, x, y) {
    var w = 0;
    for (var i = 0; zones && i < zones.length; i++) {
      var z = zones[i], dx = x - z[0], dy = y - z[1], r = Math.max(z[2], z[3]);
      if (dx > r || dx < -r || dy > r || dy < -r) continue;
      var c = Math.cos(z[4] || 0), s = Math.sin(z[4] || 0), u = (dx * c + dy * s) / z[2], v = (dy * c - dx * s) / z[3];
      w = Math.max(w, 1 - smoothstep(0.7, 1, Math.sqrt(u * u + v * v)));
    }
    return w;
  }
  function fineCell(zones, res, gx, gy) {
    var w = zones ? fineWeight(zones, (gx + 0.5) / res, (gy + 0.5) / res) : 0;
    return w > 0 && hash(gy * res + gx + 0x5bd1e995) < w;
  }

  // Threshold stippling: every cell of a res x res grid over the figure keeps a dot when its ink (green
  // channel, bilinear from the size x size map) beats the tiled blue-noise threshold; a cell in a fine zone is
  // four cells of a grid twice as fine, thresholded against the tile at that scale. Output is [x, y, ink] per
  // dot with x, y in figure units (0..1); a dot's cell, and so whether it is fine, is floor(x * res, y * res).
  // What else a dot carries is sampled from the other maps.
  function stipple(rgba, size, noise, noiseSize, res, density, jitter, zones) {
    var out = [];
    var keep = function (n, gx, gy) {
      var scale = (size - 1) / n, u = (gx + 0.5) * scale, v = (gy + 0.5) * scale;
      var i0 = Math.floor(v), fy = v - i0, i1 = Math.min(i0 + 1, size - 1);
      var j0 = Math.floor(u), fx = u - j0, j1 = Math.min(j0 + 1, size - 1);
      var a = (i0 * size + j0) * 4, b = (i0 * size + j1) * 4, c = (i1 * size + j0) * 4, d = (i1 * size + j1) * 4;
      var ink = (rgba[a + 1] * (1 - fx) * (1 - fy) + rgba[b + 1] * fx * (1 - fy) + rgba[c + 1] * (1 - fx) * fy + rgba[d + 1] * fx * fy) / 255;
      if (ink <= 0 || ink * density <= noise[(gy % noiseSize) * noiseSize + (gx % noiseSize)] / 255) return;
      var k = gy * n + gx;
      var jx = jitter ? (hash(k * 2 + 1) - 0.5) * jitter : 0;
      var jy = jitter ? (hash(k * 2 + 2) - 0.5) * jitter : 0;
      out.push((gx + 0.5 + jx) / n, (gy + 0.5 + jy) / n, ink);
    };
    for (var gy = 0; gy < res; gy++) {
      for (var gx = 0; gx < res; gx++) {
        if (!fineCell(zones, res, gx, gy)) { keep(res, gx, gy); continue; }
        for (var q = 0; q < 4; q++) keep(res * 2, gx * 2 + (q & 1), gy * 2 + (q >> 1));
      }
    }
    return new Float32Array(out);
  }

  // How far a dot is from the figure's edge along its row, to the right and to the left, in figure units: where a
  // bit carried off by the sheen leaves the figure and turns to crystal. Counted on the depth map's mask (red > 0)
  // at the nearest pixel, up to and including the last pixel inside. Output is [right, left] per dot.
  function edgeDistances(rgba, size, points, stride) {
    var n = points.length / stride, out = new Float32Array(n * 2), last = size - 1;
    var right = new Uint16Array(size * size), left = new Uint16Array(size * size), x, y, i, run;
    for (y = 0; y < size; y++) {
      for (run = 0, x = last; x >= 0; x--) { i = y * size + x; run = rgba[i * 4] > 0 ? run + 1 : 0; right[i] = run; }
      for (run = 0, x = 0; x <= last; x++) { i = y * size + x; run = rgba[i * 4] > 0 ? run + 1 : 0; left[i] = run; }
    }
    for (var k = 0; k < n; k++) {
      i = Math.round(clamp(points[k * stride + 1], 0, 1) * last) * size + Math.round(clamp(points[k * stride], 0, 1) * last);
      out[k * 2] = right[i] / last;
      out[k * 2 + 1] = left[i] / last;
    }
    return out;
  }

  // Grid resolution for a figure drawn `px` CSS pixels wide: a little over one cell per pixel, within limits.
  function resolutionFor(px) { return Math.round(clamp(px * 1.4, 320, 1200)); }

  // The depth map (red channel, 0 outside the figure) as a float field, smoothed inside the figure by a
  // Gaussian of `sigma` px normalised by how much of the kernel lies inside, so the sky never drags the
  // silhouette back. Smoothing removes the 8-bit steps that would otherwise terrace the normals into bands.
  // Pixels outside the figure are -1.
  function reliefField(rgba, size, sigma) {
    var n = size * size, val = new Float32Array(n), wgt = new Float32Array(n), out = new Float32Array(n);
    for (var i = 0; i < n; i++) if (rgba[i * 4] > 0) { val[i] = rgba[i * 4] / 255; wgt[i] = 1; }
    var r = Math.ceil(sigma * 3), kernel = [], sum = 0, j;
    for (j = -r; j <= r; j++) { kernel.push(sigma > 0 ? Math.exp(-j * j / (2 * sigma * sigma)) : j === 0 ? 1 : 0); sum += kernel[j + r]; }
    var pass = function (src, dst, along) {
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var acc = 0;
        for (j = -r; j <= r; j++) {
          var xx = along ? x + j : x, yy = along ? y : y + j;
          if (xx >= 0 && yy >= 0 && xx < size && yy < size) acc += src[yy * size + xx] * kernel[j + r];
        }
        dst[y * size + x] = acc / sum;
      }
    };
    var tv = new Float32Array(n), tw = new Float32Array(n), sv = new Float32Array(n), sw = new Float32Array(n);
    pass(val, tv, true); pass(tv, sv, false);
    pass(wgt, tw, true); pass(tw, sw, false);
    for (i = 0; i < n; i++) out[i] = wgt[i] ? sv[i] / sw[i] : -1;
    return out;
  }

  // A surface normal per dot from the relief field by central differences, one-sided at the figure's edge,
  // with the depth scaled to `relief` figure units like the vertex shader does, and each dot's depth from the
  // field (bilinear over the pixels inside the figure). `points` holds `stride` floats per dot, x and y first.
  // Output is [nx, ny, z] per dot, normals in world space (y up); the shader rebuilds nz = sqrt(1 - nx² - ny²).
  function depthNormals(field, size, points, stride, relief) {
    var n = points.length / stride, out = new Float32Array(n * 3), step = 2, last = size - 1;
    var depth = function (x, y) { return field[y * size + x]; };
    var inside = function (x, y) { return x >= 0 && y >= 0 && x <= last && y <= last && field[y * size + x] >= 0; };
    var slope = function (x, y, dx, dy) {
      var a = inside(x - dx, y - dy), b = inside(x + dx, y + dy);
      if (a && b) return (depth(x + dx, y + dy) - depth(x - dx, y - dy)) / (2 * step);
      if (b) return (depth(x + dx, y + dy) - depth(x, y)) / step;
      if (a) return (depth(x, y) - depth(x - dx, y - dy)) / step;
      return 0;
    };
    for (var i = 0; i < n; i++) {
      var u = clamp(points[i * stride] * last, 0, last), v = clamp(points[i * stride + 1] * last, 0, last);
      var x = Math.round(u), y = Math.round(v);
      var gx = slope(x, y, step, 0) * last * relief, gy = slope(x, y, 0, step) * last * relief;
      var nx = -gx, ny = gy, len = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= len;
      ny /= len;
      var tilt = Math.sqrt(nx * nx + ny * ny), limit = 0.94;
      if (tilt > limit) { nx *= limit / tilt; ny *= limit / tilt; }
      var x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0, z = 0, zw = 0;
      for (var c = 0; c < 4; c++) {
        var cx = Math.min(x0 + (c & 1), last), cy = Math.min(y0 + (c >> 1), last), w = (c & 1 ? fx : 1 - fx) * (c >> 1 ? fy : 1 - fy);
        if (field[cy * size + cx] >= 0 && w > 0) { z += field[cy * size + cx] * w; zw += w; }
      }
      out[i * 3] = nx;
      out[i * 3 + 1] = ny;
      out[i * 3 + 2] = zw > 0 ? z / zw : inside(x, y) ? depth(x, y) : 0;
    }
    return out;
  }

  // How many dots face the light (from the upper left, as in the vertex shader) and the viewer: the pool a
  // sparkle burst draws its stars from, so each burst lights about STARS of them whatever the dot count, and
  // STARS_BRIGHT on light and dark paper, where the shine is stronger. BITS is the share of dots a sheen carries off.
  var STARS = 40, STARS_BRIGHT = 64, BITS = 0.014, LIGHT = [-0.45, 0.6, 0.66];
  function litDots(normals) {
    var l = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]), lit = 0;
    for (var i = 0; i < normals.length; i += 3) {
      var nx = normals[i], ny = normals[i + 1], nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
      if (nz > 0.3 && (nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / l > 0.5) lit++;
    }
    return lit;
  }

  // Which map the dots are stippled from. On light paper they are ink, from the ink map, dense where the statue is
  // dark, as in an engraving. On dark paper (Gear Two's too) the same density in light-colored dots would draw a
  // negative, so they stand for light instead, from the light map, dense where the statue is lit: a lit statue in a
  // dark room, as the avatar is.
  function dotMap(colors) { return colors.dark ? "light" : "ink"; }

  // The material under a point of the color map: its red channel at the nearest pixel (index x 51). Never
  // interpolated, since the average of two material indices would name a third.
  var MARBLE = 51;
  function materialAt(rgba, size, x, y) {
    var last = size - 1;
    return rgba[(Math.round(clamp(y, 0, 1) * last) * size + Math.round(clamp(x, 0, 1) * last)) * 4];
  }

  // A map's four channels under each dot, bilinear from the size x size RGBA map: bytes per dot. For the color
  // map that is [material, weight, -, a], where a is 128 plus the image's own sparkle (its highlights, which the
  // shader twinkles). `points` holds `stride` floats per dot, x and y first.
  function sampleColors(rgba, size, points, stride) {
    var n = points.length / stride, out = new Uint8Array(n * 4), last = size - 1;
    for (var i = 0; i < n; i++) {
      var u = clamp(points[i * stride] * last, 0, last), v = clamp(points[i * stride + 1] * last, 0, last);
      var j0 = Math.floor(u), i0 = Math.floor(v), fx = u - j0, fy = v - i0, j1 = Math.min(j0 + 1, last), i1 = Math.min(i0 + 1, last);
      var a = (i0 * size + j0) * 4, b = (i0 * size + j1) * 4, c = (i1 * size + j0) * 4, d = (i1 * size + j1) * 4;
      var w00 = (1 - fx) * (1 - fy), w01 = fx * (1 - fy), w10 = (1 - fx) * fy, w11 = fx * fy;
      for (var k = 0; k < 4; k++) out[i * 4 + k] = Math.round(rgba[a + k] * w00 + rgba[b + k] * w01 + rgba[c + k] * w10 + rgba[d + k] * w11);
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

  // The ring text: the line repeated as many whole times as fill the circumference, each repeat closed by a
  // middle dot, so a word is never cut. Glyphs are spread evenly around the ring, so spacing flexes a little.
  function ringText(line, circumference, advance) {
    var lap = line.trim().split(/\s+/).join(" ") + " · ";
    var reps = Math.max(1, Math.round(circumference / (lap.length * advance)));
    var glyphs = [];
    for (var r = 0; r < reps; r++) for (var i = 0; i < lap.length; i++) glyphs.push(lap.charAt(i));
    return { glyphs: glyphs, reps: reps };
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
    "layout(location = 2) in vec4 a_c;",
    "layout(location = 3) in vec4 a_e;",
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
    "uniform vec3 u_color;",
    "uniform float u_tint;",
    "uniform vec3 u_palette[5];",
    "uniform vec3 u_lit[5];",
    "uniform float u_deep;",
    "uniform vec3 u_hot;",
    "uniform vec4 u_sheen;",
    "uniform vec4 u_span;",
    "uniform vec4 u_flow;",
    "uniform vec3 u_light[3];",
    "uniform float u_positive;",
    "uniform vec4 u_swap;",
    "out float v_alpha;",
    "out float v_size;",
    "out float v_star;",
    "out float v_bit;",
    "out float v_crystal;",
    "out float v_sprite;",
    "out vec3 v_color;",
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
    // light from the upper left, in front. Where the dots are ink, lit stone gets smaller, fainter dots and grazing
    // edges heavier ones; where they are light (u_positive, on dark paper), lit stone gets larger, brighter dots and
    // the surface dims as it turns away, so the edges fall into the dark
    "  float lam = max(0.0, dot(n, normalize(vec3(-0.45, 0.6, 0.66))));",
    "  float rim = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);",
    "  float shade = mix(mix(1.12, 0.84, lam) * (1.0 + 0.18 * rim), mix(0.88, 1.12, lam) * (1.0 - 0.3 * rim), u_positive);",
    "  float fade = mix(mix(1.0, 0.86, lam), mix(0.78, 1.0, lam) * (1.0 - 0.35 * rim), u_positive);",
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
    // the dot's material in the mode's designed palette (gold, marble, cloud, lightning, glint), moving from
    // its base color to its lit one as the surface turns to the light; marble carries no weight, so it stays ink
    "  int m = int(a_c.r * 5.0 + 0.5);",
    "  vec3 mat = mix(u_palette[m], u_lit[m], smoothstep(0.15, 0.9, lam));",
    // on light paper the densest dots of a material lean toward the ink, so gold has bronze in its crevices
    "  mat = mix(mat, u_color, u_deep * smoothstep(0.45, 0.95, a_p.w));",
    // at each turn of the sway a band of light crosses the figure, strongest where the surface faces the viewer,
    // with an afterglow in its wake; a burst of dots on the lit side flare into four-point stars, each on its own
    // delay; and a few dots leave the surface as the band passes, stream on behind it as bits, and turn to crystal
    // where they reach the figure's edge (u_flow: the share of bits, the sweep's length, 1 on light and dark paper
    // for the stronger shine, and 1 when the materials' colors should appear only behind the band, as in the opening)
    "  float band = 0.0, trail = 0.0, star = 0.0, bit = 0.0, crystal = 0.0, show = 1.0, wake = 1.0, streak = 0.0;",
    "  vec2 flow = vec2(0.0);",
    "  if (u_sheen.y != 0.0) {",
    "    float w = u_span.y - u_span.x, travel = w * 1.4;",
    "    float along = px.x + (px.y - u_box.y - u_pivot.y * u_box.z) * 0.25 - u_span.x + w * 0.2;",
    "    if (u_sheen.y < 0.0) along = travel - along;",
    "    float e = (u_sheen.x * travel - along) / u_span.z;",
    "    float face = pow(max(n.z, 0.0), 2.0) * k;",
    "    band = exp(-e * e) * face;",
    "    if (e > 0.0) trail = exp(-e / (1.5 + 1.5 * u_flow.z)) * face * (1.0 - smoothstep(u_flow.y, u_flow.y + 0.5, u_sheen.w));",
    "    if (u_flow.w > 0.0) wake = smoothstep(-0.6, 1.6, e);",
    "    if (r01(id * 11u + uint(u_sheen.z)) < u_span.w && n.z > 0.3 && lam > 0.5) {",
    "      float a = u_sheen.w - r01(id * 13u + 5u) * 0.25;",
    "      float fall = 0.6 + r01(id * 17u + 9u) * 0.3;",
    "      star = smoothstep(0.0, 0.12, a) * pow(clamp(1.0 - max(a - 0.12, 0.0) / fall, 0.0, 1.0), 2.0) * k;",
    "    }",
    // a bit leaves the surface when the band passes it (the band's progress at the dot, back through the sweep's
    // easing to seconds) and flows on at its own speed, slower than the band, rising a little, so the bits stream
    // behind the light; each is fast enough to reach the edge within 0.9 s, where it turns to crystal and fades,
    // and the dot it left re-forms in its place
    "    if (e > 0.0 && r01(id * 19u + uint(u_sheen.z) * 7u + 3u) < u_flow.x) {",
    "      float c = clamp(along / travel, 0.0, 1.0);",
    "      float picked = u_sheen.w - (c < 0.5 ? pow(c * 0.25, 1.0 / 3.0) : 1.0 - pow(2.0 - 2.0 * c, 1.0 / 3.0) * 0.5) * u_flow.y;",
    "      float edge = (u_sheen.y > 0.0 ? a_e.x : a_e.y) * u_box.z, rise = 0.05 + 0.12 * s1;",
    "      float speed = max(w * (0.4 + 0.45 * r01(id * 23u + 1u)), edge / 0.9);",
    "      float carry = speed * max(0.0, picked - 0.12 * (1.0 - exp(-picked / 0.12)));",
    "      if (carry < edge) {",
    "        bit = smoothstep(0.0, 6.0, carry) * k;",
    "        streak = speed;",
    "        flow = vec2(u_sheen.y * carry, sin(carry * 0.045 + s2 * 6.2831853) * 3.0 - carry * rise);",
    "      } else {",
    "        float since = (carry - edge) / speed;",
    "        if (since < 0.55) {",
    "          crystal = smoothstep(0.0, 0.05, since) * pow(1.0 - since / 0.55, 1.5) * (r01(id * 29u + 11u) < 0.4 ? 1.0 : 0.35) * k;",
    "          flow = vec2(u_sheen.y * (edge + 16.0 * (1.0 - exp(-since * 5.0))), -edge * rise - 14.0 * since);",
    "        } else show = smoothstep(0.65, 1.25, since);",
    "      }",
    "    }",
    "  }",
    // when the paper turns between light and dark, a band of light crosses the figure and the dots of the new map
    // (u_swap.z 1) appear behind it, while those of the old one (-1) give way ahead of it, dimmed
    "  if (u_swap.y != 0.0) {",
    "    float w = u_span.y - u_span.x, travel = w * 1.4;",
    "    float along = px.x + (px.y - u_box.y - u_pivot.y * u_box.z) * 0.25 - u_span.x + w * 0.2;",
    "    if (u_swap.y < 0.0) along = travel - along;",
    "    float e = (u_swap.x * travel - along) / u_span.z, behind = smoothstep(-0.6, 1.6, e);",
    "    show *= u_swap.z > 0.0 ? behind : (1.0 - behind) * 0.6;",
    "    band = max(band, exp(-e * e) * pow(max(n.z, 0.0), 2.0) * k);",
    "  }",
    "  float tint = u_tint * wake;",
    "  vec3 col = mix(u_color, mat, a_c.g * tint);",
    // the image's sparkles twinkle: they swell and brighten on a slow cycle of their own
    "  float sparkle = clamp(a_c.a * 2.0 - 1.0, 0.0, 1.0);",
    "  float tw = sparkle * (0.5 + 0.5 * sin(u_time * 2.2 + s2 * 6.2831853)) * min(1.0, tint * 2.5);",
    "  hot = max(hot, tw * 0.9);",
    "  col = mix(col, u_hot, hot * 0.9);",
    "  float lit = max(band, trail * (0.3 + 0.15 * u_flow.z));",
    "  col = mix(col, mix(u_light[0], u_light[1], smoothstep(0.5, 1.0, band)), min(1.0, lit * 1.25));",
    "  col = mix(col, mix(u_light[0], u_light[1], 0.7), bit);",
    "  v_color = mix(col, u_light[2], star);",
    "  px += flow + u_offset;",
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
    "  size *= shade * (1.0 + 0.9 * tw) * (1.0 + (0.35 + 0.3 * u_flow.z) * band) * (1.0 + (1.2 + 0.6 * u_flow.z) * star) * (1.0 + 0.7 * bit);",
    // fine features (high detail) are drawn with smaller dots, broad shadows with larger ones
    "  size *= mix(1.0, 0.82, a_c.b);",
    // the face and the hands sit on a grid twice as fine: four dots, each 62% the size, where one would be
    "  size *= mix(1.0, 0.62, a_e.z);",
    "  size = mix(size * 0.7, size, k);",
    "  v_alpha = (0.62 + 0.38 * smoothstep(-0.25, 0.2, p.z)) * fade * mix(0.0, 1.0, smoothstep(0.0, 0.25, k)) * u_alpha;",
    "  v_alpha = mix(v_alpha, u_alpha, max(max(band, star), bit)) * show;",
    "  if (off && star < 0.05 && bit < 0.05) v_alpha = 0.0;",
    // a crystal is the bit itself, at the edge, until it fades
    "  if (crystal > 0.0) v_alpha = u_alpha;",
    "  v_star = star;",
    "  v_bit = bit * u_sheen.y;",
    "  v_crystal = crystal;",
    "  v_size = size * u_dpr;",
    // a star's sprite is larger than its disc, to hold the arms of the cross; a crystal's larger still
    "  v_sprite = v_size * (1.0 + 3.0 * star + 8.0 * crystal);",
    // a bit is drawn as a streak behind its head, as long as it moves in 20 ms: the sprite holds it both ways
    "  if (bit > 0.0) v_sprite = max(v_sprite, 2.0 * clamp(streak * 0.02, 5.0, 12.0) * u_dpr * bit);",
    "  gl_PointSize = v_sprite;",
    "  gl_Position = vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    "#version 300 es",
    "precision mediump float;",
    "in float v_alpha;",
    "in float v_size;",
    "in float v_star;",
    "in float v_bit;",
    "in float v_crystal;",
    "in float v_sprite;",
    "in vec3 v_color;",
    "uniform highp vec3 u_light[3];",
    "out vec4 o;",
    // an arm of a star along x: as thick as `t` at the centre, tapering to nothing at `r`
    "float arm(vec2 m, float t, float r, float k) { return clamp(max(0.45, t * (1.0 - m.x / r)) - m.y + 0.5, 0.0, 1.0) * pow(max(0.0, 1.0 - m.x / r), k); }",
    "void main() {",
    "  vec2 q = (gl_PointCoord - 0.5) * v_sprite;",
    "  vec2 m = abs(q);",
    "  float r = v_sprite * 0.5;",
    "  float a = clamp(v_size * 0.5 - length(q) + 0.5, 0.0, 1.0);",
    "  vec3 c = v_color;",
    // a star is a four-point cross over its disc: two thin arms that taper to the sprite's edge; its middle burns in
    // the sheen's core colour
    "  if (v_star > 0.0) {",
    "    a = max(a, max(arm(m, v_size * 0.16, r, 0.8), arm(m.yx, v_size * 0.16, r, 0.8)) * v_star);",
    "    c = mix(c, u_light[1], v_star * clamp(1.0 - length(q) / (v_size * 0.6), 0.0, 1.0));",
    "  }",
    // a bit is a bright head with a tail behind it along its path, fading to the sheen's fringe colour
    "  if (v_bit != 0.0) {",
    "    float back = max(0.0, -q.x * sign(v_bit)) / r;",
    "    float tail = clamp(v_size * 0.45 * (1.0 - back) - m.y + 0.5, 0.0, 1.0) * (1.0 - back) * step(0.0, -q.x * sign(v_bit));",
    "    a = max(a, max(clamp(v_size * 0.6 - length(q) + 0.5, 0.0, 1.0), tail * 0.9) * abs(v_bit));",
    "    c = mix(u_light[0], mix(u_light[0], u_light[1], 0.65), clamp(1.0 - back * 2.0, 0.0, 1.0));",
    "  }",
    // a crystal is an eight-point glint: long arms on the axes, short ones on the diagonals, a white heart, and tips
    // in the sheen's colour, so it reads on white paper as well as on dark
    "  if (v_crystal > 0.0) {",
    "    vec2 g = vec2(m.x + m.y, abs(m.x - m.y)) * 0.70710678;",
    "    float axes = max(arm(m, v_size * 0.3, r, 0.6), arm(m.yx, v_size * 0.3, r, 0.6));",
    "    float diagonals = arm(g, v_size * 0.22, r * 0.5, 0.8);",
    "    a = max(clamp(v_size * 0.8 - length(q) + 0.5, 0.0, 1.0), max(axes, diagonals)) * v_crystal;",
    "    c = mix(u_light[0], vec3(1.0), clamp(1.5 - length(q) / (v_size * 1.1), 0.0, 1.0));",
    "  }",
    "  a *= v_alpha;",
    "  if (a <= 0.0) discard;",
    "  o = vec4(c * a, a);",
    "}"
  ].join("\n");

  /* ── engine ───────────────────────────────────────────── */

  // How much of its materials' colors the figure wears: all of it on light and dark paper; in Gear Two 40%, over
  // a palette that is red but for its gold, so only the wings and the caduceus keep a trace of their own.
  function tintFor(colors) { return colors.gear ? 0.4 : 1; }

  function readColors() {
    var s = getComputedStyle(document.documentElement);
    var get = function (name) { return s.getPropertyValue(name).trim(); };
    var paper = get("--paper"), p = rgb(paper);
    return {
      ink: get("--figure-ink"), accent: get("--accent"), paper: paper, text: get("--ink"),
      // the sheen's fringe and core and the stars of its burst, one hue family per mode
      light: [get("--figure-sheen"), get("--figure-sheen-core"), get("--figure-star")],
      // each material's base and lit color, in index order; marble is the figure's ink
      palette: ["gold", "marble", "cloud", "lightning", "glint"].map(function (m) { return m === "marble" ? get("--figure-ink") : get("--mat-" + m); }),
      lit: ["gold", "marble", "cloud", "lightning", "glint"].map(function (m) { return m === "marble" ? get("--figure-ink") : get("--mat-" + m + "-lit"); }),
      gear: document.documentElement.getAttribute("data-gear") === "two", dark: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] < 0.5
    };
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
    var line = (opts.line || "").toUpperCase();
    var canvas = document.createElement("canvas");
    var overlay = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-hidden", "true");
    canvas.className = "hero-dots";
    overlay.className = "hero-words";
    // the light a sheen throws on the paper behind the figure, on light and dark paper
    var glow = document.createElement("div");
    glow.className = "hero-glow";
    glow.setAttribute("aria-hidden", "true");
    var gl = null, ctx = null;
    try {
      gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
      ctx = overlay.getContext("2d");
    } catch (e) {}
    if (!gl || !ctx) {
      el.classList.remove("is-live");
      el.classList.add("is-fallback");
      return { highlight: function () {}, count: function () { return 0; }, ripple: function () {}, skipIntro: function () {} };
    }
    el.appendChild(glow);
    el.appendChild(canvas);
    el.appendChild(overlay);

    var prog = null, vao = null, vbo = null, query = null, U = {}, queryPending = false, rendered = false, drawChecked = false;
    var relief = null, field = null, noise = null, meta = null, palette = null, vertices = null, count = 0, res = 0, fine = null;
    // the dot maps loaded so far (ink for light paper, light for dark; dotMap), the one the figure is drawn from, its
    // dots and the other map's at the current grid, and a swap from one to the other in progress
    var sources = { ink: null, light: null }, loading = {}, failed = {}, set = null, shapes = {}, swap = null;
    var cssW = 0, cssH = 0, dpr = 1, box = { x: 0, y: 0, size: 0 }, place = null, cell = 1;
    var colors = readColors();
    var inkNow = rgb(colors.ink), inkFrom = inkNow, inkTo = inkNow, inkAt = 0;
    var tintNow = tintFor(colors), tintFrom = tintNow, tintTo = tintNow;
    var yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, pushK = { x: 0, v: 0 };
    var pointer = { x: -1e4, y: -1e4, inside: false, tx: 0, ty: 0 };
    var touch = null;
    var ripples = [[0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0]], nextRipple = 0;
    var ripFlat = new Float32Array(16);
    var startAt = 0, last = 0, raf = 0, visible = false, ready = false, clock = 0, spin = 0;
    var ring = null, ringFont = 0, fontReady = false, ringLitAt = 0;
    var glitchUntil = 0, tear = null, tearBeat = -1, longDone = -1, resizeTimer = 0, tiles = [], tileFlat = new Float32Array(12), shiftFlat = new Float32Array(6);
    var sheenIndex = -1, sheenAt = 0, sheenDir = 0, sheenNumber = 0, sheenSweep = SHEEN_SWEEP, sheenWake = false, bursts = 0;
    var starChance = [0, 0], lights = new Float32Array(9), glowShown = -1, glowSize = [0, 0], pad = 0;
    // the opening: still in ink, a shine that leaves the colors behind, a turn, Gear Two and back (see INTRO)
    var intro = opts.intro ? { stage: "hold", at: null, redAt: null } : null, ringAt = 0;
    if (intro) { sheenIndex = 0; el.setAttribute("data-intro", "hold"); }
    var materials = new Float32Array(15), materialsLit = new Float32Array(15);
    var cpuMs = 0, telemetryAt = 0;

    function paintLights() {
      colors.light.forEach(function (css, i) { lights.set(rgb(css), i * 3); });
      colors.palette.forEach(function (css, i) { materials.set(rgb(css), i * 3); });
      colors.lit.forEach(function (css, i) { materialsLit.set(rgb(css), i * 3); });
    }
    paintLights();

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
      tear = null;
      tiles = [];
    }

    function fallback() {
      endIntro(false);
      swap = null;
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
        ["u_res", "u_box", "u_pivot", "u_depth", "u_rot", "u_time", "u_build", "u_pointer", "u_rip", "u_blink", "u_beat", "u_dot", "u_dpr", "u_glitch", "u_tile", "u_shift", "u_offset", "u_alpha", "u_color", "u_tint", "u_palette", "u_lit", "u_deep", "u_hot", "u_sheen", "u_span", "u_flow", "u_light", "u_positive", "u_swap"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
        vao = gl.createVertexArray();
        vbo = gl.createBuffer();
        query = gl.createQuery();
        if (!vao || !vbo || !query) throw new Error("hero buffers unavailable");
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // per dot: x, y, z, ink (4 floats), normal (2 floats), material, its weight, detail, and sparkle (4 bytes),
        // the way to the edge right and left, and the fine flag (4 bytes, one spare): 32 bytes
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 32, 16);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 32, 24);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 32, 28);
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

    // The dots of one map at the current grid: stippled against the blue-noise tile, then given their depth, normal,
    // detail, material, sparkle, and way to the edge from the other maps, packed 32 bytes a dot (see initialize).
    function shape(source) {
      var spots = stipple(source.data, source.width, noise.data, noise.width, res, meta.density, 0.7, fine);
      var n = spots.length / 3;
      var normals = depthNormals(field, relief.width, spots, 3, RELIEF);
      var details = sampleColors(relief.data, relief.width, spots, 3);
      var tints = palette ? sampleColors(palette.data, palette.width, spots, 3) : null;
      var edges = edgeDistances(relief.data, relief.width, spots, 3);
      var buffer = new ArrayBuffer(n * 32), floats = new Float32Array(buffer), bytes = new Uint8Array(buffer);
      for (var i = 0; i < n; i++) {
        floats[i * 8] = spots[i * 3];
        floats[i * 8 + 1] = spots[i * 3 + 1];
        floats[i * 8 + 2] = normals[i * 3 + 2];
        floats[i * 8 + 3] = spots[i * 3 + 2];
        floats[i * 8 + 4] = normals[i * 3];
        floats[i * 8 + 5] = normals[i * 3 + 1];
        // material (nearest, never blended), how strongly the dot belongs to it, its detail, its sparkle
        var o = i * 32 + 24;
        bytes[o] = palette ? materialAt(palette.data, palette.width, spots[i * 3], spots[i * 3 + 1]) : MARBLE;
        bytes[o + 1] = tints ? tints[i * 4 + 1] : 0;
        bytes[o + 2] = details[i * 4 + 1];
        bytes[o + 3] = tints ? tints[i * 4 + 3] : 0;
        // the way to the figure's edge, right and left, and whether the dot is on the fine grid of a face or hand
        bytes[o + 4] = Math.round(Math.min(1, edges[i * 2]) * 255);
        bytes[o + 5] = Math.round(Math.min(1, edges[i * 2 + 1]) * 255);
        bytes[o + 6] = fineCell(fine, res, Math.floor(spots[i * 3] * res), Math.floor(spots[i * 3 + 1] * res)) ? 255 : 0;
      }
      var lit = Math.max(1, litDots(normals));
      return { vertices: bytes, count: n, stars: [Math.min(1, STARS / lit), Math.min(1, STARS_BRIGHT / lit)] };
    }

    function size() {
      var rect = el.getBoundingClientRect();
      var w = Math.round(rect.width), h = Math.round(rect.height);
      if (!w || !h) return false;
      pad = Math.round(Math.max(w, h) * 0.18);
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
      glowSize = [Math.round(s * 0.62), Math.round(s * 1.1)];
      glow.style.width = glowSize[0] + "px";
      glow.style.height = glowSize[1] + "px";
      glowShown = -1;
      place = fit(meta.bounds, s, s * 0.02);
      gl.viewport(0, 0, canvas.width, canvas.height);
      var want = resolutionFor(place.scale);
      // the face and the hands get their finer grid where the screen has the pixels to show it: below 1.5 device
      // pixels per CSS pixel the finer dots are smaller than a pixel and only darken the stone
      var zones = dpr >= 1.5 && meta.fine ? meta.fine : null;
      if (want !== res || zones !== fine) {
        res = want;
        fine = zones;
        shapes = {};
        swap = null;
      }
      if (!shapes[set]) shapes[set] = shape(sources[set]);
      if (vertices !== shapes[set].vertices) {
        vertices = shapes[set].vertices;
        count = shapes[set].count;
        starChance = shapes[set].stars;
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

    // The dots follow the paper (dotMap): when it turns between light and dark, the figure is drawn from the other
    // map, fetched the first time it is needed. In full motion, with the figure drawn and on screen, a band of light
    // crosses it and swaps the dots behind it; during Gear Two's switch, whose flash and glitch already break the
    // figure up, and in every other case, they swap at once. Returns whether the map changed; the caller redraws.
    function follow() {
      var want = dotMap(colors);
      if (!meta || want === set) return false;
      if (!sources[want]) { fetchMap(want); return false; }
      var from = set, old = vertices, oldCount = count;
      set = want;
      swap = null;
      if (!prog || !ready || gl.isContextLost()) return true;
      try { ready = size(); } catch (e) { fallback(); return false; }
      var now = performance.now();
      if (ready && old && rendered && canInteract() && now >= glitchUntil) {
        var both = new Uint8Array(vertices.length + old.length);
        both.set(vertices);
        both.set(old, vertices.length);
        gl.bufferData(gl.ARRAY_BUFFER, both, gl.STATIC_DRAW);
        swap = { at: now, count: oldCount, positive: from === "light" ? 1 : 0 };
      }
      return true;
    }

    // A map that fails to arrive leaves the figure on the map it has, at full strength; the next change of paper tries
    // again.
    function fetchMap(name) {
      if (sources[name] || loading[name] || !meta) return;
      loading[name] = true;
      failed[name] = false;
      var miss = function () { loading[name] = false; failed[name] = true; sync(); };
      loadImageData(base + name + ".webp").then(function (img) {
        if (img.width !== meta.size || img.height !== meta.size) { miss(); return; }
        loading[name] = false;
        sources[name] = img;
        if (follow()) sync();
      }, miss);
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
      var n = relief.width, i = (Math.floor(v * n) * n + Math.floor(u * n)) * 4;
      return relief.data[i] > 0 ? 1 : 0;
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
        // a faint frame where the block was torn from, and a firm one where it landed
        ctx.globalAlpha = 0.35;
        ctx.strokeRect(Math.round(tl[0]) + 0.5, Math.round(tl[1]) + 0.5, w, h);
        ctx.globalAlpha = 0.08;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawRing(yawNow, pitchNow, fade, beat, glow) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      drawTiles();
      if (!fontReady || fade <= 0.01 || !line) return;
      var spec = meta.ring || {};
      // the ring breathes with the Gear Two heartbeat
      var R = (spec.r || 0.42) * (1 + 0.02 * beat), tilt = spec.tilt == null ? 0.3 : spec.tilt;
      var pivot = [spec.x == null ? meta.center[0] : spec.x, spec.y == null ? meta.center[1] : spec.y];
      var pc = figurePx(pivot[0], pivot[1]);
      var Rpx = (spec.r || 0.42) * place.scale;
      var font = ringFont;
      ctx.font = "400 " + font + "px \"Fragment Mono\", ui-monospace, monospace";
      var advance = ctx.measureText("M").width * 1.32;
      if (!ring) ring = ringText(line, TAU * Rpx, advance);
      var n = ring.glyphs.length;
      var accent = colors.gear ? colors.text : colors.accent;
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
        var alpha = (front ? 1 : 0.3) * (0.35 + 0.65 * Math.pow(facing, 0.6));
        // a brighten lifts every glyph toward full strength, the dim ones behind the figure most
        alpha = (alpha + (1 - alpha) * glow) * fade;
        if (alpha < 0.02) continue;
        var k = pr[2];
        var tx = tg[0] * k, ty = -tg[1] * k, ux = -up[0] * k, uy = up[1] * k;
        ctx.setTransform(tx * dpr, ty * dpr, ux * dpr, uy * dpr, sx * dpr, sy * dpr);
        ctx.globalAlpha = alpha;
        if (front) ctx.strokeText(ch, 0, 0);
        ctx.fillStyle = accent;
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

    function planTear(plan, from, block) {
      return { from: from, until: from + plan.frames * 1000 / 24, tiles: plan.tiles, glitch: plan.glitch, after: plan.after ? (block % 2 ? 2 : -2) : 0, drawn: false };
    }

    // At a sheen in Gear Two the burst tears with it: the long tear moves to meet it when due within a second,
    // otherwise one frame tears.
    function tearAtSheen(now, t) {
      var block = Math.floor(t / BEAT / TEAR_BLOCK);
      for (var k = Math.max(block, longDone + 1); k <= block + 1; k++) {
        if (Math.abs(longTearBeat(k) * BEAT + TEAR_AT - t) < 1) {
          tear = planTear(tearSchedule(longTearBeat(k)), now, k);
          longDone = k;
          return;
        }
      }
      tear = { from: now, until: now + 1000 / 24, tiles: 1, glitch: 0.6, after: 0, drawn: false };
    }

    // A sheen: a band of light across the figure with its burst of stars and the bits it carries off. `wake` keeps
    // the materials' colors behind the band, as in the opening. In Gear Two the burst also tears the figure.
    function shine(now, dir, sweep, wake, number) {
      sheenAt = now;
      sheenDir = dir;
      sheenSweep = sweep;
      sheenWake = wake;
      sheenNumber = number;
      if (colors.gear && startAt && now - startAt > 2000) tearAtSheen(now, now / 1000);
    }

    // Ends the opening wherever it is: the colors and the ring arrive if they had not, and Gear Two, if the opening
    // had switched it on, goes back off unless `keepGear` (the visitor has just pressed a switch of their own).
    function endIntro(keepGear) {
      if (!intro) return;
      var stage = intro.stage, now = performance.now();
      intro = null;
      el.setAttribute("data-intro", "done");
      if (stage === "hold") { tintFrom = 0; tintTo = tintFor(colors); inkFrom = inkTo = inkNow; inkAt = now; }
      if (!(ringAt && ringAt <= now)) ringAt = now;
      if (opts.onIntro) {
        if (!keepGear && /^red/.test(stage)) opts.onIntro("back");
        opts.onIntro("done");
      }
    }

    function render(now) {
      if (gl.isContextLost()) { fallback(); return; }
      reveal();
      if (!ready) return;
      var began = performance.now();
      var live = !motion.reduced();
      var dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      var gear = colors.gear, rate = gear ? 1.6 : 1;
      if (live && intro) {
        // the opening's clock starts once the drawn figure is on screen (is-live), not at the first draw
        if (intro.at == null && rendered) intro.at = now / 1000;
        var step = intro.at == null ? { state: intro, clock: clock, act: null } : introStep(intro, now / 1000, clock, gear);
        clock = step.clock;
        if (step.act === "shine") shine(now, -1, INTRO.sweep, true, ++bursts + 100);
        else if (step.act === "redshine") shine(now, 1, SHEEN_SWEEP, false, ++bursts + 100);
        else if (step.act === "ring") {
          ringAt = now;
          // the opening is about to take the page to Gear Two, whose dark paper draws the dots from the light map
          fetchMap(dotMap({ dark: true }));
        }
        else if ((step.act === "red" || step.act === "back") && opts.onIntro) opts.onIntro(step.act);
        if (!step.state) endIntro(true);
        else if (step.state !== intro) {
          intro = step.state;
          el.setAttribute("data-intro", intro.stage);
        }
        if (intro) rate = INTRO_RATE[intro.stage];
      }
      // the opening holds the figure still, facing the viewer, until its shine has crossed it
      var still = live && intro && (intro.stage === "hold" || intro.stage === "shine");
      if (live) clock += dt * rate;
      var t = live ? now / 1000 : 0;
      var built = live ? (now - startAt) / 1000 : 99;
      if (!ringAt) ringAt = intro ? Infinity : startAt + 1200;
      var swayYaw = live ? sway(clock) : 0.12;
      var swayPitch = live ? 0.07 * Math.sin((TAU * clock) / 19 + 1) : 0.02;
      var tilt = pointer.inside || (touch && touch.dragging);
      if (still) {
        yaw.x = pitch.x = yaw.v = pitch.v = 0;
        spring(pushK, pointer.inside ? 1 : 0, dt, 9);
      } else if (live) {
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
        tintNow = tintFrom + (tintTo - tintFrom) * q;
        if (q >= 1) inkAt = 0;
      }
      for (var i = 0; i < 4; i++) {
        ripFlat[i * 4] = ripples[i][0];
        ripFlat[i * 4 + 1] = ripples[i][1];
        ripFlat[i * 4 + 2] = ripples[i][2];
        ripFlat[i * 4 + 3] = live ? ripples[i][3] : 0;
      }
      var beat = gear && live ? heartbeat(t) : 0;
      // a sheen and a burst of stars at each turn of the sway (in Gear Two the burst also tears one frame), and one
      // as the dots finish assembling, which they do on the wall clock: the sway's clock runs slow where frames do
      if (live) {
        var turn = sheenPhase(clock);
        if (sheenIndex < 0 && turn.index < 0 && built >= SHEEN_FIRST) turn = sheenPhase(SHEEN_FIRST);
        if (turn.index > sheenIndex) {
          sheenIndex = turn.index;
          shine(now, turn.dir, SHEEN_SWEEP, false, turn.index + 1);
        }
      }
      // Gear Two tears the figure on some heartbeats, from the beat's first peak, once it has assembled
      if (live && gear && built > 2) {
        var b = Math.floor(t / BEAT);
        if (b !== tearBeat) {
          tearBeat = b;
          var plan = tearSchedule(b), block = Math.floor(b / TEAR_BLOCK);
          if (plan && !(plan.long && block <= longDone) && !(tear && now < tear.until)) {
            tear = planTear(plan, (b * BEAT + TEAR_AT) * 1000, block);
            if (plan.long) longDone = block;
          }
        }
      }
      var sheenAge = (now - sheenAt) / 1000;
      var sheening = live && sheenDir !== 0 && sheenAge < sheenSweep + SHEEN_AFTER;
      // on light and dark paper the shine is stronger: a wider band, a longer afterglow, more stars, and light on the paper
      var bright = !gear;
      // the switch's own glitch window, or a tear while Gear Two is on (never during a touch drag)
      var switching = live && now < glitchUntil;
      // a tear is drawn for at least one frame, even when frames come slower than 24 fps
      var tearing = !switching && live && gear && !(touch && touch.dragging) && tear !== null && now >= tear.from &&
        (now < tear.until || (!tear.drawn && now < tear.until + 250));
      if (tearing) tear.drawn = true;
      var glitch = switching ? 1 : tearing ? tear.glitch : 0;
      tiles = glitch ? glitchTiles(Math.floor(t * 24), box, 3, function (x, y) { return maskAt(x, y) > 0.2; }).slice(0, switching ? 3 : tear.tiles) : [];
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
      gl.uniform1f(U.u_build, opts.intro ? 99 : built);
      gl.uniform4f(U.u_pointer, pointer.x, pointer.y, pushK.x * (gear ? 1.5 : 1), Math.max(70, box.size * 0.13));
      gl.uniform4fv(U.u_rip, ripFlat);
      gl.uniform1f(U.u_blink, live && !still ? (gear ? 2 : 1) : 0);
      gl.uniform1f(U.u_beat, beat);
      gl.uniform1f(U.u_dot, Math.max(1.1, cell * 1.3));
      gl.uniform1f(U.u_dpr, dpr);
      gl.uniform1f(U.u_glitch, glitch);
      gl.uniform4fv(U.u_tile, tileFlat);
      gl.uniform2fv(U.u_shift, shiftFlat);
      gl.uniform3f(U.u_color, inkNow[0], inkNow[1], inkNow[2]);
      // the materials' colors (Gear Two keeps only its gold, at 40%); without the material map every dot is ink.
      // Sparkles and hot dots run warm white on dark paper, gold on light.
      // The opening holds the figure in its ink until its shine brings the colors.
      gl.uniform1f(U.u_tint, palette ? (live && intro && intro.stage === "hold" ? 0 : tintNow) : 0);
      gl.uniform3fv(U.u_palette, materials);
      gl.uniform3fv(U.u_lit, materialsLit);
      gl.uniform1f(U.u_deep, colors.dark ? 0 : 0.45);
      if (colors.dark) gl.uniform3f(U.u_hot, 1.0, 0.95, 0.86);
      else gl.uniform3f(U.u_hot, 0.86, 0.6, 0.16);
      var sweep = easeInOut(clamp(sheenAge / sheenSweep, 0, 1));
      if (sheening) gl.uniform4f(U.u_sheen, sweep, sheenDir, sheenNumber, sheenAge);
      else gl.uniform4f(U.u_sheen, 0, 0, 0, 0);
      var left = box.x + place.x + meta.bounds[0] * place.scale, right = box.x + place.x + meta.bounds[2] * place.scale;
      gl.uniform4f(U.u_span, left, right, box.size * (bright ? 0.05 : 0.035), starChance[bright ? 1 : 0]);
      gl.uniform4f(U.u_flow, BITS, sheenSweep, bright ? 1 : 0, sheening && sheenWake ? 1 : 0);
      // the paper behind the band takes the light, rising and falling with the sweep
      var light = sheening && bright ? Math.pow(Math.sin(Math.PI * Math.min(1, sheenAge / sheenSweep * 1.08)), 0.8) * (sheenWake ? 1 : 0.75) : 0;
      if (light > 0.002 || glowShown !== 0) {
        var w = right - left, bx = sheenDir > 0 ? left - w * 0.2 + sweep * w * 1.4 : right + w * 0.2 - sweep * w * 1.4;
        glow.style.transform = "translate(" + Math.round(bx - pad - glowSize[0] / 2) + "px," + Math.round(box.y + place.y + meta.center[1] * place.scale - pad - glowSize[1] / 2) + "px)";
        glow.style.opacity = light > 0.002 ? light.toFixed(3) : "0";
        glowShown = light > 0.002 ? light : 0;
      }
      gl.uniform3fv(U.u_light, lights);
      // the dots stand for light on dark paper; while the paper's turn swaps them, the new map's appear behind a band
      // of light and the old map's give way ahead of it
      var swapAge = swap ? Math.max(0, now - swap.at) / 1000 : 0;
      if (swap && (!live || swapAge >= SWAP)) swap = null;
      var swept = swap ? easeInOut(swapAge / SWAP) : 0;
      gl.uniform1f(U.u_positive, set === "light" ? 1 : 0);
      gl.uniform4f(U.u_swap, swept, swap ? -1 : 0, 1, 0);
      gl.bindVertexArray(vao);
      // while the switch glitches, two faint afterimages sit 2 px either side of the figure; a long tear leaves one
      if (switching || (tearing && tear.after)) {
        gl.uniform1f(U.u_alpha, 0.3);
        gl.uniform2f(U.u_offset, switching ? -2 : tear.after, 0);
        gl.drawArrays(gl.POINTS, 0, count);
        if (switching) {
          gl.uniform2f(U.u_offset, 2, 0);
          gl.drawArrays(gl.POINTS, 0, count);
        }
      }
      // while the other map is on its way the figure stays dimmed, as if the light had gone, until its band swaps them
      gl.uniform1f(U.u_alpha, set === dotMap(colors) || failed[dotMap(colors)] ? 1 : 0.6);
      gl.uniform2f(U.u_offset, 0, 0);
      var measure = !rendered && !queryPending;
      if (measure) gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
      gl.drawArrays(gl.POINTS, 0, count);
      if (measure) { gl.endQuery(gl.ANY_SAMPLES_PASSED); queryPending = true; }
      if (swap) {
        gl.uniform1f(U.u_positive, swap.positive);
        gl.uniform4f(U.u_swap, swept, -1, -1, 0);
        gl.drawArrays(gl.POINTS, count, swap.count);
      }
      var fade = live ? smoothstep(0, 0.7, (now - ringAt) / 1000) : 1;
      // a theme hover brightens the ring for 400 ms: up in the first 100, back down by the end
      var lit = live && ringLitAt ? (now - ringLitAt) / 400 : 1;
      var brighten = lit < 0.25 ? smoothstep(0, 0.25, lit) : 1 - smoothstep(0.25, 1, lit);
      drawRing(yaw.x, pitch.x, fade, beat, brighten);
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
      // the opening plays once, on screen, in full motion: reducing motion, scrolling away, or hiding the tab ends it
      if (intro && (motion.reduced() || (intro.at != null && (!visible || document.hidden)))) endIntro(false);
      if (!ready || !visible || document.hidden) return;
      if (motion.reduced()) {
        inkNow = rgb(colors.ink);
        tintNow = tintTo = tintFor(colors);
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
      paintLights();
      var next = rgb(colors.ink), tint = tintFor(colors);
      if (motion.reduced() || !ready) { inkNow = next; tintNow = tintFrom = tintTo = tint; inkAt = 0; }
      else if (next.join() !== inkNow.join() || tint !== tintTo) { inkFrom = inkNow; inkTo = next; tintFrom = tintNow; tintTo = tint; inkAt = performance.now(); }
      var phase = document.documentElement.getAttribute("data-phase");
      if (phase === "glitch" || phase === "flash") glitchUntil = performance.now() + 520;
      // leaving Gear Two: the tearing stops just after the palette comes back
      if (was.gear && !colors.gear) { glitchUntil = Math.min(glitchUntil, performance.now() + 140); tear = null; }
      if (was.gear !== colors.gear) ring = null;
      // the palette turning red rolls through the figure as a ripple from its centre
      if (!was.gear && colors.gear && canInteract()) ripple(box.x + box.size / 2, box.y + box.size / 2);
      follow();
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
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      // a visitor who opens the page somewhere below the figure, or leaves before it is drawn, never sees the opening
      if (!visible && intro && intro.at == null) endIntro(false);
      sync();
    }).observe(el);
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

    // the dots' map for the paper the page opens on comes first; the other is fetched when the paper changes (follow)
    var first = dotMap(colors);
    Promise.all([
      loadImageData(base + first + ".webp"),
      loadImageData(base + "depth.webp"),
      loadImageData(base + "bluenoise.png"),
      fetch(base + "hero.json").then(function (r) {
        if (!r.ok) throw new Error("hero metadata " + r.status);
        return r.json();
      }),
      // the color map is optional: without it every dot is ink
      loadImageData(base + "color.webp").then(function (img) { return img.width === img.height ? img : null; }, function () { return null; })
    ]).then(function (all) {
      var square = function (img) { return img.width >= 2 && img.width === img.height; };
      if (!square(all[0]) || !square(all[1]) || !square(all[2])) throw new Error("hero maps must be square");
      var data = all[3];
      var normalized = function (n) { return Number.isFinite(n) && n >= 0 && n <= 1; };
      if (!data || data.size !== all[0].width || data.depth !== all[1].width || !Array.isArray(data.bounds) || data.bounds.length !== 4 || !data.bounds.every(normalized) ||
          data.bounds[2] <= data.bounds[0] || data.bounds[3] <= data.bounds[1] ||
          !Array.isArray(data.center) || data.center.length !== 2 || !data.center.every(normalized) ||
          !normalized(data.density) || data.density <= 0 ||
          (data.fine != null && !(Array.isArray(data.fine) && data.fine.every(function (z) {
            return Array.isArray(z) && z.length === 5 && z.every(Number.isFinite) && normalized(z[0]) && normalized(z[1]) && z[2] > 0 && z[3] > 0 && z[2] < 0.5 && z[3] < 0.5;
          })))) throw new Error("hero metadata is invalid");
      sources[first] = all[0];
      set = first;
      relief = all[1];
      field = reliefField(relief.data, relief.width, 1.5);
      noise = { width: all[2].width, data: (function () { var d = all[2].data, o = new Uint8Array(d.length / 4); for (var i = 0; i < o.length; i++) o[i] = d[i * 4]; return o; })() };
      meta = data;
      palette = all[4];
      initialize();
      follow();
    }).catch(fallback);

    return {
      // brighten the ring once (nothing moves under reduced motion; the still is simply redrawn)
      highlight: function () { if (canInteract()) ringLitAt = performance.now(); else if (motion.reduced()) sync(); },
      count: function () { return count; },
      ripple: function () { if (canInteract()) ripple(box.x + box.size / 2, box.y + box.size / 2); },
      // ends the opening at once; `keepGear` leaves Gear Two as it is, for a visitor who has just pressed a switch
      skipIntro: function (keepGear) { endIntro(!!keepGear); }
    };
  }

  var api = {
    mount: mount,
    clamp: clamp,
    smoothstep: smoothstep,
    hash: hash,
    heartbeat: heartbeat,
    tearSchedule: tearSchedule,
    sway: sway,
    sheenPhase: sheenPhase,
    introStep: introStep,
    INTRO: INTRO,
    easeInOut: easeInOut,
    spring: spring,
    rippleWeight: rippleWeight,
    blinkOff: blinkOff,
    stipple: stipple,
    fineWeight: fineWeight,
    fineCell: fineCell,
    edgeDistances: edgeDistances,
    reliefField: reliefField,
    depthNormals: depthNormals,
    sampleColors: sampleColors,
    materialAt: materialAt,
    dotMap: dotMap,
    tintFor: tintFor,
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
