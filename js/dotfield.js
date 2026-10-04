(function (global) {
  "use strict";

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

  function bayer(x, y) {
    return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  }

  function rowStream(words, row) {
    var list = words.slice();
    var seed = (Math.imul(row + 7, 2246822519) ^ 0x5bd1e995) >>> 0;
    for (var i = list.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      var j = seed % (i + 1);
      var held = list[i];
      list[i] = list[j];
      list[j] = held;
    }
    return list.join("/") + "/";
  }

  function heartbeat(t) {
    var p = (t % 0.92) / 0.92;
    return Math.exp(-Math.pow((p - 0.08) / 0.045, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.3) / 0.05, 2));
  }

  function flow(c, r, t) {
    return 0.6 * Math.sin(c * 0.23 + t * 0.9 + 2.1 * Math.sin(r * 0.17 - t * 0.5)) +
      0.4 * Math.sin(r * 0.31 - t * 0.7 + 1.7 * Math.cos(c * 0.11 + t * 0.3));
  }

  function dissolveAt(ms) {
    if (ms < 0) return 0;
    var p = (ms % 9000) / 9000;
    if (p < 0.7) return 0;
    return Math.sin(((p - 0.7) / 0.3) * Math.PI);
  }

  function luminance(data, i) {
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  }

  function sampler(img, w, h, crop) {
    var canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    if (crop) ctx.drawImage(img, crop[0], crop[1], crop[2], crop[3], 0, 0, w, h);
    else ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  }

  function hash(x, y) {
    var h = Math.imul(x * 374761393 + y * 668265263, 1274126177) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
    return (h & 0xffff) / 0x10000;
  }

  function boxBlur(src, n, radius) {
    var a = new Float32Array(src), b = new Float32Array(n * n), span = radius * 2 + 1;
    for (var pass = 0; pass < 2; pass++) {
      for (var y = 0; y < n; y++) {
        var acc = 0;
        for (var i = -radius; i <= radius; i++) acc += a[y * n + Math.min(n - 1, Math.max(0, i))];
        for (var x = 0; x < n; x++) {
          b[y * n + x] = acc / span;
          acc += a[y * n + Math.min(n - 1, x + radius + 1)] - a[y * n + Math.max(0, x - radius)];
        }
      }
      for (var x2 = 0; x2 < n; x2++) {
        var acc2 = 0;
        for (var j = -radius; j <= radius; j++) acc2 += b[Math.min(n - 1, Math.max(0, j)) * n + x2];
        for (var y2 = 0; y2 < n; y2++) {
          a[y2 * n + x2] = acc2 / span;
          acc2 += b[Math.min(n - 1, y2 + radius + 1) * n + x2] - b[Math.max(0, y2 - radius) * n + x2];
        }
      }
    }
    return a;
  }

  // The avatar as a bas-relief: bright areas rise toward the viewer, and an
  // ordered dither decides which cells become points so tone reads as density.
  // Returns [x, y, z, weight] per point in units of the figure width.
  function relief(img, n, depth) {
    var data = sampler(img, n, n);
    var lum = new Float32Array(n * n);
    for (var i = 0; i < n * n; i++) lum[i] = Math.min(1, Math.max(0, (luminance(data, i * 4) - 0.04) * 1.6));
    var height = boxBlur(lum, n, 2);
    var out = [];
    var r = n / 2;
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        var dx = x + 0.5 - r, dy = y + 0.5 - r;
        if (dx * dx + dy * dy > (r - 1) * (r - 1)) continue;
        var l = lum[y * n + x];
        var u = (x + 0.5) / n - 0.5, v = (y + 0.5) / n - 0.5;
        if (l > 0.2 && l > bayer(x, y) * 0.95) {
          var jx = (hash(x, y) - 0.5) * 0.9 / n, jy = (hash(y + 31, x + 17) - 0.5) * 0.9 / n;
          out.push(u + jx, v + jy, -depth * Math.pow(height[y * n + x], 0.75), l);
        }
      }
    }
    return new Float32Array(out);
  }

  function palette() {
    var root = document.documentElement;
    var styles = getComputedStyle(root);
    var read = function (name) { return styles.getPropertyValue(name).trim(); };
    return {
      ink: read("--figure-ink"),
      accent: read("--accent"),
      inkAlpha: parseFloat(read("--figure-ink-alpha")) || 1,
      gear: root.getAttribute("data-gear") === "two"
    };
  }

  function watch(callback) {
    var observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-gear"] });
    return observer;
  }

  // A rotating point cloud with a word layer that wraps whatever is in view.
  // options.points(width, height) returns [x, y, z, weight] per point, x and y as
  // fractions of the box, z in units of the box width.
  function mountCloud(box, options) {
    var reduced = options.reduced;
    var canvas = document.createElement("canvas");
    canvas.className = "figure-canvas";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var glow = document.createElement("canvas");
    var gctx = glow.getContext("2d");
    var colors = palette();
    var gearTwo = colors.gear;
    var w = 0, h = 0, margin = 0, dpr = 1, count = 0;
    var base = null, ox, oy, vx, vy, sx, sy, depthOf, delay, phase, freq, spread, blinkUntil;
    var cols = 0, rows = 0, cw = 0, rh = 0, fontPx = 0, cover = null, lit = null, coverMax = 1, streams = [];
    var pointer = { x: 0, y: 0, active: false };
    var tilt = { x: 0, y: 0 };
    var waves = [];
    var startAt = 0, last = 0, raf = 0, visible = true, ready = false;

    function moving() { return !reduced.matches; }

    function build(first) {
      w = box.clientWidth;
      h = box.clientHeight;
      if (!w || !h) return false;
      margin = Math.round(Math.max(w, h) * 0.3);
      dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round((w + margin * 2) * dpr);
      canvas.height = Math.round((h + margin * 2) * dpr);
      canvas.style.left = canvas.style.top = -margin + "px";
      canvas.style.width = w + margin * 2 + "px";
      canvas.style.height = h + margin * 2 + "px";
      ctx.setTransform(dpr, 0, 0, dpr, dpr * margin, dpr * margin);
      var points = options.points(w, h);
      var reuse = !first && points.length / 4 === count;
      base = points;
      count = points.length / 4;
      if (!reuse) {
        ox = new Float32Array(count); oy = new Float32Array(count);
        vx = new Float32Array(count); vy = new Float32Array(count);
        sx = new Float32Array(count); sy = new Float32Array(count); depthOf = new Float32Array(count);
        delay = new Float32Array(count); phase = new Float32Array(count);
        freq = new Float32Array(count); spread = new Float32Array(count);
        blinkUntil = new Float32Array(count);
        for (var k = 0; k < count; k++) {
          phase[k] = Math.random() * Math.PI * 2;
          freq[k] = 1 + Math.random() * 3.4;
          spread[k] = 0.4 + Math.random() * 1.1;
          var fromCenter = Math.hypot(base[k * 4], base[k * 4 + 1]) * 2;
          delay[k] = fromCenter * 520 + Math.random() * 420;
          if (first) {
            var angle = Math.random() * Math.PI * 2, reach = (0.55 + Math.random() * 0.75) * Math.max(w, h);
            ox[k] = Math.cos(angle) * reach;
            oy[k] = Math.sin(angle) * reach * 0.8;
          }
        }
      }
      cols = options.cols(w);
      cw = w / cols;
      ctx.font = "700 100px " + MONO;
      fontPx = (cw * 100) / ctx.measureText("M").width;
      rows = Math.max(10, Math.round(h / (fontPx * 1.06)));
      rh = h / rows;
      cover = new Float32Array(cols * rows);
      lit = new Uint8Array(cols * rows);
      glow.width = cols + 4;
      glow.height = rows + 4;
      streams = [];
      for (var s = 0; s < rows; s++) streams.push(rowStream(options.words, s));
      return true;
    }

    function step(now, k60, d) {
      var stiff = (gearTwo ? 0.1 : 0.075) * k60 * (1 - 0.8 * d);
      var damp = Math.pow(gearTwo ? 0.8 : 0.84, k60);
      var reach = Math.max(56, w * 0.12);
      var elapsed = now - startAt;
      var cx = w / 2, cy = h / 2;
      waves = waves.filter(function (wave) { return now - wave.at < 1100; });
      for (var k = 0; k < count; k++) {
        var tx = 0, ty = 0;
        if (d > 0) {
          var dx0 = sx[k] - cx, dy0 = sy[k] - cy, len = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1;
          var push = d * spread[k] * w * (gearTwo ? 0.42 : 0.3);
          tx = (dx0 / len) * push;
          ty = (dy0 / len) * push - d * w * 0.08 * spread[k];
        }
        var ax = 0, ay = 0;
        if (elapsed > delay[k]) {
          ax = (tx - ox[k]) * stiff;
          ay = (ty - oy[k]) * stiff;
        }
        if (pointer.active) {
          var px = sx[k] + ox[k] - pointer.x, py = sy[k] + oy[k] - pointer.y, d2 = px * px + py * py;
          if (d2 < reach * reach && d2 > 0.01) {
            var dist = Math.sqrt(d2), f = 1 - dist / reach;
            f = f * f * (gearTwo ? 5 : 3.2) * k60;
            ax += (px / dist) * f;
            ay += (py / dist) * f;
          }
        }
        for (var i = 0; i < waves.length; i++) {
          var wave = waves[i], age = (now - wave.at) / 1000;
          var wx = sx[k] + ox[k] - wave.x, wy = sy[k] + oy[k] - wave.y, wd = Math.sqrt(wx * wx + wy * wy) || 1;
          var gap = Math.abs(wd - age * 760);
          if (gap < 44) {
            var p = (1 - gap / 44) * wave.power * (1 - age / 1.1) * k60;
            ax += (wx / wd) * p;
            ay += (wy / wd) * p;
          }
        }
        vx[k] = (vx[k] + ax) * damp;
        vy[k] = (vy[k] + ay) * damp;
        ox[k] += vx[k] * k60;
        oy[k] += vy[k] * k60;
      }
      var blinks = Math.ceil(count * (gearTwo ? 0.006 : 0.0035) * k60);
      for (var b = 0; b < blinks; b++) blinkUntil[(Math.random() * count) | 0] = now + 60 + Math.random() * 240;
    }

    function render(now) {
      var live = moving();
      var t = now / 1000;
      var k60 = Math.min(3, (last ? now - last : 16.7) / 16.7);
      last = now;
      var beat = gearTwo && live ? heartbeat(t) : 0;
      var d = options.dissolve && live ? dissolveAt(now - startAt - 2600) : 0;
      if (live) step(now, k60, d);
      var aimX = pointer.active ? pointer.x / w - 0.5 : 0, aimY = pointer.active ? pointer.y / h - 0.5 : 0;
      tilt.x += (aimX - tilt.x) * Math.min(1, 0.06 * k60);
      tilt.y += (aimY - tilt.y) * Math.min(1, 0.06 * k60);
      var speed = options.speed * (gearTwo ? 1.8 : 1);
      var yaw = (live ? options.yaw * Math.sin(t * speed) : options.rest) + tilt.x * 0.8;
      var pitch = (live ? options.pitch * Math.sin(t * speed * 0.73 + 1) : 0) - tilt.y * 0.55;
      var cyaw = Math.cos(yaw), syaw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      var focal = w * 2.4, cx = w / 2, cy = h / 2;
      var zs = 1 + 0.5 * beat;
      var dot = Math.max(1.2, w / 470) * (1 + 0.35 * beat);
      var round = function (v) { return Math.round(v * dpr) / dpr; };
      cover.fill(0);
      for (var k = 0; k < count; k++) {
        var bx = base[k * 4] * w, by = base[k * 4 + 1] * h, bz = base[k * 4 + 2] * w * zs;
        var x1 = bx * cyaw + bz * syaw, z1 = -bx * syaw + bz * cyaw;
        var y1 = by * cp - z1 * sp, z2 = by * sp + z1 * cp;
        var persp = focal / (focal + z2);
        sx[k] = cx + x1 * persp;
        sy[k] = cy + y1 * persp;
        depthOf[k] = z2;
        var X = sx[k] + (live ? ox[k] : 0), Y = sy[k] + (live ? oy[k] : 0);
        var c = Math.floor(X / cw), r = Math.floor(Y / rh);
        if (c >= 0 && c < cols && r >= 0 && r < rows) cover[r * cols + c] += base[k * 4 + 3] * persp;
      }
      var peak = 0;
      for (var m = 0; m < cover.length; m++) if (cover[m] > peak) peak = cover[m];
      coverMax = coverMax * 0.85 + Math.max(peak, 0.001) * 0.15;
      var wordFade = live ? Math.min(1, Math.max(0, (now - startAt - 1100) / 700)) * (1 - 0.85 * d) : 1;
      markWords(t, live, wordFade);

      var near = new Path2D(), mid = new Path2D(), far = new Path2D();
      for (var q = 0; q < count; q++) {
        var weight = base[q * 4 + 3];
        var PX = sx[q] + (live ? ox[q] : 0), PY = sy[q] + (live ? oy[q] : 0);
        var pc = Math.floor(PX / cw), pr = Math.floor(PY / rh);
        if (pc >= 0 && pc < cols && pr >= 0 && pr < rows && lit[pr * cols + pc]) continue;
        if (live) {
          if (blinkUntil[q] > now) continue;
          if (weight < 0.34 * (1 + Math.sin(t * freq[q] + phase[q])) * 0.5 + 0.1) continue;
        }
        var zq = depthOf[q], pq = focal / (focal + zq);
        var size = dot * pq * (0.65 + 0.45 * weight);
        var path = zq < -w * 0.04 ? near : zq < w * 0.02 ? mid : far;
        path.rect(round(PX - size / 2), round(PY - size / 2), size, size);
      }
      var fade = live ? Math.min(1, Math.max(0, (now - startAt) / 900)) : 1;

      ctx.clearRect(-margin, -margin, w + margin * 2, h + margin * 2);
      drawGlow(fade * (gearTwo ? 0.5 : 0.3) * (1 + 0.6 * beat));
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = colors.inkAlpha * 0.3 * fade;
      ctx.fill(far);
      ctx.globalAlpha = colors.inkAlpha * 0.6 * fade;
      ctx.fill(mid);
      ctx.globalAlpha = colors.inkAlpha * 0.9 * fade;
      ctx.fill(near);
      ctx.globalAlpha = 1;
      drawWords(t, live, wordFade);
    }

    function drawGlow(alpha) {
      var image = gctx.createImageData(cols + 4, rows + 4);
      var rgb = parseColor(colors.accent);
      var soft = softGrid(cover, cols, rows);
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var v = Math.min(1, soft[r * cols + c] / coverMax);
          var o = ((r + 2) * (cols + 4) + c + 2) * 4;
          image.data[o] = rgb[0];
          image.data[o + 1] = rgb[1];
          image.data[o + 2] = rgb[2];
          image.data[o + 3] = Math.round(Math.pow(v, 1.6) * 255);
        }
      }
      gctx.putImageData(image, 0, 0);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(glow, -2 * cw, -2 * rh, w + 4 * cw, h + 4 * rh);
      ctx.restore();
    }

    var lines = [];

    function markWords(t, live, fade) {
      lit.fill(0);
      lines.length = 0;
      if (fade <= 0.01) return;
      var shift = live ? Math.floor(t * (gearTwo ? 14 : 9)) : 0;
      var threshold = options.threshold;
      for (var r = 0; r < rows; r++) {
        if (gearTwo && live && (r + Math.floor(t * 14)) % 9 === 0) continue;
        var line = streams[r], len = line.length, start = (shift + r * 7) % len, text = "", any = false;
        for (var c = 0; c < cols; c++) {
          var v = cover[r * cols + c] / coverMax;
          var level = live ? v + 0.14 * flow(c * 0.5, r * 0.65, t) : v;
          if (level < threshold) { text += " "; continue; }
          text += line[(c + start) % len];
          lit[r * cols + c] = 1;
          any = true;
        }
        if (any) lines.push(r, text);
      }
    }

    function drawWords(t, live, fade) {
      if (!lines.length) return;
      ctx.globalAlpha = fade;
      ctx.fillStyle = colors.accent;
      ctx.font = "700 " + fontPx + "px " + MONO;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (var i = 0; i < lines.length; i += 2) {
        var r = lines[i];
        var nudge = gearTwo && live && (r * 13 + Math.floor(t * 18)) % 23 === 0 ? ((r * 7 + Math.floor(t * 30)) % 7) - 3 : 0;
        ctx.fillText(lines[i + 1], nudge, (r + 0.5) * rh);
      }
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      raf = 0;
      if (!ready || !visible || document.hidden || !moving()) return;
      render(now);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (!ready) return;
      if (!moving()) {
        render(performance.now());
        return;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    function local(event) {
      var rect = box.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (w / rect.width), y: (event.clientY - rect.top) * (h / rect.height) };
    }

    box.addEventListener("pointermove", function (event) {
      var at = local(event);
      pointer.x = at.x;
      pointer.y = at.y;
      pointer.active = true;
    });
    box.addEventListener("pointerleave", function () { pointer.active = false; });
    box.addEventListener("pointerdown", function (event) {
      if (!ready || !moving()) return;
      var at = local(event);
      waves.push({ x: at.x, y: at.y, at: performance.now(), power: gearTwo ? 11 : 8 });
    });
    new ResizeObserver(function () {
      if (ready && (Math.abs(box.clientWidth - w) > 0.5 || Math.abs(box.clientHeight - h) > 0.5)) {
        build(false);
        sync();
      }
    }).observe(box);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(box);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    watch(function () {
      var was = gearTwo;
      colors = palette();
      gearTwo = colors.gear;
      if (ready && was !== gearTwo && moving()) {
        for (var k = 0; k < count; k++) {
          var angle = Math.atan2(sy[k] - h / 2, sx[k] - w / 2) + (Math.random() - 0.5) * 0.9;
          var speed = 5 + Math.random() * 15;
          vx[k] += Math.cos(angle) * speed - Math.sin(angle) * speed * 0.35;
          vy[k] += Math.sin(angle) * speed + Math.cos(angle) * speed * 0.35;
        }
        waves.push({ x: w / 2, y: h / 2, at: performance.now(), power: 9 });
      }
      sync();
    });

    function start() {
      if (!build(true)) return;
      ready = true;
      startAt = performance.now();
      box.classList.add("is-ready");
      sync();
    }

    return { start: start };
  }

  function softGrid(src, cols, rows) {
    var out = new Float32Array(src.length);
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var sum = 0, n = 0;
        for (var dr = -2; dr <= 2; dr++) {
          var rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (var dc = -2; dc <= 2; dc++) {
            var cc = c + dc;
            if (cc < 0 || cc >= cols) continue;
            sum += src[rr * cols + cc];
            n++;
          }
        }
        out[r * cols + c] = sum / n;
      }
    }
    return out;
  }

  function parseColor(value) {
    var probe = parseColor.ctx || (parseColor.ctx = document.createElement("canvas").getContext("2d"));
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    var hex = probe.fillStyle;
    if (hex.charAt(0) === "#") return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    var parts = hex.match(/[\d.]+/g) || [0, 0, 0];
    return [+parts[0], +parts[1], +parts[2]];
  }

  function mountHero(box, options) {
    var img = new Image();
    var cloud = mountCloud(box, {
      reduced: options.reduced,
      words: options.words,
      threshold: 0.3,
      yaw: 0.38,
      pitch: 0.09,
      speed: 0.32,
      rest: 0.22,
      dissolve: false,
      cols: function (width) { return width < 380 ? 40 : width < 560 ? 50 : 60; },
      points: function (width) { return relief(img, width < 380 ? 116 : width < 560 ? 144 : 176, 0.2); }
    });
    img.onload = cloud.start;
    img.src = options.src;
  }

  function mountDither(box, options) {
    var reduced = options.reduced;
    var canvas = document.createElement("canvas");
    canvas.className = "dither-canvas";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var img = new Image();
    var colors = palette();
    var width = 0, height = 0, dpr = 1, gw = 0, gh = 0, cell = 4;
    var lum = null, phase = null, freq = null, reveal = null;
    var pointer = { x: -999, y: -999, active: false };
    var startAt = 0, raf = 0, visible = false, ready = false, seen = false;

    function build() {
      width = box.clientWidth;
      height = box.clientHeight;
      if (!width || !height) return false;
      dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = width < 260 ? 3 : 4;
      gw = Math.floor(width / cell);
      gh = Math.floor(height / cell);
      var crop = options.crop.slice();
      var aspect = gw / gh, cropAspect = crop[2] / crop[3];
      if (cropAspect > aspect) {
        var nw = crop[3] * aspect;
        crop[0] += (crop[2] - nw) / 2;
        crop[2] = nw;
      } else {
        var nh = crop[2] / aspect;
        crop[1] += (crop[3] - nh) * 0.2;
        crop[3] = nh;
      }
      var data = sampler(img, gw, gh, crop);
      var total = gw * gh;
      lum = new Float32Array(total);
      phase = new Float32Array(total);
      freq = new Float32Array(total);
      reveal = new Float32Array(total);
      for (var i = 0; i < total; i++) {
        lum[i] = Math.min(1, Math.max(0, (luminance(data, i * 4) - 0.03) * 1.5));
        phase[i] = Math.random() * Math.PI * 2;
        freq[i] = 0.8 + Math.random() * 3.2;
        reveal[i] = ((i / gw) | 0) / gh * 900 + Math.random() * 500;
      }
      return true;
    }

    function render(now) {
      var live = !reduced.matches;
      var t = now / 1000;
      var elapsed = now - startAt;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = colors.inkAlpha;
      ctx.beginPath();
      var s = cell - 1;
      for (var y = 0; y < gh; y++) {
        for (var x = 0; x < gw; x++) {
          var i = y * gw + x;
          if (live && elapsed < reveal[i]) continue;
          var gate = bayer(x, y);
          if (live) gate += 0.16 * Math.sin(t * freq[i] + phase[i]);
          if (pointer.active) {
            var dx = x * cell - pointer.x, dy = y * cell - pointer.y, d2 = dx * dx + dy * dy;
            if (d2 < 4900) gate -= 0.5 * (1 - Math.sqrt(d2) / 70);
          }
          if (lum[i] > gate) ctx.rect(x * cell, y * cell, s, s);
        }
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      raf = 0;
      if (!ready || !visible || document.hidden || reduced.matches) return;
      render(now);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!ready) return;
      if (reduced.matches) {
        render(startAt + 1e6);
        return;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    function begin() {
      if (visible && !seen && ready) {
        seen = true;
        startAt = performance.now();
      }
    }

    box.addEventListener("pointermove", function (event) {
      var rect = canvas.getBoundingClientRect();
      pointer.x = (event.clientX - rect.left) * (width / rect.width);
      pointer.y = (event.clientY - rect.top) * (height / rect.height);
      pointer.active = true;
    });
    box.addEventListener("pointerleave", function () { pointer.active = false; });
    new ResizeObserver(function () {
      if (ready && (Math.abs(box.clientWidth - width) > 0.5 || Math.abs(box.clientHeight - height) > 0.5)) {
        build();
        sync();
      }
    }).observe(box);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      begin();
      sync();
    }, { threshold: 0.2 }).observe(box);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    watch(function () {
      colors = palette();
      sync();
    });

    img.onload = function () {
      if (!build()) return;
      ready = true;
      begin();
      box.classList.add("is-ready");
      sync();
    };
    img.src = options.src;
  }

  var api = { mountCloud: mountCloud, mountHero: mountHero, mountDither: mountDither, bayer: bayer, rowStream: rowStream, heartbeat: heartbeat, flow: flow, dissolveAt: dissolveAt, boxBlur: boxBlur };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Dotfield = api;
})(typeof window !== "undefined" ? window : globalThis);
