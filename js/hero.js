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
  // Tide's tide: the slow rhythm that takes the heartbeat's place in the blue gear, every TIDE seconds on the same clock
  // as the page's tide (--tide-delay in js/motion.js and the CSS keyframes, which share the constant). VORTEX is how
  // long its entrance takes to lift into a vortex and to settle back, and when, as it settles, its sheen sets off (s).
  var TIDE = 4.5, VORTEX = { rise: 0.45, settle: 0.65, shine: 0.7 };
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
  // A sheen is also a gust of wind (see the vertex shader); it lasts its sweep and SHEEN_AFTER more seconds, while
  // the dust it blew off flares and fades and the dots it took re-form in place.
  var SHEEN_FIRST = 1.9, SHEEN_SWEEP = 1.4, SHEEN_AFTER = 3.6;
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

  // Tide's entrance `t` s after its surge began: the dots' vortex, 0 to 1 over VORTEX.rise and back to 0 over
  // VORTEX.settle, on --ease-in-out (the shader's u_vortex).
  function vortex(t) {
    if (!(t > 0) || t >= VORTEX.rise + VORTEX.settle) return 0;
    return t < VORTEX.rise ? easeInOut(t / VORTEX.rise) : easeInOut(1 - (t - VORTEX.rise) / VORTEX.settle);
  }
  // Tide's tide at `t` s on its clock (the shader's u_tide): how far up the figure its band of light has risen, as a
  // share of the figure's height from just below the base to just above the caduceus, and how strong it is. Like the
  // light that rises up the page's sheet lines (the CSS's tide-rise), it rises over the first three quarters of each
  // period, strongest early on, and is gone by the end.
  function tide(t) {
    var at = (((t % TIDE) + TIDE) % TIDE) / TIDE;
    return [-0.08 + 1.16 * easeInOut(clamp(at / 0.75, 0, 1)), 0.35 * smoothstep(0, 0.15, at) * (1 - smoothstep(0.55, 0.75, at))];
  }

  // The figure's life: the small motions that make the statue breathe and stir. Each part of the statue (hero.json
  // `parts`; the caduceus below the fist is a part of its own, the staff, so the snakes can move while its small wings
  // beat) moves as a rigid body about a joint (hero.json `joints`, figure units, y down): the torso breathes, scaling
  // about the chest and lifting, once every LIFE.breath seconds (in for the first 42% of the cycle, out for the rest,
  // as a breath goes), and the head rides on it; the arms hang from the shoulders and follow at half; the big wing
  // opens and closes about its root over LIFE.wing seconds, out of step with the breath, and tilts a little in depth
  // as it does; the caduceus's small wings beat about the staff's top over LIFE.flutter seconds (the shader mirrors
  // the turn either side of the staff); the outstretched arm turns about its shoulder by a hair over LIFE.reach
  // seconds; the base, the clouds, holds its place. The key light drifts by a few degrees over LIFE.key seconds, as
  // if clouds passed the sun. `life()` works it all out once a frame, as the shader's uniforms: `parts`, per label
  // (0 none, then hero.json's parts, then the staff), the turn about the joint as (cos - 1, sin), then the shift, and
  // `joints`, the joint and (scale - 1, the tilt in depth per unit of distance), all in the shader's space (the pivot
  // at the origin, y up); `key`, the light's direction; `breath`, -1 to 1. `ease` (0..1) is how much of the life shows:
  // at 0 everything is exactly at rest, so the drawn figure is the still one.
  var PART_NAMES = ["wing", "caduceus", "arm", "head", "torso", "reach", "base", "staff"];
  var LIFE = { breath: 4.5, wing: 7.3, flutter: 5.2, reach: 9.7, key: 25 };
  var BREATH = { scale: 0.005, lift: 0.0025 }, WING = { turn: 0.03, tilt: 0.6 }, FLUTTER = 0.0105, REACH_TURN = 0.004, KEY_DRIFT = [0.07, 0.035];
  // The caduceus below this height (figure units, the top of the fist) is the staff.
  var STAFF_FROM = 0.29;
  // The currents of light over the surface (the vertex shader): how much they brighten and shade the stone (a share of
  // the dots' size and light), how far the dots ride them, all together (in dots), how far the curls sway (figure
  // units), and how far every dot drifts on its slow swells (CSS px); and how far the snakes sway about the staff
  // (figure units).
  var CURRENTS = { glow: 0.1, ride: 0.5, curls: 0.002, drift: 0.3 }, SNAKES = 0.003;
  // How strongly the silk's colours flow across the figure once it lives (the vertex shader): 1 is each material's
  // own share of them.
  var SILK = 1;
  function breathAt(t) {
    var q = ((t / LIFE.breath) % 1 + 1) % 1;
    return 2 * (q < 0.42 ? smoothstep(0, 0.42, q) : 1 - smoothstep(0.42, 1, q)) - 1;
  }
  function life(t, joints, pivot, ease) {
    var n = PART_NAMES.length + 1, parts = new Float32Array(n * 4), places = new Float32Array(n * 4), key = keyLight(0, 0);
    var out = { parts: parts, joints: places, key: key, breath: 0 };
    if (!(ease > 0) || !joints) return out;
    var at = function (name) { return joints[name] || pivot; };
    var breath = breathAt(t) * ease, core = at("torso");
    out.breath = breath;
    // the torso's displacement at a point (figure units, y down): its scale about the chest and its lift
    var scale = BREATH.scale * breath, lift = -BREATH.lift * breath;
    var carried = function (q, share) { return [(q[0] - core[0]) * scale * share, ((q[1] - core[1]) * scale + lift) * share]; };
    var wingTurn = WING.turn * Math.sin(TAU * t / LIFE.wing + 1.2) * ease;
    var motion = {
      torso: { scale: scale },
      head: { shift: carried(at("head"), 1) },
      arm: { shift: carried(at("arm"), 0.5) },
      caduceus: { shift: carried(at("arm"), 0.5), turn: FLUTTER * Math.sin(TAU * t / LIFE.flutter) * ease },
      staff: { shift: carried(at("arm"), 0.5) },
      wing: { shift: carried(at("wing"), 0.5), turn: wingTurn, tilt: WING.tilt * wingTurn },
      reach: { shift: carried(at("reach"), 0.5), turn: REACH_TURN * Math.sin(TAU * t / LIFE.reach + 2.5) * ease }
    };
    PART_NAMES.forEach(function (name, i) {
      var m = motion[name], j = at(name), o = (i + 1) * 4;
      if (!m) return;
      // a turn counter-clockwise on the page (figure units, y down) is clockwise with y up; a shift down is a shift
      // down the shader's y
      var turn = m.turn || 0, shift = m.shift || [0, 0];
      parts[o] = Math.cos(turn) - 1;
      parts[o + 1] = -Math.sin(turn);
      parts[o + 2] = shift[0];
      parts[o + 3] = -shift[1];
      places[o] = j[0] - pivot[0];
      places[o + 1] = pivot[1] - j[1];
      places[o + 2] = m.scale || 0;
      places[o + 3] = m.tilt || 0;
    });
    out.key = keyLight(KEY_DRIFT[0] * Math.sin(TAU * t / LIFE.key) * ease, KEY_DRIFT[1] * Math.sin(TAU * t / (LIFE.key * 1.5) + 1) * ease);
    return out;
  }
  // The key light's direction, turned from its rest (LIGHT, the upper left, in front) by `yaw` and `pitch` (radians).
  function keyLight(yaw, pitch) {
    var q = rotate(LIGHT, yaw, pitch), l = Math.hypot(q[0], q[1], q[2]);
    return [q[0] / l, q[1] / l, q[2] / l];
  }
  // The staff's axis (figure units, y down), from the top of the caduceus down to the staff's foot: where it starts and
  // how far it leans per unit of height, for the shader (u_staff), so the snakes can coil about a staff that holds still
  // and the caduceus's small wings can beat either side of it.
  function staffAxis(joints) {
    if (!joints || !joints.caduceus || !joints.staff) return [0, 0, 0];
    var top = joints.caduceus, foot = joints.staff;
    return [top[0], top[1], foot[1] > top[1] ? (foot[0] - top[0]) / (foot[1] - top[1]) : 0];
  }

  // The opening, when the page is opened (opts.intro), in seconds: the figure holds still in its ink for `hold`; a
  // slower shine crosses it and leaves its colors in its wake; the sway runs `rate` times as fast until the figure has
  // turned once and come back to the middle (half a sway on its clock). From light or dark paper the page then goes
  // to Gear Two; as the switch settles a shine crosses the red figure, the figure turns once more the other way at
  // `redRate`, and the page comes back. `wait` bounds each wait for the page to switch.
  var INTRO = { hold: 2, sweep: 1.4, rate: 2.5, red: 0.55, redSweep: 1.1, redRate: 3.2, wait: 2 };
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
    if (state.stage === "redshine" && age >= INTRO.redSweep) return to("redturn");
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

  // On screens of 1.5 device pixels per CSS pixel or more, the whole figure is stippled on a grid twice as fine, four
  // cells where one would be, with dots 62% the size (the vertex shader), so the feathers, the snakes, the curls, the
  // fingers, the muscles, and the billows are drawn as finely as the face. Each cell keeps its tone: where the dots
  // stand apart, four dots 62% the size would cover 4 × 0.62² ≈ 1.54 times the paper one dot does, so a fine cell is
  // kept against the ink times FINE_INK; where the ink is dense, dots that small leave the paper showing between
  // them, so a fine dot grows with its ink, by up to FINE_GROW of the way back to full size, and a shadow is as solid
  // as on the coarse grid. fineScale is what a dot carries to the vertex shader (a_e.z): 0 for a full-size dot, 1 for
  // a dot 62% the size.
  var FINE_INK = 1 / (4 * 0.62 * 0.62), FINE_GROW = 0.65;
  function fineScale(fine, ink) { return fine ? 1 - FINE_GROW * ink * ink : 0; }

  // Threshold stippling: every cell of a res x res grid over the figure (twice as fine when `fine`) keeps a dot when
  // its ink (green channel, bilinear from the size x size map) beats the tiled blue-noise threshold. Output is
  // [x, y, ink] per dot with x, y in figure units (0..1). What else a dot carries is sampled from the other maps.
  // `strokes` (optional, from strokes()): where it gives a direction, a kept cell seeds a short stroke of STROKE dots one
  // cell apart along it instead of one dot, kept against a third of the ink so the tone holds: an engraving's hatching.
  var STROKE = 3;
  function stipple(rgba, size, noise, noiseSize, res, density, jitter, fine, strokes) {
    var n = fine ? res * 2 : res, kept = fine ? density * FINE_INK : density, last = size - 1, scale = last / n;
    var out = new Float32Array(1 << 16), count = 0, at = new Int32Array(n), frac = new Float64Array(n), x, y;
    // where each column (and row) of the grid samples the map: the pixel before it and how far past it
    for (var g = 0; g < n; g++) { var u = (g + 0.5) * scale; at[g] = Math.floor(u); frac[g] = u - at[g]; }
    // the first and last column of each map row that holds any ink: a cell that reads only pixels outside them is
    // empty, so each row of the grid skips the paper on either side of the figure
    var from = new Int32Array(size).fill(size), to = new Int32Array(size).fill(-1);
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (rgba[(y * size + x) * 4 + 1]) { if (from[y] === size) from[y] = x; to[y] = x; }
    for (var gy = 0; gy < n; gy++) {
      var i0 = at[gy], fy = frac[gy], i1 = Math.min(i0 + 1, last), lo = Math.min(from[i0], from[i1]), hi = Math.max(to[i0], to[i1]);
      if (hi < 0) continue;
      for (var gx = Math.max(0, Math.floor((lo - 1) / scale - 0.5)), end = Math.min(n - 1, Math.ceil((hi + 1) / scale)); gx <= end; gx++) {
        var j0 = at[gx], fx = frac[gx], j1 = Math.min(j0 + 1, last);
        var a = (i0 * size + j0) * 4, b = (i0 * size + j1) * 4, c = (i1 * size + j0) * 4, d = (i1 * size + j1) * 4;
        var ink = (rgba[a + 1] * (1 - fx) * (1 - fy) + rgba[b + 1] * fx * (1 - fy) + rgba[c + 1] * (1 - fx) * fy + rgba[d + 1] * fx * fy) / 255;
        var dir = strokes ? strokes.angle[Math.round((gy + 0.5) / n * (strokes.size - 1)) * strokes.size + Math.round((gx + 0.5) / n * (strokes.size - 1))] : NaN;
        var run = dir === dir ? STROKE : 1;
        if (ink <= 0 || ink * kept / run <= noise[(gy % noiseSize) * noiseSize + (gx % noiseSize)] / 255) continue;
        var k = gy * n + gx;
        var jx = jitter ? (hash(k * 2 + 1) - 0.5) * jitter : 0;
        var jy = jitter ? (hash(k * 2 + 2) - 0.5) * jitter : 0;
        if (count + 3 * run > out.length) { var grown = new Float32Array(out.length * 2 + 3 * run); grown.set(out); out = grown; }
        for (var r = 0; r < run; r++) {
          var along = r - (run - 1) / 2;
          out[count++] = (gx + 0.5 + jx + (run > 1 ? Math.cos(dir) * along : 0)) / n;
          out[count++] = (gy + 0.5 + jy + (run > 1 ? Math.sin(dir) * along : 0)) / n;
          out[count++] = ink;
        }
      }
    }
    return out.slice(0, count);
  }

  // How far each pixel of the figure is from its outline and which way is out: the nearest pixel outside the figure
  // (on the depth map's mask, red 0), carried from neighbour to neighbour in two sweeps over the map. Output is
  // [distance in pixels, outward direction as a fraction of a turn, y down] per pixel; outside pixels are [0, 0].
  function outlineField(rgba, size) {
    var n = size * size, bx = new Int32Array(n), by = new Int32Array(n), d = new Float64Array(n), out = new Float32Array(n * 2);
    var x, y, i, k;
    for (i = 0; i < n; i++) {
      if (rgba[i * 4] > 0) { d[i] = Infinity; bx[i] = by[i] = -1; }
      else { bx[i] = i % size; by[i] = (i - bx[i]) / size; }
    }
    var take = function (i, x, y, j) {
      if (bx[j] < 0) return;
      var e = (x - bx[j]) * (x - bx[j]) + (y - by[j]) * (y - by[j]);
      if (e < d[i]) { d[i] = e; bx[i] = bx[j]; by[i] = by[j]; }
    };
    var ahead = [[-1, -1], [0, -1], [1, -1], [-1, 0]], behind = [[1, 0], [-1, 1], [0, 1], [1, 1]];
    for (var pass = 0; pass < 2; pass++) {
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
        i = y * size + x;
        if (d[i] === 0) continue;
        for (k = 0; k < 4; k++) { var ax = x + ahead[k][0], ay = y + ahead[k][1]; if (ax >= 0 && ay >= 0 && ax < size) take(i, x, y, ay * size + ax); }
      }
      for (y = size - 1; y >= 0; y--) for (x = size - 1; x >= 0; x--) {
        i = y * size + x;
        if (d[i] === 0) continue;
        for (k = 0; k < 4; k++) { var cx = x + behind[k][0], cy = y + behind[k][1]; if (cx >= 0 && cx < size && cy < size) take(i, x, y, cy * size + cx); }
      }
    }
    for (i = 0; i < n; i++) {
      if (d[i] === 0 || bx[i] < 0) continue;
      x = i % size; y = (i - x) / size;
      var t = Math.atan2(by[i] - y, bx[i] - x) / TAU;
      out[i * 2] = Math.sqrt(d[i]);
      out[i * 2 + 1] = t < 0 ? t + 1 : t;
    }
    return out;
  }

  // Whether a point (figure units) lies inside any of `zones`, ellipses [x, y, rx, ry, turn] in figure units and radians.
  function withinZones(zones, x, y) {
    for (var i = 0; zones && i < zones.length; i++) {
      var z = zones[i], dx = x - z[0], dy = y - z[1], c = Math.cos(z[4]), s = Math.sin(z[4]);
      var u = (dx * c + dy * s) / z[2], v = (dy * c - dx * s) / z[3];
      if (u * u + v * v <= 1) return true;
    }
    return false;
  }

  // The avatar's own star glints: the points of its sparkle (the color map's alpha above its floor of 128) that are
  // brighter than everything within two pixels and round, not drawn out along the edge of a highlight (over two pixels
  // each way the weaker curvature is at least a third of the stronger), on the wings, the caduceus, the rubble, the
  // lightning, and the clouds, where the avatar's stars are, and not on its marble, where a highlight is the light on
  // the skin, nor in the hair or on a hand (inside `zones`: the head's and the hands' ellipses, `features` in
  // hero.json); or within eight pixels
  // outside the figure, where the sky's are. Output is [x, y, strength] per glint, x and y in figure units, strongest
  // first, at most `limit`.
  function glints(rgba, relief, size, limit, zones) {
    var n = size * size, sp = new Float32Array(n), near = new Uint8Array(n), last = size - 1, x, y, i, dx, dy, found = [];
    for (i = 0; i < n; i++) sp[i] = Math.max(0, (rgba[i * 4 + 3] - 128) / 127);
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) {
      if (!(relief[(y * size + x) * 4] > 0)) continue;
      for (dy = -8; dy <= 8; dy++) for (dx = -8; dx <= 8; dx++) {
        var nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < size && ny < size && dx * dx + dy * dy <= 64) near[ny * size + nx] = 1;
      }
    }
    for (y = 2; y < size - 2; y++) for (x = 2; x < size - 2; x++) {
      i = y * size + x;
      var v = sp[i];
      if (v < 0.3 || !near[i] || (relief[i * 4] > 0 && rgba[i * 4] === MARBLE) || withinZones(zones, x / last, y / last)) continue;
      var peak = true;
      for (dy = -2; dy <= 2 && peak; dy++) for (dx = -2; dx <= 2; dx++) {
        var u = sp[i + dy * size + dx];
        if ((dx || dy) && (u > v || (u === v && (dy < 0 || (dy === 0 && dx < 0))))) { peak = false; break; }
      }
      if (!peak) continue;
      var cxx = sp[i - 2] + sp[i + 2] - 2 * v, cyy = sp[i - 2 * size] + sp[i + 2 * size] - 2 * v;
      var cxy = (sp[i + 2 * size + 2] - sp[i + 2 * size - 2] - sp[i - 2 * size + 2] + sp[i - 2 * size - 2]) / 4;
      var half = (cxx + cyy) / 2, spread = Math.sqrt(Math.max(0, half * half - (cxx * cyy - cxy * cxy)));
      var strong = half - spread, weak = half + spread;
      if (!(strong < 0) || weak / strong < 1 / 3) continue;
      found.push([x / last, y / last, v]);
    }
    found.sort(function (a, b) { return b[2] - a[2] || a[1] - b[1] || a[0] - b[0]; });
    var out = new Float32Array(Math.min(limit, found.length) * 3);
    for (i = 0; i < out.length / 3; i++) out.set(found[i], i * 3);
    return out;
  }

  // The direction of the feathers and the coils, for stippling them in strokes (stipple()): the structure tensor of the
  // dot map (blurred by `sigma` px, at the depth map's size), its direction of least change, wherever it is clear (the
  // tensor's coherence over a third) inside the parts named `plumed` (the wing and the caduceus); NaN elsewhere.
  // Returns { angle: radians per pixel of the depth map, y down, size }.
  function strokes(map, mapSize, depth, size, parts, plumed, sigma) {
    var n = size * size, angle = new Float32Array(n).fill(NaN), wanted = {}, any = false, i, x, y;
    (plumed || []).forEach(function (name) { var k = (parts || []).indexOf(name) + 1; if (k > 0) wanted[k] = true; });
    var x0 = size, y0 = size, x1 = -1, y1 = -1;
    for (i = 0; i < n; i++) if (wanted[partOf(depth, i)]) { any = true; x = i % size; y = (i - x) / size; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (!any) return { angle: angle, size: size };
    var r = Math.ceil(sigma * 3), pad = r + 2;
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(size - 1, x1 + pad); y1 = Math.min(size - 1, y1 + pad);
    var w = x1 - x0 + 1, h = y1 - y0 + 1, tone = new Float32Array(w * h), step = (mapSize - 1) / (size - 1);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) tone[y * w + x] = map[(Math.round((y + y0) * step) * mapSize + Math.round((x + x0) * step)) * 4 + 1] / 255;
    var at = function (a, x, y) { return a[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)]; };
    var xx = new Float32Array(w * h), yy = new Float32Array(w * h), xy = new Float32Array(w * h);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var gx = (at(tone, x + 1, y) - at(tone, x - 1, y)) / 2, gy = (at(tone, x, y + 1) - at(tone, x, y - 1)) / 2;
      xx[y * w + x] = gx * gx; yy[y * w + x] = gy * gy; xy[y * w + x] = gx * gy;
    }
    var kernel = [], sum = 0, j;
    for (j = -r; j <= r; j++) { kernel.push(Math.exp(-j * j / (2 * sigma * sigma))); sum += kernel[j + r]; }
    var blur = function (a) {
      var tmp = new Float32Array(w * h), out = new Float32Array(w * h), acc;
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { acc = 0; for (j = -r; j <= r; j++) acc += at(a, x + j, y) * kernel[j + r]; tmp[y * w + x] = acc / sum; }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) { acc = 0; for (j = -r; j <= r; j++) acc += at(tmp, x, y + j) * kernel[j + r]; out[y * w + x] = acc / sum; }
      return out;
    };
    xx = blur(xx); yy = blur(yy); xy = blur(xy);
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var g = (y + y0) * size + x + x0;
      if (!wanted[partOf(depth, g)]) continue;
      var a = xx[y * w + x], b = yy[y * w + x], c = xy[y * w + x], spread = Math.sqrt((a - b) * (a - b) + 4 * c * c);
      if (spread < (a + b) / 3 || !(a + b > 1e-6)) continue;
      angle[g] = 0.5 * Math.atan2(2 * c, a - b) + Math.PI / 2;
    }
    return { angle: angle, size: size };
  }

  // The underpaint: an even grid of discs in the paper's colour, drawn before the dots, that fills the statue and the
  // heart of its clouds, so what lies behind the figure on the page (the sheet's lines) stops at its edge instead of
  // showing through the stone between the dots. `outline` is outlineField()'s, `field` the blurred parts edges()
  // returns (the statue reaches to their half level), `bank` the colour map or null (its blue names the cloud bank,
  // drawn in Gear Two alone, which has none), `step` and `radius` the grid's spacing and each disc's radius, in px of
  // the map. Output is [x, y, alpha] per disc, x and y in figure units: full inside the statue, fading out over its
  // last `radius` px so no disc reaches past the outline, and in the clouds rising slowly from their soft edge over
  // UNDER_CLOUD px.
  var UNDER = 4, UNDER_CLOUD = 14;
  function underpaint(rgba, size, outline, field, parts, bank, step, radius) {
    var out = [], last = size - 1, base = (parts || []).indexOf("base") + 1;
    for (var y = step / 2; y <= last; y += step) for (var x = step / 2; x <= last; x += step) {
      var i = Math.round(y) * size + Math.round(x);
      if (!rgba[i * 4] || (bank && bank[i * 4 + 2] > 127)) continue;
      var d = outline[i * 2], a;
      if (partOf(rgba, i) === base) a = smoothstep(radius, radius + UNDER_CLOUD, d);
      else if (field && field[i] < 0.5) continue;
      else a = smoothstep(0.5, radius + 0.5, d);
      if (a > 0.02) out.push(x / last, y / last, a);
    }
    return new Float32Array(out);
  }

  // The stars of the avatar's sky, which build.py writes into the depth map's blue outside the figure (1 + 254 x a
  // star's strength at its pixel, 0 elsewhere; inside the figure the blue names the parts). Output is [x, y, strength]
  // per star, x and y in figure units, in map order.
  function skyStars(rgba, size) {
    var out = [], last = size - 1;
    for (var i = 0; i < size * size; i++) if (rgba[i * 4 + 2] && !rgba[i * 4]) out.push((i % size) / last, Math.floor(i / size) / last, (rgba[i * 4 + 2] - 1) / 254);
    return new Float32Array(out);
  }

  // The part under each pixel of the depth map: inside the figure its blue is the part's number (in hero.json's
  // `parts`) times PART_STEP, less half a step where the figure is only its soft fringe, outside the statue's edge.
  var PART_STEP = 32;
  function partOf(rgba, i) { return rgba[i * 4] ? Math.round(rgba[i * 4 + 2] / PART_STEP) : 0; }

  // Marching squares: for each pattern of a cell's corners inside (1 top left, 2 top right, 4 bottom right, 8 bottom
  // left), the cell's sides that the level line joins, in pairs (0 top, 1 right, 2 bottom, 3 left).
  var MARCH = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 0, 1, 2], [0, 2], [3, 2], [2, 3], [0, 2], [0, 1, 2, 3], [1, 2], [3, 1], [0, 1], [3, 0], []];
  // The statue's edges, so it has a clear outline instead of ending wherever its stipple thins out. Each part of the
  // statue (all the parts in `parts` but the base, the clouds, which keep their soft fade) is the solid pixels it
  // holds, blurred by a Gaussian of `sigma` px and traced at its half level (marching squares). A point of the trace is
  // kept where what lies just beyond it, up to four pixels out, is the sky, or a part this one is in front of (`over`,
  // pairs of names from hero.json: the raised arm over the wing, the outstretched arm before the clouds), so a part that
  // grows out of its neighbour (an arm out of its shoulder) has no line there. Each stretch of the trace is resampled
  // every `spacing` px of the map. Returns { points: [x, y, out] per point, x and y in figure units and `out` which way
  // is out of the part as a fraction of a turn, y down; parts: the part each point belongs to (its number in `parts`,
  // 1-based); inner: 1 where the point's edge lies across another part, 0 where it meets the sky; field: the statue's
  // blurred parts at their strongest, per pixel, whose half level is the outline, for clipping the stipple to it }.
  function edges(rgba, size, parts, over, sigma, spacing) {
    var n = size * size, last = size - 1, label = new Uint8Array(n), solid = new Uint8Array(n), field = new Float32Array(n), out = [], owners = [], across = [];
    for (var i = 0; i < n; i++) { label[i] = partOf(rgba, i); solid[i] = label[i] && rgba[i * 4 + 2] % PART_STEP === 0 ? 1 : 0; }
    var front = {}, base = (parts || []).indexOf("base") + 1;
    (over || []).forEach(function (pair) { front[((parts || []).indexOf(pair[0]) + 1) + "," + ((parts || []).indexOf(pair[1]) + 1)] = true; });
    var r = Math.ceil(sigma * 3), kernel = [], sum = 0, j;
    for (j = -r; j <= r; j++) { kernel.push(Math.exp(-j * j / (2 * sigma * sigma))); sum += kernel[j + r]; }
    for (var p = 1; p <= Math.max(1, (parts || []).length); p++) {
      if (p === base) continue;
      var x0 = size, y0 = size, x1 = -1, y1 = -1, x, y;
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (solid[y * size + x] && label[y * size + x] === p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) continue;
      x0 = Math.max(0, x0 - r - 2); y0 = Math.max(0, y0 - r - 2); x1 = Math.min(last, x1 + r + 2); y1 = Math.min(last, y1 + r + 2);
      var w = x1 - x0 + 1, h = y1 - y0 + 1, tmp = new Float32Array(w * h), soft = new Float32Array(w * h);
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var acc = 0;
        for (j = Math.max(-r, -x); j <= r && x + j < w; j++) { var k = (y + y0) * size + x + j + x0; if (solid[k] && label[k] === p) acc += kernel[j + r]; }
        tmp[y * w + x] = acc / sum;
      }
      for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
        var acc2 = 0;
        for (j = Math.max(-r, -y); j <= r && y + j < h; j++) acc2 += tmp[(y + j) * w + x] * kernel[j + r];
        soft[y * w + x] = acc2 / sum;
        var g = (y + y0) * size + x + x0;
        if (acc2 / sum > field[g]) field[g] = acc2 / sum;
      }
      var at = function (x, y) { return soft[clamp(y, 0, h - 1) * w + clamp(x, 0, w - 1)]; };
      for (y = 0; y < h - 1; y++) for (x = 0; x < w - 1; x++) {
        var v = [at(x, y), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1)];
        var cell = MARCH[(v[0] >= 0.5 ? 1 : 0) | (v[1] >= 0.5 ? 2 : 0) | (v[2] >= 0.5 ? 4 : 0) | (v[3] >= 0.5 ? 8 : 0)];
        for (var c = 0; c < cell.length; c += 2) {
          var a = cross(v, x, y, cell[c]), b = cross(v, x, y, cell[c + 1]);
          var steps = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / spacing));
          for (var s = 0; s < steps; s++) {
            var t = (s + 0.5) / steps, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, fx = Math.floor(px), fy = Math.floor(py);
            // which way is out: down the blurred part's slope
            var gx = at(fx + 1, fy) - at(fx - 1, fy) + at(fx + 1, fy + 1) - at(fx - 1, fy + 1);
            var gy = at(fx, fy + 1) - at(fx, fy - 1) + at(fx + 1, fy + 1) - at(fx + 1, fy - 1), gl = Math.hypot(gx, gy) || 1;
            var ox = -gx / gl, oy = -gy / gl, keep = true, inner = 0;
            for (var d = 1; d <= 4; d++) {
              var sx = Math.round(px + x0 + ox * d), sy = Math.round(py + y0 + oy * d);
              if (sx < 0 || sy < 0 || sx > last || sy > last) break;
              var q = label[sy * size + sx];
              if (!q) break;
              if (q === p) continue;
              keep = !!front[p + "," + q];
              inner = 1;
              break;
            }
            if (!keep) continue;
            var turn = Math.atan2(oy, ox) / TAU;
            out.push((px + x0) / last, (py + y0) / last, turn < 0 ? turn + 1 : turn);
            owners.push(p);
            across.push(inner);
          }
        }
      }
    }
    return { points: new Float32Array(out), parts: Uint8Array.from(owners), inner: Uint8Array.from(across), field: field };
  }
  // where the half level crosses side `e` of the cell at (x, y), whose corners (clockwise from the top left) hold `v`
  function cross(v, x, y, e) {
    var t = (0.5 - v[e]) / (v[(e + 1) % 4] - v[e]);
    return e === 0 ? [x + t, y] : e === 1 ? [x + 1, y + t] : e === 2 ? [x + 1 - t, y + 1] : [x, y + 1 - t];
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
  // STARS_BRIGHT on light and dark paper, where the shine is stronger.
  var STARS = 14, STARS_BRIGHT = 20, LIGHT = [-0.45, 0.6, 0.66];
  // GLINTS is how many of the avatar's star glints the figure draws at most, strongest first.
  var GLINTS = 260;
  // The statue's outline (edges()): its parts blurred by EDGE_BLUR px of the depth map and traced, a point every
  // EDGE_SPACING CSS px of the drawn figure.
  var EDGE_BLUR = 1.2, EDGE_SPACING = 0.75;
  // The parts stippled in strokes along their feathers and coils (strokes()), and how far their direction is smoothed,
  // in px of the depth map.
  var PLUMED = ["wing", "caduceus"], STROKE_BLUR = 3;
  // STRIKE is how long the opening's strike of lightning lights the figure and runs its ring through it, in seconds (the
  // shader's 1.3).
  var STRIKE = 1.3;
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
  // Bytes per dot in the vertex buffer (see initialize).
  var VERTEX = 36;
  // Depth of the figure in figure units (its width is 1): the vertex shader and the normals share it.
  var RELIEF = 0.34;
  function project(p) {
    var k = FOCAL / (FOCAL - p[2]);
    return [p[0] * k, p[1] * k, k];
  }

  // A sheen's light is a sheet that sweeps the figure from the key light's side (the upper left, in front) to the lower
  // right, behind (WAY, which weighs the depth more than the key light's own direction does), so the line where it cuts
  // the statue bends over the forms: a near arm or the head catches it before the wing behind them. DRIFT is that way
  // on the screen (y down), where the gust blows the dust it lifts. The sheet starts and ends WAY_MARGIN of the sweep
  // outside the figure.
  var WAY = (function () { var l = Math.hypot(0.45, 0.6, 1.0); return [0.45 / l, -0.6 / l, -1.0 / l]; })();
  var DRIFT = (function () { var l = Math.hypot(WAY[0], WAY[1]); return [WAY[0] / l, -WAY[1] / l]; })();
  var WAY_MARGIN = 0.12;
  // Where along WAY the figure lies as it is turned: its box (the statue's bounds, the clouds below them, its relief's
  // depth) turned by yaw and pitch about the centre, from its nearest reach (lo) to its farthest (lo + 1 / k).
  function sheenWay(meta, yaw, pitch) {
    var lo = Infinity, hi = -Infinity, b = meta.bounds, c = meta.center;
    [b[0] - 0.04, b[2] + 0.04].forEach(function (x) {
      [b[1], 1].forEach(function (y) {
        [(0 - 0.62) * RELIEF, (1 - 0.62) * RELIEF].forEach(function (z) {
          var q = rotate([x - c[0], c[1] - y, z], yaw, pitch), d = q[0] * WAY[0] + q[1] * WAY[1] + q[2] * WAY[2];
          if (d < lo) lo = d;
          if (d > hi) hi = d;
        });
      });
    });
    return { lo: lo, k: 1 / (hi - lo) };
  }
  // How far along the sweep (0 to 1, margins included) the light reaches a point of the turned figure (the shader's way()).
  function wayAt(q, lane) {
    return ((q[0] * WAY[0] + q[1] * WAY[1] + q[2] * WAY[2] - lane.lo) * lane.k + WAY_MARGIN) / (1 + 2 * WAY_MARGIN);
  }

  /* ── shaders ──────────────────────────────────────────── */

  var VERT = [
    "#version 300 es",
    "precision highp float;",
    "layout(location = 0) in vec4 a_p;",
    "layout(location = 1) in vec2 a_n;",
    "layout(location = 2) in vec4 a_c;",
    "layout(location = 3) in vec4 a_e;",
    "layout(location = 4) in vec4 a_w;",
    "uniform vec2 u_res;",
    "uniform vec3 u_box;",
    "uniform vec2 u_pivot;",
    "uniform float u_depth;",
    "uniform vec2 u_rot;",
    "uniform float u_time;",
    "uniform float u_build;",
    "uniform vec4 u_pointer;",
    "uniform vec4 u_rip[4];",
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
    "uniform vec2 u_flow;",
    "uniform vec3 u_light[4];",
    "uniform float u_positive;",
    "uniform vec4 u_swap;",
    "uniform vec3 u_tone[2];",
    "uniform vec4 u_stir;",
    "uniform int u_strikes;",
    "uniform vec4 u_way;",
    "uniform vec2 u_wayk;",
    "uniform float u_sky;",
    "uniform int u_tiles;",
    "uniform vec2 u_wind;",
    "uniform float u_bank;",
    "uniform float u_vortex;",
    "uniform vec2 u_tide;",
    "uniform vec4 u_parts[9];",
    "uniform vec4 u_joints[9];",
    "uniform vec4 u_staff;",
    "uniform vec4 u_life;",
    "uniform vec4 u_key;",
    "uniform vec4 u_ember;",
    "uniform vec3 u_paper;",
    "uniform vec3 u_silk[3];",
    "uniform float u_silkw;",
    "uniform float u_under;",
    "flat out float v_alpha;",
    "flat out float v_size;",
    "flat out float v_star;",
    "flat out vec2 v_heading;",
    "flat out float v_flare;",
    "flat out float v_sprite;",
    "flat out vec3 v_color;",
    "flat out float v_glint;",
    "uint h(uint x) { x ^= x >> 16; x *= 0x7feb352dU; x ^= x >> 15; x *= 0x846ca68bU; x ^= x >> 16; return x; }",
    "float r01(uint x) { return float(h(x)) / 4294967296.0; }",
    // How far along a sheen's way a point of the turned figure lies, as a share of the sweep: its light is a plane that
    // moves along the light's direction (u_way.xyz, from the key light at the upper left, in front, towards the lower
    // right, behind; u_way.w and u_wayk.x put the figure's nearest and farthest reach at 0 and 1), so the band's line
    // bends over the forms, reaching a near arm before the wing behind it; u_wayk.y is the margin either side of the
    // figure the band starts and ends in.
    "float way(vec3 q) { return ((dot(q, u_way.xyz) - u_way.w) * u_wayk.x + u_wayk.y) / (1.0 + 2.0 * u_wayk.y); }",
    "void main() {",
    "  uint id = uint(gl_VertexID);",
    "  float s1 = r01(id * 3u + 1u), s2 = r01(id * 3u + 2u), s3 = r01(id * 3u + 3u);",
    // the dots that only the cloud bank holds (a_e.x) are drawn in Gear Two alone (u_bank, eased over the switch)
    "  float hidden = a_e.x * (1.0 - u_bank);",
    // the statue's outline (a_w.x): a fine line of points that holds its place in the wind
    "  bool edge = a_w.x > 0.5;",
    // the underpaint (a_w.y): discs in the paper's colour under the dots, so the sheet's lines stop at the statue's edge
    "  bool under = a_w.y > 0.5;",
    "  vec3 p = vec3(a_p.x - u_pivot.x, u_pivot.y - a_p.y, (a_p.z - 0.62) * u_depth);",
    // the figure's life (life() in JS, once a frame): each part of the statue (a_e.y, its label) moves as a rigid body
    // about its joint (u_joints: the joint, the breath's scale, the wing's tilt in depth) by a small turn and shift
    // (u_parts: cos - 1 and sin of the turn, the shift), so the torso breathes, the head rides on it, the arms follow,
    // the big wing opens and closes, the outstretched arm turns by a hair; at rest every value is exactly zero and the
    // dot stays where it is. The caduceus's two small wings beat about the staff in opposite turns (the staff's axis,
    // u_staff: where it starts, how far it leans per unit of height, and the snakes' sway), and below the fist the two
    // snakes coil about a staff that holds still: they sway sideways with a wave running up the staff, pinned where
    // they cross it
    "  int part = int(a_e.y * 255.0 + 0.5);",
    "  vec4 T = u_parts[part], J = u_joints[part];",
    "  float off = a_p.x - u_staff.x - (a_p.y - u_staff.y) * u_staff.z;",
    "  T.y *= part == 2 ? sign(off) : 1.0;",
    "  vec2 arm = p.xy - J.xy;",
    "  p.xy += vec2(arm.x * T.x - arm.y * T.y, arm.x * T.y + arm.y * T.x) + arm * J.z + T.zw;",
    "  p.z += arm.x * J.w;",
    "  p.x += (part == 8 ? smoothstep(0.004, 0.016, abs(off)) * sin(u_time * 1.3 - a_p.y * 18.0) : 0.0) * u_staff.w;",
    // slow currents of light drift over the surface (u_life: their strength, how far the dots ride them, how far the
    // curls sway, all 0 while the figure holds still), like light through water: three waves in the figure's own
    // coordinates, each moving its own way at its own pace, brighten the surface where they crest and darken it in
    // their troughs, and the dots ride them a little along the wave, bunching towards the light, a few of them further,
    // like grains carried by a current; the curls (the head's gold) sway with the breeze (u_wind), rippling as they go
    "  float c1 = sin(dot(a_p.xy, vec2(11.0, 6.0)) - u_time * 0.5), c2 = sin(dot(a_p.xy, vec2(-7.0, 15.0)) + u_time * 0.37 + 1.7), c3 = sin(dot(a_p.xy, vec2(19.0, -9.0)) - u_time * 0.7 + 4.1);",
    "  float current = (c1 + 0.8 * c2 + 0.6 * c3) / 2.4;",
    "  float grain = (edge || under || a_e.w > 0.5) ? 0.0 : 1.0;",
    "  p.xy += (vec2(0.8779, -0.4789) * c1 + vec2(-0.3383, -0.7250) * c2 + vec2(0.5423, 0.2569) * c3) * u_life.y * grain;",
    "  p.xy += vec2(u_wind.x, -u_wind.y) * (0.65 + 0.35 * sin(u_time * 0.9 + a_p.y * 40.0 + a_p.x * 25.0)) * u_life.z * float(part == 4 && a_c.r < 0.1);",
    // assemble from a scattered shell, centre first
    "  float reach = length(p.xy);",
    "  float k = clamp((u_build - 0.15 - reach * 0.9 - s3 * 0.35) / 0.9, 0.0, 1.0);",
    "  float rest = (1.0 - k) * (1.0 - k);",
    "  k = 1.0 - rest * rest;",
    // (a point on the sphere from its height, cz, and the turn around it: no acos per dot)
    "  float th = s1 * 6.2831853, cz = 2.0 * s2 - 1.0, sz = sqrt(1.0 - cz * cz);",
    "  vec3 shell = vec3(sz * cos(th), cz, sz * sin(th)) * (0.9 + s3 * 0.6);",
    "  p = mix(shell, p, k);",
    // Tide's entrance (u_vortex, 0 to 1 and back over about a second): the dots lift off into a slow vortex round the
    // body's upright axis, each carried its own way round, and drawn in towards the axis the further out they lie, so
    // the figure swirls without flying apart, then settle back in place as the palette turns
    "  float swirl = u_vortex * (0.6 + 0.8 * s1) * 3.14159265, cw = cos(swirl), sw = sin(swirl);",
    "  p.xz = vec2(p.x * cw + p.z * sw, p.z * cw - p.x * sw) * (1.0 - 0.35 * u_vortex * smoothstep(0.0, 0.5, length(p.xz)));",
    "  p.y += 0.04 * u_vortex * s2;",
    // yaw then pitch, for the point and for its surface normal
    "  float cy = cos(u_rot.x), sy = sin(u_rot.x), cp = cos(u_rot.y), sp = sin(u_rot.y);",
    "  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);",
    "  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);",
    "  vec3 n = vec3(a_n, sqrt(max(0.0, 1.0 - dot(a_n, a_n))));",
    "  n.xz = vec2(n.x * cw + n.z * sw, n.z * cw - n.x * sw);",
    "  n = vec3(n.x * cy + n.z * sy, n.y, -n.x * sy + n.z * cy);",
    "  n = vec3(n.x, n.y * cp - n.z * sp, n.y * sp + n.z * cp);",
    // light from the upper left, in front. Where the dots are ink, lit stone gets smaller, fainter dots and grazing
    // edges heavier ones; where they are light (u_positive, on dark paper), lit stone gets larger, brighter dots and
    // the surface dims as it turns away, so the edges fall into the dark
    // (the key drifts by a few degrees as the figure lives, u_key, as if clouds passed the sun; at rest it is this one)
    "  float lam = max(0.0, dot(n, mix(normalize(vec3(-0.45, 0.6, 0.66)), u_key.xyz, u_key.w)));",
    "  float turned = 1.0 - clamp(n.z, 0.0, 1.0), rim = turned * turned * turned;",
    "  float shade = mix(mix(1.12, 0.84, lam) * (1.0 + 0.18 * rim), mix(0.88, 1.12, lam) * (1.0 - 0.3 * rim), u_positive);",
    "  float fade = mix(mix(1.0, 0.86, lam), mix(0.78, 1.0, lam) * (1.0 - 0.35 * rim), u_positive);",
    "  float persp = 3.2 / (3.2 - p.z);",
    "  vec2 px = u_box.xy + (u_pivot + vec2(p.x, -p.y) * persp) * u_box.z;",
    // the cursor stirs the dots like a hand through dust: within its reach (u_pointer: where it is, how strongly it
    // stirs as it eases in and out, and its reach) they turn about it in a slow eddy, give way a little, are dragged
    // along with its motion (u_stir: its velocity in px/s), and lift toward the viewer
    "  vec2 d = px - u_pointer.xy;",
    "  float dist = length(d) + 0.001;",
    "  float within = max(0.0, 1.0 - dist / u_pointer.w);",
    "  float push = within * within * u_pointer.z;",
    // (only the dots it reaches move: turning a dot about a cursor far away by nothing would still round its place)
    "  if (push > 0.0) {",
    "    float eddy = push * (0.45 + 0.15 * sin(u_time * 2.0 - dist * 0.04));",
    "    px = u_pointer.xy + vec2(d.x * cos(eddy) - d.y * sin(eddy), d.x * sin(eddy) + d.y * cos(eddy)) * (1.0 + 0.12 * push);",
    "    px += u_stir.xy * 0.05 * push;",
    "  }",
    "  float lift = push;",
    // in Gear Two the dots under the cursor run ember-hot (u_ember: how much, eased over the switch, and the ember's
    // colour): white-hot at its centre, ember at the edge of its reach, each in a soft glow of its own; nothing on touch
    // or under reduced motion, where the cursor stirs nothing (u_pointer.z is 0)
    "  float heat = within * within * u_pointer.z * u_ember.x;",
    // the opening's strike of lightning (u_rip: where, when, how strong) sends a ring out through the figure and lights it
    // up. The strikes still under way come first in their array (u_strikes: how many), and the loop runs over those
    // alone: a renderer without a GPU runs every line of a shader for every dot, taken or not, and skips only the turns
    // of a loop that no dot needs
    "  float strike = 0.0;",
    "  for (int i = 0; i < u_strikes; i++) {",
    "    vec4 r = u_rip[i];",
    "    float age = u_time - r.z;",
    "    if (r.w <= 0.0 || age < 0.0 || age > 1.3) continue;",
    "    vec2 e = px - r.xy;",
    "    float de = length(e) + 0.001;",
    "    float band = (de - age * 900.0) / 46.0;",
    "    float g = exp(-band * band) * (1.0 - age / 1.3) * r.w;",
    "    px += e / de * g * 16.0;",
    "    lift += g * 0.8;",
    "    strike = max(strike, exp(-age * 12.0) * r.w * max(0.0, 1.0 - de / 170.0));",
    "  }",
    // Gear Two glitch: shift horizontal slices, and tear out tiles that jump sideways and run hot
    "  float hot = 0.0;",
    "  if (u_glitch > 0.0) {",
    "    uint slice = uint(floor(px.y / 18.0 + 64.0));",
    "    uint frame = uint(floor(u_time * 24.0));",
    "    if (r01(slice * 31u + frame * 977u) < 0.35 * u_glitch) px.x += (r01(slice + frame * 13u) - 0.5) * 48.0 * u_glitch;",
    "    for (int i = 0; i < u_tiles; i++) {",
    "      vec4 tl = u_tile[i];",
    "      if (tl.z > 0.0 && px.x >= tl.x && px.x <= tl.x + tl.z && px.y >= tl.y && px.y <= tl.y + tl.w) { px += u_shift[i]; hot = 0.55; }",
    "    }",
    "  }",
    // Gear Two heartbeat: a few dots run white-hot at each beat
    "  if (u_beat > 0.45 && r01(id * 5u + 3u) < 0.035) hot = max(hot, u_beat);",
    // the dot's material in the mode's designed palette (gold, marble, cloud, lightning, glint), moving from
    // its base color to its lit one as the surface turns to the light; marble carries no weight, so it stays ink
    "  int m = int(a_c.r * 5.0 + 0.5);",
    // gold catches the light on the feathers' edges, which the dot maps draw as the sparse dots of the ink map and the
    // dense ones of the light map, and sits in their gaps as bronze (below), as well as turning to the light
    "  float edgeLit = m == 0 ? mix(1.0 - smoothstep(0.1, 0.45, a_p.w), smoothstep(0.45, 0.9, a_p.w), u_positive) : 0.0;",
    "  vec3 mat = mix(u_palette[m], u_lit[m], max(smoothstep(0.15, 0.9, lam), 0.8 * edgeLit));",
    // on light paper the densest dots of a material lean toward the ink, so gold has bronze in its crevices
    "  mat = mix(mat, u_color, u_deep * smoothstep(0.45, 0.95, a_p.w));",
    // at each turn of the sway a sheet of light sweeps the statue from the key light's side, the upper left, to the
    // lower right, through its depth (way(); u_sheen: its progress, whether it runs, its burst's number, and its age;
    // u_span.z the line's width as a share of the sweep). Where it cuts the surface it draws a bright line in the light's
    // colour, white-hot (or pale gold on white paper) at its middle, sharp ahead and softer behind, brightest where the
    // surface faces the light, its dots swelling and glowing; behind it a warm wash lands on the surfaces that face the
    // light while those turned away fall a little deeper into shadow, so the forms model as it passes; a thin fringe of a
    // complementary hue runs just ahead of it on the stone (u_light[3]), as light through a prism; surfaces that face it
    // squarely flash (the half-vector between the key light and the viewer); the most lit surfaces keep a soft afterglow;
    // and a few dots on the lit side twinkle into small four-point stars (u_flow: the share of the dots near the outline
    // its gust lifts off, the sweep's length, how brightly the dust flares, and 1 when the materials' colors should
    // appear only behind the line, as in the opening)
    "  float c = way(p), passed = clamp(c, 0.0, 1.0);",
    "  float band = 0.0, wash = 0.0, trail = 0.0, star = 0.0, wake = 1.0, fringe = 0.0, flash = 0.0, swell = 0.0;",
    "  if (u_sheen.y != 0.0) {",
    "    float e = (u_sheen.x - c) / u_span.z, behind = max(u_sheen.x - c, 0.0) * step(0.0, e), face = (0.35 + 0.65 * lam) * k;",
    "    band = exp(-e * e * (e < 0.0 ? 1.5 : 0.6)) * face;",
    "    wash = exp(-behind * 5.0) * step(0.0, e) * k;",
    "    fringe = exp(-(e + 1.8) * (e + 1.8) * 2.0) * face * (1.0 - a_c.g * u_tint) * smoothstep(0.0, 0.1, u_sheen.x);",
    "    float spec = max(dot(n, vec3(-0.2472, 0.3295, 0.9112)), 0.0);",
    "    spec *= spec; spec *= spec; spec *= spec; spec *= spec; spec *= spec;",
    "    flash = spec * exp(-e * e * 0.3) * k;",
    "    swell = band * smoothstep(0.6, 1.0, mix(lam, a_p.w, u_positive));",
    "    trail = exp(-behind * 2.5) * step(0.0, e) * smoothstep(0.4, 0.9, lam) * face * (1.0 - smoothstep(u_flow.x, u_flow.x + 1.4, u_sheen.w));",
    "    if (u_flow.y > 0.0) wake = smoothstep(-0.6, 1.6, e);",
    "    if (!edge && r01(id * 11u + uint(u_sheen.z)) < u_span.w && n.z > 0.3 && lam > 0.5) {",
    "      float a = u_sheen.w - passed * u_flow.x - r01(id * 13u + 5u) * 0.15;",
    "      float f = clamp(1.0 - max(a - 0.1, 0.0) / (0.5 + r01(id * 17u + 9u) * 0.3), 0.0, 1.0);",
    "      star = smoothstep(0.0, 0.1, a) * f * f * k;",
    "    }",
    "  }",
    // Between sheens the figure is alive, and whole: every dot drifts by a fraction of a pixel on slow swells, with its
    // neighbours (u_life.w, eased in with the life, 0 while the figure holds still). Nothing leaves the figure.
    "  vec2 flow = vec2(sin(u_time * 1.6 + a_p.y * 31.0 + a_p.x * 7.0), cos(u_time * 1.2 + a_p.x * 23.0 - a_p.y * 5.0)) * u_life.w * k;",
    "  float show = 1.0;",
    // when the paper turns between light and dark, a wave of light runs out of the body and the dots of the new map
    // (u_swap.z 1) appear behind it, while those of the old one (-1) give way ahead of it, dimmed
    "  float swapShow = 1.0;",
    "  if (u_swap.y != 0.0) {",
    "    float e = (u_swap.x - c) / u_span.z, behind = smoothstep(-0.6, 1.6, e);",
    "    swapShow = u_swap.z > 0.0 ? behind : (1.0 - behind) * 0.6;",
    "    show *= swapShow;",
    "    band = max(band, exp(-e * e) * max(n.z, 0.0) * max(n.z, 0.0) * k);",
    "  }",
    "  float tint = u_tint * wake;",
    // the ink takes the light as the avatar does once the colours have arrived: a warm key where the surface faces the
    // light and a cool fill where it turns away (u_tone: fill, key)
    "  vec3 tone = mix(u_tone[0], u_tone[1], smoothstep(0.1, 0.85, lam));",
    "  vec3 col = mix(mix(u_color, tone, tint), mat, a_c.g * tint);",
    // the silk (u_silk: the mode's three colours of light; u_silkw: how strongly, eased in with the life, 0 while the
    // figure holds still): a slow field of colour folded on itself twice, as light moves through silk, drifting up the
    // figure and turning over as it goes; the clouds wear it most, the energy and the sparkle less, and where the dots
    // are light the stone takes a breath of it on its lit side; the gold keeps its own colour
    "  vec2 sq = a_p.xy * vec2(2.4, 2.0) + vec2(0.0, u_time * 0.035);",
    "  sq += 0.6 * vec2(sin(sq.y * 2.3 + u_time * 0.21), sin(sq.x * 1.9 - u_time * 0.17));",
    "  sq += 0.3 * vec2(sin(sq.y * 4.1 - u_time * 0.13 + 1.3), sin(sq.x * 3.7 + u_time * 0.19 + 0.4));",
    "  float fold = 0.5 + 0.5 * sin(sq.x * 1.4 + sq.y * 2.2);",
    "  vec3 silk = mix(mix(u_silk[0], u_silk[1], smoothstep(0.0, 0.55, fold)), u_silk[2], smoothstep(0.55, 1.0, fold));",
    "  float wear = (m == 2 ? 0.6 : (m == 3 || m == 4) ? 0.35 : 0.0) * a_c.g + (m == 1 ? 0.12 * lam * u_positive : 0.0);",
    "  col = mix(col, silk, wear * u_silkw * min(1.0, tint * 2.5));",
    // the currents of light (current, u_life.x): at a crest the stone is lit, in a trough shaded; where the dots are ink
    // that is smaller dots, leaning a little to the key's warmth, and where they are light, larger and brighter ones;
    // twice as strong while a sheen's wash passes
    "  float glow = u_life.x * current * (1.0 + wash);",
    "  shade *= 1.0 + glow * mix(-1.0, 1.25, u_positive);",
    "  col = mix(col, u_tone[1], max(u_life.x * current, 0.0) * 1.5 * tint * (1.0 - a_c.g));",
    // the image's sparkles twinkle: they swell and brighten on a slow cycle of their own
    "  float sparkle = clamp(a_c.a * 2.0 - 1.0, 0.0, 1.0);",
    "  float tw = sparkle * (0.5 + 0.5 * sin(u_time * 2.2 + s2 * 6.2831853)) * min(1.0, tint * 2.5);",
    "  hot = max(hot, tw * 0.5);",
    "  col = mix(col, u_hot, hot * 0.9);",
    "  col = mix(col, mix(u_ember.yzw, u_hot, within * within), heat * 0.75);",
    // (on white paper the wash is lighter, so the stone the light has crossed stays stone instead of turning to gold)
    "  col = mix(col, u_light[0], max(wash * (0.25 + 0.75 * lam * lam) * mix(0.6, 0.85, u_positive), trail * 0.35));",
    "  col = mix(col, mix(u_light[0], u_light[1], smoothstep(0.55, 1.0, band)), band * 0.95);",
    "  col = mix(col, u_light[3], fringe * 0.35);",
    // while Tide is on, every 4.5 s a soft band of its light rises through the figure from the base to the caduceus
    // (u_tide: how far up it has risen, as a share of the figure's height, and how strong it is), and the dots it passes
    // swell a little
    "  float tide = (1.0 - smoothstep(0.0, 0.07, abs(1.0 - a_p.y - u_tide.x))) * u_tide.y * k;",
    "  col = mix(col, u_light[0], tide * min(1.0, u_tint * 2.5));",
    "  col = mix(col, u_light[1], min(1.0, flash) * 0.85);",
    // a strike lights the figure up around where it lands
    "  col = mix(col, mix(u_light[1], vec3(1.0), u_positive), strike * 0.45);",
    "  v_color = mix(col, u_light[2], star);",
    "  bool glint = a_e.w > 0.5;",
    "  px += (glint || edge || under ? vec2(0.0) : flow) + u_offset;",
    "  float size = u_dot * (0.78 + 0.5 * a_p.w) * persp * persp * (1.0 + 0.3 * u_beat) * (1.0 + 0.6 * lift) * (1.0 + 0.3 * tide);",
    "  size *= shade * (1.0 + 0.4 * tw) * (1.0 + mix(0.25, 0.6, u_positive) * band + 0.6 * swell + 0.3 * flash + 0.25 * wash * (1.0 - lam) * (1.0 - u_positive)) * (1.0 + 0.6 * star) * (1.0 + 0.35 * strike);",
    // fine features (high detail) are drawn with smaller dots, broad shadows with larger ones, on screens with the pixels
    // for it: below 1.5 device pixels per CSS pixel a smaller dot is smaller than a pixel, and as the figure turns it
    // flickers in and out of the pixels it crosses
    "  size *= mix(1.0, 0.82, a_c.b * step(1.5, u_dpr));",
    // the face and the hands sit on a grid twice as fine: four dots, each 62% the size, where one would be
    "  size *= mix(1.0, 0.62, a_e.z);",
    "  size = mix(size * 0.7, size, k);",
    "  v_alpha = (0.62 + 0.38 * smoothstep(-0.25, 0.2, p.z)) * fade * mix(0.0, 1.0, smoothstep(0.0, 0.25, k)) * u_alpha;",
    "  v_alpha = mix(v_alpha, u_alpha, max(max(band, max(fringe * 0.6, wash * 0.5)), star)) * show;",
    "  v_alpha *= (1.0 - hidden) * (1.0 - 0.5 * wash * (1.0 - lam) * u_positive) * (1.0 + glow * 1.5 * u_positive);",
    "  v_star = star;",
    "  v_heading = vec2(1.0, 0.0);",
    "  v_flare = max(max(0.6 * swell, mix(0.4, 0.6, u_positive) * band), 0.35 * heat);",
    "  v_size = size * u_dpr;",
    // a star's sprite is larger than its disc, to hold the arms of the cross; a flare's larger too, for its halo
    "  v_sprite = v_size * (1.0 + 2.0 * star + 2.5 * v_flare);",
    // half a device pixel more, so most of the soft edge of a small dot is drawn instead of clipped by its sprite
    "  v_sprite += 0.5;",
    // the outline is drawn as a fine continuous line: on white paper in the ink at full strength, a little finer than
    // a dot, and where the dots stand for light a fine soft rim of light, never a glow. Where it runs across another
    // part (a_c.b: the raised arm over the wing) it is drawn at INNER of that: on white paper a light engraved line, on
    // dark paper none, since a rim of light inside the figure reads as a scratch (build.py's INNER)
    "  if (edge) {",
    "    v_size = u_dot * mix(0.85, 0.75, u_positive) * persp * (1.0 + 0.3 * u_beat) * u_dpr;",
    "    v_sprite = v_size + 0.5;",
    "    v_alpha = mix(1.0, 0.55, u_positive) * mix(1.0, mix(0.45, 0.0, u_positive), a_c.b) * mix(0.0, 1.0, smoothstep(0.0, 0.25, k)) * u_alpha * swapShow;",
    "    v_star = v_flare = 0.0;",
    "  }",
    // the avatar's own star glints (a_e.w): stars that twinkle each on its own slow rhythm, mostly faint and now and
    // then bright, brighter as the band passes, arriving with the materials' colours, and still in the wind
    "  v_glint = 0.0;",
    "  if (glint) {",
    "    float wave = 0.5 + 0.5 * sin(u_time * (0.5 + 0.9 * s1) + s2 * 6.2831853), twinkle = wave * wave * wave;",
    // now and then, every 4.5-8 s at its own moment, a glint of the figure bursts: it flares in a few hundredths of a
    // second and dies away over a fifth, growing a little and turning its rays as it does; each glint's rays sit at
    // their own slight angle, so the glints read as light catching the metal, not as a row of crosshairs
    "    float cyc = fract(u_time / (4.5 + 3.5 * s3) + s1);",
    "    float burst = smoothstep(0.0, 0.035, cyc) * (1.0 - smoothstep(0.035, 0.2, cyc)) * (1.0 - a_c.g);",
    "    twinkle = max(twinkle, burst);",
    "    float spin = (s2 - 0.5) * 0.55 + burst * 0.3 * sign(s1 - 0.5);",
    "    v_heading = vec2(cos(spin), sin(spin));",
    // a star of the sky (a_c.g) is smaller, and shows only where the paper is dark (u_sky), as the avatar's sky is
    "    v_glint = min(1.0, clamp((mix(0.68, 0.55, u_positive) + mix(0.32, 0.45, u_positive) * twinkle + mix(0.25, 1.2, u_positive) * band) * min(1.0, tint * 2.0) * k, 0.0, 1.0) * mix(1.0, u_sky, a_c.g));",
    // (on white paper a glint's star draws in to fine points well inside its sprite, so the sprite is a third larger)
    "    v_size = u_dot * mix(3.5 + 8.0 * a_p.w * a_p.w, 1.6 + 3.5 * a_p.w * a_p.w, a_c.g) * (0.8 + 0.2 * twinkle + mix(0.12, 0.7, u_positive) * band) * (1.0 + 0.35 * burst) * mix(1.35, 1.0, u_positive) * persp * u_dpr;",
    // a handful of the strongest (one in five, chosen by where they are) carry longer spikes than the rest
    "    float spiked = step(0.85, a_p.w) * step(r01(uint(a_p.x * 4096.0) * 73u + uint(a_p.y * 4096.0) * 151u), 0.2) * (1.0 - a_c.g);",
    "    v_sprite = v_size * (1.0 + 0.8 * spiked) + 0.5;",
    // (a glint has no dot of its own: before the colours arrive it draws nothing, not a disc of its size)
    "    v_alpha = v_glint > 0.0 ? u_alpha * swapShow * (1.0 - hidden) : 0.0;",
    "    v_star = v_flare = 0.0;",
    "  }",
    // the underpaint: a soft disc of paper the size of a grid cell and a half, there once the dots have assembled
    "  if (under) {",
    "    v_size = u_under * persp * u_dpr;",
    "    v_sprite = v_size + 1.0;",
    "    v_alpha = a_c.g * smoothstep(0.6, 1.0, k) * (1.0 - hidden);",
    "    v_color = u_paper;",
    "    v_star = v_flare = v_glint = 0.0;",
    "  }",
    "  gl_PointSize = v_sprite;",
    // (a dot the bank alone holds, while the bank is away, is put outside the view, so it costs no pixels)
    "  gl_Position = hidden > 0.999 ? vec4(-2.0, -2.0, 0.0, 1.0) : vec4(px / u_res * 2.0 - 1.0, 0.0, 1.0) * vec4(1.0, -1.0, 1.0, 1.0);",
    "}"
  ].join("\n");

  var FRAG = [
    "#version 300 es",
    "precision mediump float;",
    "flat in float v_alpha;",
    "flat in float v_size;",
    "flat in float v_star;",
    "flat in vec2 v_heading;",
    "flat in float v_flare;",
    "flat in float v_sprite;",
    "flat in vec3 v_color;",
    "flat in float v_glint;",
    "uniform highp vec3 u_light[4];",
    "uniform highp float u_positive;",
    "uniform highp vec3 u_glint[2];",
    "out vec4 o;",
    // an arm of a star along x: as thick as `t` at the centre, tapering to nothing at the sprite's edge (`ir`: one over
    // its half-width)
    "float arm(vec2 m, float t, float ir, float least) { float f = max(0.0, 1.0 - m.x * ir); return clamp(max(least, t * f) - m.y + 0.5, 0.0, 1.0) * f; }",
    // A renderer without a GPU runs every branch of this shader for every pixel, taken or not, so the shapes share what
    // they can: the distance from the centre, the arms (a burst's star and a glint both have four long ones), and one
    // soft halo (a flare's wide one or a glint's tight glow), and none of them calls pow or a second exp.
    "void main() {",
    "  vec2 q = (gl_PointCoord - 0.5) * v_sprite;",
    "  vec2 m = abs(q);",
    "  float d = length(q), ir = 2.0 / v_sprite;",
    "  bool glint = v_glint > 0.0;",
    "  float a = clamp(v_size * 0.5 - d + 0.5, 0.0, 1.0);",
    "  vec3 c = v_color;",
    // (a glint's rays on white paper are drawn a little bolder, since a dark line half a pixel wide fades to nothing)
    "  float t = v_size * (glint ? 0.09 : 0.16), least = glint ? mix(0.9, 0.45, u_positive) : 0.45, spikes = max(arm(m, t, ir, least), arm(m.yx, t, ir, least));",
    "  float halo = exp(-dot(q, q) / (v_size * v_size * (glint ? 0.04 : 1.2)));",
    // a star is a four-point cross over its disc: two thin arms that taper to the sprite's edge; its middle burns in
    // the sheen's core colour
    "  if (v_star > 0.0) {",
    "    a = max(a, spikes * v_star);",
    "    c = mix(c, u_light[1], v_star * clamp(1.0 - d / (v_size * 0.6), 0.0, 1.0));",
    "  }",
    // a dot that glows (where a sheen's band passes or its light swells a lit surface, and under Gear Two's cursor) is a
    // pale heart in a small halo of its own colour, so gold glows gold and marble white; on white paper, where white
    // does not show, marble's halo takes the sheen's colour
    "  if (v_flare > 0.0) {",
    "    float heart = clamp(v_size * 0.55 - d + 0.5, 0.0, 1.0);",
    "    a = max(a, max(heart, halo * 0.5) * v_flare);",
    "    float chroma = max(v_color.r, max(v_color.g, v_color.b)) - min(v_color.r, min(v_color.g, v_color.b));",
    "    vec3 glow = u_positive > 0.5 ? mix(v_color, vec3(1.0), 0.25) : mix(u_light[0], v_color, smoothstep(0.15, 0.4, chroma));",
    "    c = mix(c, mix(glow, vec3(1.0), heart), v_flare);",
    "  }",
    // a glint is an eight-point star: thin spikes, long on the axes and short on the diagonals, and a soft glow, in its
    // edge colour, around a heart in its heart colour (u_glint): a white star in a warm glow on dark paper, a white
    // spark in a star of the sheen's blue on white paper, where white alone would not show
    "  if (glint) {",
    // (its rays at its own angle, v_heading)
    "    vec2 r = abs(vec2(q.x * v_heading.x + q.y * v_heading.y, q.y * v_heading.x - q.x * v_heading.y));",
    "    float heart = clamp(v_size * 0.15 - d + 0.5, 0.0, 1.0);",
    "    if (u_positive > 0.5) {",
    "      vec2 dg = vec2(r.x + r.y, abs(r.x - r.y)) * 0.70710678;",
    "      float rays = max(min(1.0, max(arm(r, t, ir, least), arm(r.yx, t, ir, least)) * 2.0), min(1.0, arm(dg, v_size * 0.07, ir * 1.8181818, least) * 1.2)), glow = halo * 0.75;",
    "      a = max(max(rays, heart), glow) * v_glint;",
    // the rays in the edge colour and the heart in its own
    "      c = mix(u_glint[1], u_glint[0], heart);",
    "    } else {",
    // on white paper, where white alone does not show and thin dark rays read as crosshairs, a glint is drawn as a
    // sparkle is on white: a four-pointed star that swells at its heart and draws to fine points, white at its heart
    // and gold out to its points, a smaller one across its diagonals, and a soft bloom of gold around it
    "      float R = v_sprite * 0.48;",
    "      vec2 u = r / R, v = vec2(u.x + u.y, abs(u.x - u.y)) * 1.35;",
    "      float f = pow(u.x, 0.42) + pow(u.y, 0.42), g = pow(v.x, 0.42) + pow(v.y, 0.42);",
    "      float star = clamp((1.0 - f) / max(fwidth(f), 1e-3), 0.0, 1.0), small = clamp((1.0 - g) / max(fwidth(g), 1e-3), 0.0, 1.0);",
    "      float bloom = exp(-dot(q, q) / (v_size * v_size * 0.05)), heart = clamp(1.6 - min(f, g) * 1.9, 0.0, 1.0);",
    "      a = max(max(star, small * 0.7), bloom * 0.5) * v_glint;",
    "      c = mix(u_glint[1], u_glint[0], max(heart, bloom * (1.0 - star) * 0.6));",
    "    }",
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
      // the sheen's light, its core, the stars of its burst, and the fringe of a complementary hue that runs ahead of it
      light: [get("--figure-sheen"), get("--figure-sheen-core"), get("--figure-star"), get("--figure-sheen-fringe")],
      // the three colours of the silk that flows across the figure
      silk: [get("--figure-silk-1"), get("--figure-silk-2"), get("--figure-silk-3")],
      // the ink's cool fill and warm key once the colours have arrived, and the glints' heart and edge
      tone: [get("--figure-fill"), get("--figure-key")], glint: [get("--figure-glint"), get("--figure-glint-edge")],
      // the colour the dots under the cursor run in Gear Two: the page's embers' (--trail-ember), else the key's
      ember: get("--trail-ember") || get("--figure-key"),
      // each material's base and lit color, in index order; marble is the figure's ink
      palette: ["gold", "marble", "cloud", "lightning", "glint"].map(function (m) { return m === "marble" ? get("--figure-ink") : get("--mat-" + m); }),
      lit: ["gold", "marble", "cloud", "lightning", "glint"].map(function (m) { return m === "marble" ? get("--figure-ink") : get("--mat-" + m + "-lit"); }),
      gear: document.documentElement.getAttribute("data-gear") === "two", blue: document.documentElement.getAttribute("data-gear") === "blue",
      dark: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] < 0.5
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
    var gl = null, ctx = null;
    try {
      gl = canvas.getContext("webgl2", { antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: "high-performance" });
      ctx = overlay.getContext("2d");
    } catch (e) {}
    if (!gl || !ctx) {
      el.classList.remove("is-live");
      el.classList.add("is-fallback");
      return { highlight: function () {}, count: function () { return 0; }, skipIntro: function () {} };
    }
    el.appendChild(canvas);
    el.appendChild(overlay);

    var prog = null, vao = null, vbo = null, query = null, U = {}, queryPending = false, rendered = false, drawChecked = false;
    var relief = null, field = null, outline = null, stars = null, sky = null, noise = null, meta = null, palette = null, vertices = null, count = 0, res = 0, fine = null;
    // how many of the buffer's last vertices are the cloud bank's own dots, which are not drawn while the bank is away
    var bankTail = 0;
    // the dot maps loaded so far (ink for light paper, light for dark; dotMap), the one the figure is drawn from, its
    // dots and the other map's at the current grid, and a swap from one to the other in progress
    var sources = { ink: null, light: null }, loading = {}, failed = {}, set = null, shapes = {}, swap = null;
    var cssW = 0, cssH = 0, dpr = 1, box = { x: 0, y: 0, size: 0 }, place = null, cell = 1;
    var colors = readColors();
    var inkNow = rgb(colors.ink), inkFrom = inkNow, inkTo = inkNow, inkAt = 0;
    var tintNow = tintFor(colors), tintFrom = tintNow, tintTo = tintNow;
    // how much of the cloud bank is drawn: all of it in Gear Two, none on light and dark paper; and how hot the dots
    // under the cursor run, Gear Two's ember heat, eased over its switch the same way
    var bankNow = colors.gear ? 1 : 0, emberNow = bankNow, emberColor = rgb(colors.ember);
    var yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, pushK = { x: 0, v: 0 };
    var pointer = { x: -1e4, y: -1e4, inside: false, tx: 0, ty: 0 };
    var touch = null;
    var ripples = [[0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0], [0, 0, -10, 0]], nextRipple = 0, bolts = [];
    // the cursor's velocity (px/s, smoothed)
    var stir = { x: 0, y: 0, at: 0, px: 0, py: 0 };
    var ripFlat = new Float32Array(16);
    var startAt = 0, last = 0, raf = 0, visible = false, ready = false, clock = 0, spin = 0;
    var ring = null, ringFont = 0, fontReady = false, ringLitAt = 0;
    var glitchUntil = 0, tear = null, tearBeat = -1, longDone = -1, resizeTimer = 0, tiles = [], tileFlat = new Float32Array(12), shiftFlat = new Float32Array(6);
    var sheenIndex = -1, sheenAt = 0, sheenDir = 0, sheenNumber = 0, sheenSweep = SHEEN_SWEEP, sheenWake = false, bursts = 0;
    // when the figure began to live, to breathe and drift (0 while it holds still)
    var aliveFrom = 0;
    var starChance = [0, 0], lights = new Float32Array(12), paper = new Float32Array(3), silks = new Float32Array(9), pad = 0;
    // the opening: still in ink, a shine that leaves the colors behind, a turn, Gear Two and back (see INTRO)
    var intro = opts.intro ? { stage: "hold", at: null, redAt: null } : null, ringAt = 0;
    if (intro) { sheenIndex = 0; el.setAttribute("data-intro", "hold"); }
    var materials = new Float32Array(15), materialsLit = new Float32Array(15), tones = new Float32Array(6), glintColors = new Float32Array(6);
    var cpuMs = 0, telemetryAt = 0;
    // Tide's entrance: when its surge began (0 when none runs), whether its sheen is still to come, and the page's phase
    var vortexAt = 0, vortexShine = false, phaseNow = null;
    // the staff's axis (staffAxis()), for the snakes and the caduceus's small wings
    var staff = [0, 0, 0];

    function paintLights() {
      emberColor = rgb(colors.ember);
      paper.set(rgb(colors.paper));
      colors.silk.forEach(function (css, i) { silks.set(rgb(css || colors.ink), i * 3); });
      colors.light.forEach(function (css, i) { lights.set(rgb(css), i * 3); });
      colors.tone.forEach(function (css, i) { tones.set(rgb(css), i * 3); });
      colors.glint.forEach(function (css, i) { glintColors.set(rgb(css), i * 3); });
      colors.palette.forEach(function (css, i) { materials.set(rgb(css), i * 3); });
      colors.lit.forEach(function (css, i) { materialsLit.set(rgb(css), i * 3); });
    }
    paintLights();

    function releaseTouch(event) {
      if (!touch || (event && event.pointerId !== touch.id)) return;
      var id = touch.id;
      touch = null;
      pointer.tx = pointer.ty = 0;
      if (el.hasPointerCapture(id)) el.releasePointerCapture(id);
    }

    function cancelInteractions() {
      releaseTouch(null);
      pointer.inside = false;
      pointer.x = pointer.y = -1e4;
      pointer.tx = pointer.ty = 0;
      pushK.x = pushK.v = yaw.v = pitch.v = 0;
      for (var i = 0; i < ripples.length; i++) ripples[i][3] = 0;
      stir.x = stir.y = 0;
      bolts = [];
      glitchUntil = 0;
      tear = null;
      tiles = [];
      vortexAt = 0;
      vortexShine = false;
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
        ["u_res", "u_box", "u_pivot", "u_depth", "u_rot", "u_time", "u_build", "u_pointer", "u_rip", "u_beat", "u_dot", "u_dpr", "u_glitch", "u_tile", "u_shift", "u_offset", "u_alpha", "u_color", "u_tint", "u_palette", "u_lit", "u_deep", "u_hot", "u_sheen", "u_span", "u_flow", "u_light", "u_positive", "u_swap", "u_tone", "u_glint", "u_stir", "u_strikes", "u_way", "u_wayk", "u_sky", "u_tiles", "u_wind", "u_bank", "u_vortex", "u_tide", "u_parts", "u_joints", "u_staff", "u_life", "u_key", "u_ember", "u_paper", "u_under", "u_silk", "u_silkw"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
        vao = gl.createVertexArray();
        vbo = gl.createBuffer();
        query = gl.createQuery();
        if (!vao || !vbo || !query) throw new Error("hero buffers unavailable");
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        // per dot: x, y, z, ink (4 floats), normal (2 floats), material, its weight, detail, and sparkle (4 bytes),
        // two spare bytes, the fine flag, and the glint flag (4 bytes), and two spare bytes, which way is out of the
        // figure from the dot, and how far in it lies (4 bytes): 36 bytes
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 4, gl.FLOAT, false, VERTEX, 0);
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, VERTEX, 16);
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, VERTEX, 24);
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, VERTEX, 28);
        gl.enableVertexAttribArray(4);
        gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, VERTEX, 32);
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
      // the opening's clock starts now, as the drawn figure goes on screen, not when the frame that drew it began
      if (intro && intro.at == null) intro.at = performance.now() / 1000;
    }

    // The dots of one map at the current grid: stippled against the blue-noise tile, then given their depth, normal,
    // detail, material, sparkle, and way out of the figure from the other maps, packed VERTEX bytes a dot (see
    // initialize).
    function shape(source) {
      // the wing and the caduceus are stippled in strokes along their feathers and coils
      if (!source.strokes) source.strokes = meta.parts ? strokes(source.data, source.width, relief.data, relief.width, meta.parts, PLUMED, STROKE_BLUR) : null;
      var spots = stipple(source.data, source.width, noise.data, noise.width, res, meta.density, 0.7, fine, source.strokes);
      // the statue's outline, and the stipple clipped to it, so no stray dot sits outside the line (the clouds of the
      // base keep their soft fade)
      var traced = meta.parts ? edges(relief.data, relief.width, meta.parts, meta.over, EDGE_BLUR, EDGE_SPACING * (relief.width - 1) / place.scale) : null;
      if (traced) {
        var rw = relief.width, rl = rw - 1, base = meta.parts.indexOf("base") + 1, held = 0;
        for (var c = 0; c < spots.length; c += 3) {
          var u = clamp(spots[c] * rl, 0, rl), v = clamp(spots[c + 1] * rl, 0, rl), j0 = Math.floor(u), i0 = Math.floor(v), ex = u - j0, ey = v - i0;
          var j1 = Math.min(j0 + 1, rl), i1 = Math.min(i0 + 1, rl), fl = traced.field;
          var level = fl[i0 * rw + j0] * (1 - ex) * (1 - ey) + fl[i0 * rw + j1] * ex * (1 - ey) + fl[i1 * rw + j0] * (1 - ex) * ey + fl[i1 * rw + j1] * ex * ey;
          if (level < 0.5 && partOf(relief.data, Math.round(v) * rw + Math.round(u)) !== base) continue;
          spots[held++] = spots[c]; spots[held++] = spots[c + 1]; spots[held++] = spots[c + 2];
        }
        spots = spots.slice(0, held);
      }
      var n = spots.length / 3;
      var normals = depthNormals(field, relief.width, spots, 3, RELIEF);
      var details = sampleColors(relief.data, relief.width, spots, 3);
      var tints = palette ? sampleColors(palette.data, palette.width, spots, 3) : null;
      if (!outline) outline = outlineField(relief.data, relief.width);
      if (!stars) stars = palette && palette.width === relief.width ? glints(palette.data, relief.data, relief.width, GLINTS, meta.features) : new Float32Array(0);
      if (!sky) sky = skyStars(relief.data, relief.width);
      var lines = traced ? traced.points : new Float32Array(0), e = lines.length / 3, g = stars.length / 3, k = sky.length / 3;
      // the underpaint first, so every dot is drawn over it: a grid UNDER CSS px apart of discs half as wide again
      var mapPx = (relief.width - 1) / place.scale;
      var paint = underpaint(relief.data, relief.width, outline, traced ? traced.field : null, meta.parts, palette && palette.width === relief.width ? palette.data : null, UNDER * mapPx, UNDER * 0.75 * mapPx);
      var u = paint.length / 3, total = u + n + g + k + e;
      var buffer = new ArrayBuffer(total * VERTEX), floats = new Float32Array(buffer), bytes = new Uint8Array(buffer), f = VERTEX / 4;
      // the cloud bank is drawn in Gear Two alone: a dot that the figure would not hold without it (its ink, less the
      // bank's share there, the color map's blue, no longer beats its cell's threshold) is flagged, so on light and
      // dark paper the figure is the statue and its modest base cloud, stippled exactly as if the bank had never been.
      // Those dots go last in the buffer, after the outline, so that while the bank is away they are not drawn at all
      var cells = fine ? res * 2 : res, kept = fine ? meta.density * FINE_INK : meta.density, banked = 0, bank = new Uint8Array(n);
      for (var b = 0; tints && b < n; b++) {
        if (!tints[b * 4 + 2]) continue;
        var gx = Math.floor(spots[b * 3] * cells), gy = Math.floor(spots[b * 3 + 1] * cells);
        if (spots[b * 3 + 2] * (1 - tints[b * 4 + 2] / 255) * kept <= noise.data[(gy % noise.width) * noise.width + (gx % noise.width)] / 255) { bank[b] = 1; banked++; }
      }
      // where the dots end in the buffer, and where the bank's own begin
      var m = n - banked, head = u, tail = total - banked;
      var paintDepth = depthNormals(field, relief.width, paint, 3, RELIEF);
      for (var up = 0; up < u; up++) {
        floats[up * f] = paint[up * 3];
        floats[up * f + 1] = paint[up * 3 + 1];
        floats[up * f + 2] = paintDepth[up * 3 + 2];
        bytes[up * VERTEX + 24] = MARBLE;
        bytes[up * VERTEX + 25] = Math.round(paint[up * 3 + 2] * 255);
        bytes[up * VERTEX + 29] = labelAt(paint[up * 3], paint[up * 3 + 1]);
        bytes[up * VERTEX + 33] = 255;
      }
      for (var d = 0; d < n; d++) {
        var i = bank[d] ? tail++ : head++;
        floats[i * f] = spots[d * 3];
        floats[i * f + 1] = spots[d * 3 + 1];
        floats[i * f + 2] = normals[d * 3 + 2];
        floats[i * f + 3] = spots[d * 3 + 2];
        floats[i * f + 4] = normals[d * 3];
        floats[i * f + 5] = normals[d * 3 + 1];
        // material (nearest, never blended), how strongly the dot belongs to it, its detail, its sparkle
        var o = i * VERTEX + 24;
        bytes[o] = palette ? materialAt(palette.data, palette.width, spots[d * 3], spots[d * 3 + 1]) : MARBLE;
        bytes[o + 1] = tints ? tints[d * 4 + 1] : 0;
        bytes[o + 2] = details[d * 4 + 1];
        bytes[o + 3] = tints ? tints[d * 4 + 3] : 0;
        if (bank[d]) bytes[o + 4] = 255;
        // the part of the statue the dot belongs to, which moves it as the figure lives (life())
        bytes[o + 5] = labelAt(spots[d * 3], spots[d * 3 + 1]);
        // how much smaller the dot is drawn on the fine grid
        bytes[o + 6] = Math.round(fineScale(fine, spots[d * 3 + 2]) * 255);
        // which way is out of the figure from the dot, and how far in it lies (255 for a tenth of the figure or more)
        var at = (Math.round(clamp(spots[d * 3 + 1], 0, 1) * (relief.width - 1)) * relief.width + Math.round(clamp(spots[d * 3], 0, 1) * (relief.width - 1))) * 2;
        bytes[o + 10] = Math.round(outline[at + 1] * 255);
        bytes[o + 11] = Math.round(Math.min(1, outline[at] / (relief.width - 1) / 0.1) * 255);
      }
      // then the avatar's star glints, flagged in the spare byte of a_e (see the shader), at the relief's depth inside
      // the figure and a little behind it in the sky
      var deep = depthNormals(field, relief.width, stars, 3, RELIEF);
      for (var j = 0; j < g; j++) {
        var at = (u + m + j) * f, rw = relief.width - 1;
        var inside = relief.data[(Math.round(stars[j * 3 + 1] * rw) * relief.width + Math.round(stars[j * 3] * rw)) * 4] > 0;
        floats[at] = stars[j * 3];
        floats[at + 1] = stars[j * 3 + 1];
        floats[at + 2] = inside ? deep[j * 3 + 2] : 0.45;
        floats[at + 3] = stars[j * 3 + 2];
        bytes[(u + m + j) * VERTEX + 24] = MARBLE;
        bytes[(u + m + j) * VERTEX + 28] = bankAt(stars[j * 3], stars[j * 3 + 1]) > 127 ? 255 : 0;
        // a star on the wing or the caduceus moves with it
        bytes[(u + m + j) * VERTEX + 29] = labelAt(stars[j * 3], stars[j * 3 + 1]);
        bytes[(u + m + j) * VERTEX + 31] = 255;
      }
      // and the stars of the sky, far behind the figure, flagged in the material's weight (a_c.g), which a glint has
      // no use for
      for (var q = 0; q < k; q++) {
        var sk = (u + m + g + q) * f;
        floats[sk] = sky[q * 3];
        floats[sk + 1] = sky[q * 3 + 1];
        floats[sk + 2] = 0.15;
        floats[sk + 3] = sky[q * 3 + 2];
        bytes[(u + m + g + q) * VERTEX + 24] = MARBLE;
        bytes[(u + m + g + q) * VERTEX + 25] = 255;
        bytes[(u + m + g + q) * VERTEX + 31] = 255;
      }
      // and the outline, as fine lines of points flagged in a_w's spare byte, each at the relief's depth there so it turns
      // with the figure, facing out of the figure (a_w.z) and holding its own place in the wind
      var edgeNormals = depthNormals(field, relief.width, lines, 3, RELIEF), edgeTints = palette ? sampleColors(palette.data, palette.width, lines, 3) : null;
      for (var ei = 0; ei < e; ei++) {
        var ef = (u + m + g + k + ei) * f, eo = (u + m + g + k + ei) * VERTEX + 24;
        floats[ef] = lines[ei * 3];
        floats[ef + 1] = lines[ei * 3 + 1];
        floats[ef + 2] = edgeNormals[ei * 3 + 2];
        floats[ef + 3] = 0.5;
        floats[ef + 4] = edgeNormals[ei * 3];
        floats[ef + 5] = edgeNormals[ei * 3 + 1];
        bytes[eo] = palette ? materialAt(palette.data, palette.width, lines[ei * 3], lines[ei * 3 + 1]) : MARBLE;
        bytes[eo + 1] = edgeTints ? edgeTints[ei * 4 + 1] : 0;
        // an edge across another part (a_c.b) is drawn more lightly than one against the sky
        bytes[eo + 2] = traced.inner[ei] ? 255 : 0;
        bytes[eo + 3] = 128;
        bytes[eo + 5] = staffOr(traced.parts[ei], lines[ei * 3 + 1]);
        bytes[eo + 8] = 255;
        bytes[eo + 10] = Math.round(lines[ei * 3 + 2] * 255);
      }
      var lit = Math.max(1, litDots(normals));
      return { vertices: bytes, count: total, dots: n, banked: banked, under: u, stars: [Math.min(1, STARS / lit), Math.min(1, STARS_BRIGHT / lit)] };
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
      place = fit(meta.bounds, s, s * 0.02);
      gl.viewport(0, 0, canvas.width, canvas.height);
      var want = resolutionFor(place.scale);
      // the figure gets its finer grid on screens that have the pixels to show it: below 1.5 device pixels per CSS
      // pixel the finer dots are smaller than a pixel and only darken the stone
      var split = dpr >= 1.5;
      if (want !== res || split !== fine) {
        res = want;
        fine = split;
        shapes = {};
        swap = null;
      }
      if (!shapes[set]) shapes[set] = shape(sources[set]);
      warmOther();
      if (vertices !== shapes[set].vertices) {
        vertices = shapes[set].vertices;
        count = shapes[set].count;
        bankTail = shapes[set].banked;
        starChance = shapes[set].stars;
      }
      announce();
      if (!count) throw new Error("hero data is empty");
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
      drawChecked = false;
      cell = place.scale / res;
      ringFont = clamp(Math.round(s / 56), 10, 12);
      ring = null;
      return true;
    }

    // How many dots the figure draws: the cloud bank's own only in Gear Two.
    var announced = -1;
    function announce() {
      var shown = shapes[set] ? shapes[set].dots - (colors.gear ? 0 : shapes[set].banked) : -1;
      if (shown < 0 || shown === announced) return;
      announced = shown;
      if (opts.onCount) opts.onCount(shown);
    }

    // The part of the statue at a point (figure units), as the vertex carries it (a_e.y): its number in hero.json's
    // parts (partOf), the caduceus below the top of the fist counted as the staff (one more than the last part), and
    // 0 outside the figure, where nothing moves.
    function labelAt(fx, fy) {
      var last = relief.width - 1;
      return staffOr(partOf(relief.data, Math.round(clamp(fy, 0, 1) * last) * relief.width + Math.round(clamp(fx, 0, 1) * last)), fy);
    }
    function staffOr(part, fy) {
      return meta.parts && part === meta.parts.indexOf("caduceus") + 1 && fy >= STAFF_FROM ? meta.parts.length + 1 : part;
    }

    // The cloud bank's share of the figure at a point (figure units): the color map's blue, 0..255.
    function bankAt(fx, fy) {
      if (!palette) return 0;
      var last = palette.width - 1;
      return palette.data[(Math.round(clamp(fy, 0, 1) * last) * palette.width + Math.round(clamp(fx, 0, 1) * last)) * 4 + 2];
    }

    // The dots follow the paper (dotMap): when it turns between light and dark, the figure is drawn from the other
    // map, fetched the first time it is needed. In full motion, with the figure drawn and on screen, a band of light
    // crosses it and swaps the dots behind it; during Gear Two's switch, whose flash and glitch already break the
    // figure up, and in every other case, they swap at once. Returns whether the map changed; the caller redraws.
    function follow() {
      var want = dotMap(colors);
      if (!meta || want === set) return false;
      if (!sources[want]) { fetchMap(want); return false; }
      var from = set, old = vertices, oldCount = count, oldTail = bankTail, oldUnder = shapes[set] ? shapes[set].under : 0;
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
        swap = { at: now, count: oldCount, tail: oldTail, under: oldUnder, positive: from === "light" ? 1 : 0 };
      }
      return true;
    }

    // The other paper's geometry is built after first paint, off the click that asks for it.
    var warming = false;
    function warmOther() {
      if (!meta || !set || warming) return;
      var other = set === "ink" ? "light" : "ink";
      if (!sources[other] || shapes[other]) return;
      warming = true;
      var run = function () {
        warming = false;
        if (!sources[other] || shapes[other]) return;
        try { shapes[other] = shape(sources[other]); } catch (e) {}
      };
      if (typeof global.requestIdleCallback === "function") global.requestIdleCallback(run, { timeout: 1200 });
      else global.setTimeout(run, 40);
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
      return relief.data[i] > 0 && (bankNow >= 0.5 || bankAt(u, v) < 128) ? 1 : 0;
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

    // The paper-coloured outline that keeps the ring's front glyphs legible over the dots, stroked once per glyph into
    // an atlas at twice the device's resolution and drawn from it, since stroking transformed text anew every frame is
    // the costliest thing the ring does. Rebuilt when the paper, the size, or the line changes. HALO is its stroke as a
    // share of the font: wide enough to part the dots from a letter, narrow enough that the outlines of neighbouring
    // letters never merge into a band cut through the stone.
    var HALO = 0.26, halos = null;
    function haloAtlas(font, advance) {
      var key = [colors.paper, font, dpr, ring.glyphs.length].join();
      if (halos && halos.key === key) return halos;
      var chars = [], cells = {};
      ring.glyphs.forEach(function (ch) { if (ch !== " " && chars.indexOf(ch) < 0) chars.push(ch); });
      var scale = 2 * dpr, line = Math.max(2, font * HALO), w = Math.ceil((advance + line + 4) * scale), h = Math.ceil((font * 1.4 + line + 4) * scale);
      var atlas = document.createElement("canvas");
      atlas.width = w * Math.max(1, chars.length);
      atlas.height = h;
      var a = atlas.getContext("2d");
      a.font = "400 " + font + "px \"Fragment Mono\", ui-monospace, monospace";
      a.textAlign = "center";
      a.textBaseline = "middle";
      a.lineJoin = "round";
      a.lineWidth = line;
      a.strokeStyle = colors.paper;
      chars.forEach(function (ch, k) {
        a.setTransform(scale, 0, 0, scale, k * w + w / 2, h / 2);
        a.strokeText(ch, 0, 0);
        cells[ch] = [k * w, 0];
      });
      halos = { key: key, canvas: atlas, cells: cells, w: w, h: h, scale: scale };
      return halos;
    }

    // `motion` (null when still): the angle of the light that runs round the ring, and the sheen's wave while it runs
    // ({ age, sweep, lane }: how long ago it started, how long it takes, and its way across the figure as it is turned)
    function drawRing(yawNow, pitchNow, fade, beat, glow, motion) {
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
      // the light that runs round the ring is gold's lit colour, ember in Gear Two (the figure's key)
      var base = rgb(accent), lamp = rgb(colors.gear ? colors.tone[1] : colors.lit[0]);
      var ct = Math.cos(tilt), st = Math.sin(tilt);
      var halo = haloAtlas(font, advance);
      // the ring's centre as the figure is turned, where a sheen's light finds its glyphs
      var hub = motion && motion.wave ? rotate([pivot[0] - meta.center[0], meta.center[1] - pivot[1], 0], yawNow, pitchNow) : null;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var filled = null;
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
        // a light reads along the line, once every 7 s (3.5 s in Gear Two): the glyphs it has just passed take its colour
        // and grow a little, fading behind it
        var shine = 0, size = 1;
        if (motion) {
          var behind = ((motion.comet - (i / n) * TAU) % TAU + TAU) % TAU;
          shine = Math.exp(-behind / 0.8) + Math.exp(-(TAU - behind) / 0.06) * 0.6;
          size = 1 + 0.12 * shine;
          // a sheen's light, sweeping the figure, stirs the glyphs it passes along its way and lets them settle, as its
          // gust does the dots (the shader's gust(), from when its sheet reaches the glyph)
          var wave = motion.wave;
          if (wave) {
            var since = wave.age - clamp(wayAt([hub[0] + p[0], hub[1] + p[1], hub[2] + p[2]], wave.lane), 0, 1) * wave.sweep;
            if (since > 0) {
              var sway = Math.exp(-since * 2.5) * Math.sin(since * 5.7) / 0.55 * Rpx * 0.03;
              sx += DRIFT[0] * sway;
              sy += DRIFT[1] * sway;
            }
          }
        }
        if (!front && maskAt(sx, sy) > 0.3) continue;
        var alpha = (front ? 1 : 0.3) * (0.35 + 0.65 * Math.pow(facing, 0.6));
        // a brighten lifts every glyph toward full strength, the dim ones behind the figure most
        alpha = (alpha + (1 - alpha) * glow) * fade;
        if (alpha < 0.02) continue;
        var k = pr[2] * size;
        var tx = tg[0] * k, ty = -tg[1] * k, ux = -up[0] * k, uy = up[1] * k;
        ctx.setTransform(tx * dpr, ty * dpr, ux * dpr, uy * dpr, sx * dpr, sy * dpr);
        ctx.globalAlpha = alpha;
        // (a halo is drawn only where it hides something: over the figure, or near the ring's ends, where the glyphs
        // behind come close; over bare paper a paper-coloured halo shows nothing, and each draw costs as much as a glyph)
        var spot = front && halo.cells[ch], hw = halo.w / halo.scale / 2, hh = halo.h / halo.scale / 2;
        if (spot && facing > 0.5 && !(maskAt(sx, sy) || maskAt(sx + tx * hw + ux * hh, sy + ty * hw + uy * hh) || maskAt(sx - tx * hw + ux * hh, sy - ty * hw + uy * hh) ||
            maskAt(sx + tx * hw - ux * hh, sy + ty * hw - uy * hh) || maskAt(sx - tx * hw - ux * hh, sy - ty * hw - uy * hh))) spot = null;
        if (spot) ctx.drawImage(halo.canvas, spot[0], spot[1], halo.w, halo.h, -hw, -hh, hw * 2, hh * 2);
        var lit = Math.min(1, shine), fill = lit < 0.02 ? accent : "rgb(" + [0, 1, 2].map(function (c) { return Math.round((base[c] + (lamp[c] - base[c]) * lit) * 255); }).join(",") + ")";
        // (the colour is set only when it changes)
        if (fill !== filled) ctx.fillStyle = filled = fill;
        ctx.fillText(ch, 0, 0);
      }
      ctx.globalAlpha = 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // whether the figure is on screen
    function onScreen(shown) {
      visible = shown;
      // a visitor who opens the page somewhere below the figure, or leaves before it is drawn, never sees the opening
      if (!visible && intro && intro.at == null) endIntro(false);
      sync();
    }

    function frame(now) {
      raf = 0;
      if (!ready || !visible || document.hidden) return;
      // a page scrolled in one go can take the figure off screen before the observer has seen it, and the observer
      // looks only after this frame: a figure that has gone is not drawn again
      var at = el.getBoundingClientRect();
      if (at.bottom < 0 || at.top > global.innerHeight || at.right < 0 || at.left > global.innerWidth) { onScreen(false); return; }
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

    // A sheen: a band of light across the figure with its burst of stars. `wake` keeps
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
        // (a gear chosen by hand, Gear Two or Tide, is left as it is: the opening then ends after its turn)
        var step = intro.at == null ? { state: intro, clock: clock, act: null } : introStep(intro, now / 1000, clock, gear || colors.blue);
        clock = step.clock;
        if (step.act === "shine") shine(now, -1, INTRO.sweep, true, ++bursts + 100);
        else if (step.act === "redshine") shine(now, 1, INTRO.redSweep, false, ++bursts + 100);
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
        // a touch drag turns the figure; the cursor only leans it a little, so the relief never shows its flat back
        var dragged = touch && touch.dragging;
        spring(yaw, swayYaw + (tilt ? pointer.tx * (dragged ? 0.5 : 0.3) : 0), dt, 3.2);
        spring(pitch, swayPitch - (tilt ? pointer.ty * (dragged ? 0.25 : 0.12) : 0), dt, 3.2);
        spring(pushK, pointer.inside ? 1 : 0, dt, 9);
        spin += dt * (gear ? 0.32 : 0.11);
      } else {
        yaw.x = swayYaw;
        pitch.x = swayPitch;
        yaw.v = pitch.v = pushK.x = pushK.v = 0;
      }
      // the cloud bank comes in under Gear Two's switch and leaves over 0.3 s as it ends
      var bankTo = gear ? 1 : 0;
      bankNow = live ? (bankNow < bankTo ? Math.min(bankTo, bankNow + dt / 0.3) : Math.max(bankTo, bankNow - dt / 0.3)) : bankTo;
      emberNow = live ? (emberNow < bankTo ? Math.min(bankTo, emberNow + dt / 0.3) : Math.max(bankTo, emberNow - dt / 0.3)) : bankTo;
      if (inkAt) {
        var q = clamp((now - inkAt) / 320, 0, 1);
        inkNow = [0, 1, 2].map(function (c) { return inkFrom[c] + (inkTo[c] - inkFrom[c]) * q; });
        tintNow = tintFrom + (tintTo - tintFrom) * q;
        if (q >= 1) inkAt = 0;
      }
      // the strikes still under way, first in their array (the shader loops over those alone)
      var strikes = 0;
      ripFlat.fill(0);
      for (var i = 0; live && i < ripples.length; i++) {
        if (ripples[i][3] > 0 && t - ripples[i][2] <= STRIKE) ripFlat.set(ripples[i], strikes++ * 4);
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
      // on light and dark paper the band is a little wider, with a few more stars and a little more dust
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
      // the cursor's velocity settles when it stops
      var settle = Math.exp(-dt * 5);
      stir.x *= settle;
      stir.y *= settle;
      var cap = Math.min(1, 600 / (Math.hypot(stir.x, stir.y) || 1));
      gl.uniform4f(U.u_stir, live ? stir.x * cap : 0, live ? stir.y * cap : 0, 0, 0);
      gl.uniform1i(U.u_strikes, strikes);
      gl.uniform1f(U.u_beat, beat);
      var dotPx = Math.max(1.1, cell * 1.3);
      gl.uniform1f(U.u_dot, dotPx);
      gl.uniform1f(U.u_dpr, dpr);
      gl.uniform1f(U.u_glitch, glitch);
      gl.uniform4fv(U.u_tile, tileFlat);
      gl.uniform2fv(U.u_shift, shiftFlat);
      gl.uniform1i(U.u_tiles, tiles.length);
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
      var sweep = clamp(sheenAge / sheenSweep, 0, 1);
      if (sheening) gl.uniform4f(U.u_sheen, sweep, sheenDir, sheenNumber, sheenAge);
      else gl.uniform4f(U.u_sheen, 0, 0, 0, 0);
      var left = box.x + place.x + meta.bounds[0] * place.scale, right = box.x + place.x + meta.bounds[2] * place.scale;
      gl.uniform4f(U.u_span, left, right, bright ? 0.018 : 0.015, starChance[bright ? 1 : 0]);
      // a sheen's way across the figure as it is turned (sheenWay()), and where its gust blows on the screen
      var lane = sheenWay(meta, yaw.x, pitch.x);
      gl.uniform4f(U.u_way, WAY[0], WAY[1], WAY[2], lane.lo);
      gl.uniform2f(U.u_wayk, lane.k, WAY_MARGIN);
      gl.uniform2f(U.u_flow, sheenSweep, sheening && sheenWake ? 1 : 0);
      // the figure begins to live once it has assembled, or once the opening has let it move, easing in over 2 s: its
      // parts breathe, beat, and sway, currents of light cross it, its key light drifts, and its dots drift with their
      // neighbours, all exactly at rest while the figure holds still or under reduced motion
      var alive = live && !still && built >= SHEEN_FIRST;
      if (!alive) aliveFrom = 0;
      else if (!aliveFrom) aliveFrom = t;
      var ease = aliveFrom ? smoothstep(0, 2, t - aliveFrom) : 0, living = life(t, meta.joints, meta.center, ease);
      gl.uniform4fv(U.u_parts, living.parts);
      gl.uniform4fv(U.u_joints, living.joints);
      gl.uniform4f(U.u_staff, staff[0], staff[1], staff[2], SNAKES * ease);
      gl.uniform4f(U.u_life, CURRENTS.glow * ease, CURRENTS.ride * dotPx / place.scale * ease, CURRENTS.curls * ease, CURRENTS.drift * ease);
      gl.uniform4f(U.u_key, living.key[0], living.key[1], living.key[2], ease > 0 ? 1 : 0);
      gl.uniform3fv(U.u_light, lights);
      gl.uniform3fv(U.u_tone, tones);
      gl.uniform3fv(U.u_glint, glintColors);
      // the sky's stars come out on dark paper, Gear Two's included, and brighter in Tide
      gl.uniform1f(U.u_sky, colors.blue ? 1.5 : colors.dark ? 1 : 0);
      // the breeze as it blows now, which a drifting dot follows (the shader's breeze(), worked out once a frame)
      var wx = Math.sin(t * 0.26) + 0.35 * Math.sin(t * 0.61 + 1.3), wy = 0.25 * Math.sin(t * 0.37 + 0.6), wl = Math.hypot(wx, wy) || 1;
      gl.uniform2f(U.u_wind, wx / wl, wy / wl);
      gl.uniform1f(U.u_bank, bankNow);
      gl.uniform4f(U.u_ember, emberNow, emberColor[0], emberColor[1], emberColor[2]);
      gl.uniform3fv(U.u_paper, paper);
      gl.uniform3fv(U.u_silk, silks);
      gl.uniform1f(U.u_silkw, SILK * ease);
      gl.uniform1f(U.u_under, UNDER * 1.5);
      // Tide's entrance (vortex()), and as it settles a sheen crosses the blue figure
      var va = vortexAt && live ? (now - vortexAt) / 1000 : 0;
      if (vortexShine && va >= VORTEX.shine) { vortexShine = false; shine(now, 1, SHEEN_SWEEP, false, ++bursts + 200); }
      if (va >= VORTEX.rise + VORTEX.settle || !live) vortexAt = 0;
      gl.uniform1f(U.u_vortex, vortex(va));
      // while Tide is on, its tide (tide()) rises through the figure on the page's clock
      var tideNow = colors.blue && live && !still ? tide(now / 1000) : [0, 0];
      gl.uniform2f(U.u_tide, tideNow[0], tideNow[1]);
      // the dots stand for light on dark paper; while the paper's turn swaps them, the new map's appear behind a band
      // of light and the old map's give way ahead of it
      var swapAge = swap ? Math.max(0, now - swap.at) / 1000 : 0;
      if (swap && (!live || swapAge >= SWAP)) swap = null;
      var swept = swap ? easeInOut(swapAge / SWAP) : 0;
      gl.uniform1f(U.u_positive, set === "light" ? 1 : 0);
      gl.uniform4f(U.u_swap, swept, swap ? -1 : 0, 1, 0);
      gl.bindVertexArray(vao);
      // (while the cloud bank is away its own dots, last in the buffer, are not drawn: the shader would only cull them)
      var drawn = bankNow > 0 ? count : count - bankTail;
      // while the switch glitches, two faint afterimages sit 2 px either side of the figure; a long tear leaves one
      if (switching || (tearing && tear.after)) {
        gl.uniform1f(U.u_alpha, 0.3);
        gl.uniform2f(U.u_offset, switching ? -2 : tear.after, 0);
        gl.drawArrays(gl.POINTS, 0, drawn);
        if (switching) {
          gl.uniform2f(U.u_offset, 2, 0);
          gl.drawArrays(gl.POINTS, 0, drawn);
        }
      }
      // while the other map is on its way the figure stays dimmed, as if the light had gone, until its band swaps them
      gl.uniform1f(U.u_alpha, set === dotMap(colors) || failed[dotMap(colors)] ? 1 : 0.6);
      gl.uniform2f(U.u_offset, 0, 0);
      var measure = !rendered && !queryPending;
      if (measure) gl.beginQuery(gl.ANY_SAMPLES_PASSED, query);
      gl.drawArrays(gl.POINTS, 0, drawn);
      if (measure) { gl.endQuery(gl.ANY_SAMPLES_PASSED); queryPending = true; }
      if (swap) {
        gl.uniform1f(U.u_positive, swap.positive);
        gl.uniform4f(U.u_swap, swept, -1, -1, 0);
        // (its underpaint is left out: drawn after the new dots, it would paper over them)
        gl.drawArrays(gl.POINTS, count + swap.under, (bankNow > 0 ? swap.count : swap.count - swap.tail) - swap.under);
      }
      var fade = live ? smoothstep(0, 0.7, (now - ringAt) / 1000) : 1;
      // a theme hover brightens the ring for 400 ms: up in the first 100, back down by the end
      var lit = live && ringLitAt ? (now - ringLitAt) / 400 : 1;
      var brighten = lit < 0.25 ? smoothstep(0, 0.25, lit) : 1 - smoothstep(0.25, 1, lit);
      var ringMotion = live ? {
        comet: (now / 1000) * (gear ? 1.8 : 0.9),
        wave: sheening ? { age: sheenAge, sweep: sheenSweep, lane: lane } : null
      } : null;
      drawRing(yaw.x, pitch.x, fade, beat, brighten, ringMotion);
      if (live) drawBolts(now);
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
      // Tide's surge lifts the dots into a vortex that settles as the palette turns (never under reduced motion, where
      // the switch has no phases)
      if (phase === "surge" && phaseNow !== "surge" && canInteract()) { vortexAt = performance.now(); vortexShine = true; }
      phaseNow = phase;
      // leaving Gear Two: the tearing stops just after the palette comes back
      if (was.gear && !colors.gear) { glitchUntil = Math.min(glitchUntil, performance.now() + 140); tear = null; }
      if (was.gear !== colors.gear) { ring = null; announce(); }
      // when the opening turns the page red, one bolt of lightning strikes the figure: the only lightning there is
      if (!was.gear && colors.gear && intro && intro.stage === "red" && canInteract()) strike(box.x + box.size / 2, box.y + box.size / 2);
      follow();
      sync();
    }

    function canInteract() { return ready && visible && !document.hidden && !motion.reduced(); }

    // A strike of lightning, once, as the opening turns the page red: a bolt from above lands on the figure, the stone
    // flashes around it, and a ring runs out through the dots.
    function strike(x, y) {
      var now = performance.now();
      ripples[nextRipple] = [x, y, now / 1000, colors.gear ? 1.4 : 1];
      nextRipple = (nextRipple + 1) % ripples.length;
      bolts.push({ at: now, path: boltPath(x, y, Math.floor(now)) });
    }

    // The bolt: from above the figure down to (x, y), split six times at jittered midpoints, with two short branches.
    function boltPath(x, y, seed) {
      var split = function (a, b, levels, s) {
        var pts = [a, b];
        for (var level = 0; level < levels; level++) {
          var next = [pts[0]];
          for (var i = 1; i < pts.length; i++) {
            var p = pts[i - 1], q = pts[i], len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
            var off = (hash(s + level * 131 + i * 7) - 0.5) * len * 0.5;
            next.push([(p[0] + q[0]) / 2 - (q[1] - p[1]) / len * off, (p[1] + q[1]) / 2 + (q[0] - p[0]) / len * off], q);
          }
          pts = next;
        }
        return pts;
      };
      var top = [x + (hash(seed) - 0.5) * box.size * 0.35, Math.max(4, box.y - pad * 0.85)];
      var main = split(top, [x, y], 6, seed + 11), lines = [main];
      [0.3, 0.55].forEach(function (f, k) {
        var from = main[Math.floor(main.length * f)], side = hash(seed + 29 + k) < 0.5 ? -1 : 1, len = Math.hypot(x - top[0], y - top[1]) * (0.18 + 0.12 * hash(seed + 31 + k));
        lines.push(split(from, [from[0] + side * len * 0.6, from[1] + len * 0.8], 4, seed + 41 + k * 13));
      });
      return lines;
    }

    // A bolt on the overlay flashes twice and is gone in 0.4 s: a bright core in a glow of the sheen's colours.
    function drawBolts(now) {
      bolts = bolts.filter(function (b) { return now - b.at < 400; });
      if (!bolts.length) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.globalCompositeOperation = colors.dark ? "lighter" : "source-over";
      bolts.forEach(function (b) {
        var t = (now - b.at) / 1000;
        var flash = t < 0.03 ? t / 0.03 : t < 0.07 ? 1 : t < 0.11 ? 0.35 : t < 0.16 ? 0.95 : Math.max(0, 1 - (t - 0.16) / 0.24);
        b.path.forEach(function (pts, k) {
          var weight = k ? 0.6 : 1;
          [[12, colors.light[0], 0.16], [4, colors.light[0], 0.5], [1.8, colors.dark ? "#ffffff" : colors.light[0], 1]].forEach(function (pass) {
            ctx.beginPath();
            ctx.moveTo(pts[0][0], pts[0][1]);
            for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
            ctx.lineWidth = pass[0] * weight;
            ctx.strokeStyle = pass[1];
            ctx.globalAlpha = pass[2] * flash * weight;
            ctx.stroke();
          });
        });
      });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    el.addEventListener("pointermove", function (e) {
      if (!canInteract()) return;
      if (e.pointerType === "touch") {
        if (!touch || e.pointerId !== touch.id) return;
        var dx = e.clientX - touch.x, dy = e.clientY - touch.y;
        if (!touch.dragging) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
          if (Math.abs(dy) >= Math.abs(dx)) { releaseTouch(e); return; }
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
      // the cursor's velocity
      var at = performance.now(), gap = (at - stir.at) / 1000;
      if (stir.at && gap > 0 && gap < 0.2) {
        var vx = (pointer.x - stir.px) / gap, vy = (pointer.y - stir.py) / gap, k = Math.min(1, gap * 12);
        stir.x += (vx - stir.x) * k;
        stir.y += (vy - stir.y) * k;
      }
      stir.at = at;
      stir.px = pointer.x;
      stir.py = pointer.y;
    });
    el.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "touch") {
        if (!el.hasPointerCapture(e.pointerId)) releaseTouch(e);
      } else pointer.inside = false;
    });
    el.addEventListener("pointerdown", function (e) {
      if (!canInteract() || touch || (e.pointerType === "touch" && !e.isPrimary)) return;
      setPointer(e);
      if (e.pointerType === "touch") {
        pointer.inside = false;
        pointer.tx = pointer.ty = pushK.x = pushK.v = 0;
        touch = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
      } else pointer.inside = true;
    });
    el.addEventListener("pointerup", function (e) { releaseTouch(e); });
    el.addEventListener("pointercancel", function (e) { releaseTouch(e); pointer.inside = false; });
    el.addEventListener("lostpointercapture", function (e) { releaseTouch(e); });
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); fallback(); });
    canvas.addEventListener("webglcontextrestored", initialize);
    new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-gear", "data-phase"] });
    var mq = global.matchMedia ? global.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq && mq.addEventListener) mq.addEventListener("change", onTheme);
    motion.subscribe(sync);
    document.addEventListener("visibilitychange", sync);
    new IntersectionObserver(function (records) { onScreen(records[records.length - 1].isIntersecting); }).observe(el);
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
          (data.core != null && !(Array.isArray(data.core) && data.core.length === 2 && data.core.every(normalized))) ||
          (data.features != null && !(Array.isArray(data.features) && data.features.every(function (z) {
            return Array.isArray(z) && z.length === 5 && z.every(Number.isFinite) && normalized(z[0]) && normalized(z[1]) && z[2] > 0 && z[3] > 0 && z[2] < 0.5 && z[3] < 0.5;
          }))) ||
          (data.joints != null && !(typeof data.joints === "object" && !Array.isArray(data.joints) && Object.keys(data.joints).every(function (name) {
            var j = data.joints[name];
            return PART_NAMES.indexOf(name) >= 0 && Array.isArray(j) && j.length === 2 && j.every(normalized);
          })))) throw new Error("hero metadata is invalid");
      sources[first] = all[0];
      set = first;
      relief = all[1];
      field = reliefField(relief.data, relief.width, 1.5);
      noise = { width: all[2].width, data: (function () { var d = all[2].data, o = new Uint8Array(d.length / 4); for (var i = 0; i < o.length; i++) o[i] = d[i * 4]; return o; })() };
      meta = data;
      staff = staffAxis(meta.joints);
      palette = all[4];
      initialize();
      follow();
    }).catch(fallback);

    return {
      // brighten the ring once (nothing moves under reduced motion; the still is simply redrawn)
      highlight: function () { if (canInteract()) ringLitAt = performance.now(); else if (motion.reduced()) sync(); },
      count: function () { return count; },
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
    vortex: vortex,
    tide: tide,
    VORTEX: VORTEX,
    TIDE: TIDE,
    life: life,
    breathAt: breathAt,
    keyLight: keyLight,
    staffAxis: staffAxis,
    LIFE: LIFE,
    PART_NAMES: PART_NAMES,
    STAFF_FROM: STAFF_FROM,
    spring: spring,
    rippleWeight: rippleWeight,
    stipple: stipple,
    fineScale: fineScale,
    withinZones: withinZones,
    outlineField: outlineField,
    underpaint: underpaint,
    UNDER: UNDER,
    glints: glints,
    skyStars: skyStars,
    edges: edges,
    strokes: strokes,
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
    project: project,
    sheenWay: sheenWay,
    wayAt: wayAt,
    WAY: WAY,
    WAY_MARGIN: WAY_MARGIN
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SkyHero = api;
})(typeof window !== "undefined" ? window : globalThis);
