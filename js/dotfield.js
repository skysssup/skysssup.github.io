(function (global) {
  "use strict";

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  var WORDS = ["AI", "AGENTS", "SKY", "SHITPOSTING", "ROBOTICS", "ENGINEER"];
  var SCRAMBLE = "#%&@$*+=<>{}[]01/\\";
  var TEARS = "▚▞▖▗▘▝■□▪▫";
  var MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

  function bayer(x, y) {
    return (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  }

  function rowStream(row) {
    var words = WORDS.slice();
    var seed = (Math.imul(row + 7, 2246822519) ^ 0x5bd1e995) >>> 0;
    for (var i = words.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      var j = seed % (i + 1);
      var held = words[i];
      words[i] = words[j];
      words[j] = held;
    }
    return words.join("/") + "/";
  }

  function heartbeat(t) {
    var p = (t % 0.92) / 0.92;
    return Math.exp(-Math.pow((p - 0.08) / 0.045, 2)) + 0.6 * Math.exp(-Math.pow((p - 0.3) / 0.05, 2));
  }

  function flow(c, r, t) {
    return 0.6 * Math.sin(c * 0.23 + t * 0.9 + 2.1 * Math.sin(r * 0.17 - t * 0.5)) +
      0.4 * Math.sin(r * 0.31 - t * 0.7 + 1.7 * Math.cos(c * 0.11 + t * 0.3));
  }

  function luminance(data, i) {
    return (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
  }

  function palette() {
    var styles = getComputedStyle(document.documentElement);
    var read = function (name) { return styles.getPropertyValue(name).trim(); };
    var root = document.documentElement;
    return {
      ink: read("--figure-ink"),
      off: read("--figure-off"),
      accent: read("--accent"),
      split: read("--split"),
      inkAlpha: parseFloat(read("--figure-ink-alpha")) || 1,
      positive: read("--figure-ink-from") !== "highlight",
      gear: root.getAttribute("data-gear") === "two"
    };
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

  function watch(callback) {
    var observer = new MutationObserver(callback);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-gear", "data-motion"] });
    return observer;
  }

  function motionAllowed(reduced) {
    return !reduced.matches && document.documentElement.getAttribute("data-motion") !== "off";
  }

  function mountHero(box, options) {
    var reduced = options.reduced;
    var canvas = document.createElement("canvas");
    canvas.className = "figure-canvas";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var matrix = document.createElement("canvas");
    var mctx = matrix.getContext("2d");
    var glow = document.createElement("canvas");
    var gctx = glow.getContext("2d");
    var img = new Image();
    var colors = palette();
    var size = 0, dpr = 1, n = 0, cell = 0, count = 0, margin = 0, span = 0;
    var avoid = options.avoid || null;
    var hx, hy, px, py, vx, vy, lum, thr, phase, freq, delay, blinkUntil;
    var cols = 0, rows = 0, cw = 0, rh = 0, fontPx = 0, glyphLum = null, streams = [];
    var tiles = [];
    var pointer = { x: 0, y: 0, active: false };
    var waves = [];
    var glitch = { until: 0, next: 0, bands: [] };
    var introAt = 0, last = 0, raf = 0, visible = true, ready = false, gearTwo = colors.gear;

    function build(first) {
      var width = box.clientWidth;
      if (!width || !img.naturalWidth) return false;
      size = width;
      margin = Math.round(size * 0.3);
      span = size + margin * 2;
      dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round(span * dpr);
      canvas.height = Math.round(span * dpr);
      canvas.style.inset = -margin + "px";
      canvas.style.width = canvas.style.height = span + "px";
      matrix.width = matrix.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, dpr * margin, dpr * margin);
      mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      n = size < 380 ? 72 : size < 540 ? 92 : 112;
      cell = size / n;
      var data = sampler(img, n, n);
      var radius = n / 2;
      var inside = [];
      for (var gy = 0; gy < n; gy++) {
        for (var gx = 0; gx < n; gx++) {
          var dx = gx + 0.5 - radius, dy = gy + 0.5 - radius;
          if (dx * dx + dy * dy <= (radius - 0.6) * (radius - 0.6)) inside.push(gy * n + gx);
        }
      }
      var keep = !first && count === inside.length;
      count = inside.length;
      if (!keep) {
        hx = new Float32Array(count); hy = new Float32Array(count);
        px = new Float32Array(count); py = new Float32Array(count);
        vx = new Float32Array(count); vy = new Float32Array(count);
        lum = new Float32Array(count); thr = new Float32Array(count);
        phase = new Float32Array(count); freq = new Float32Array(count);
        delay = new Float32Array(count); blinkUntil = new Float32Array(count);
      }
      var center = size / 2;
      for (var k = 0; k < count; k++) {
        var idx = inside[k], cx = idx % n, cy = (idx / n) | 0;
        var l = luminance(data, idx * 4);
        lum[k] = Math.min(1, Math.max(0, (l - 0.035) * 1.45));
        thr[k] = bayer(cx, cy);
        var oldX = hx[k], oldY = hy[k];
        hx[k] = (cx + 0.5) * cell;
        hy[k] = (cy + 0.5) * cell;
        if (!keep) {
          phase[k] = Math.random() * Math.PI * 2;
          freq[k] = 1.1 + Math.random() * 3.6;
          var angle = Math.random() * Math.PI * 2;
          var spread = size * (0.55 + Math.random() * 0.75);
          px[k] = first ? center + Math.cos(angle) * spread : hx[k];
          py[k] = first ? center + Math.sin(angle) * spread * 0.8 : hy[k];
          var fromCenter = Math.hypot(hx[k] - center, hy[k] - center) / center;
          delay[k] = fromCenter * 520 + Math.random() * 380;
        } else {
          px[k] += hx[k] - oldX;
          py[k] += hy[k] - oldY;
        }
      }

      cols = size < 380 ? 38 : size < 540 ? 48 : 60;
      cw = size / cols;
      ctx.font = "700 100px " + MONO;
      fontPx = (cw * 100) / ctx.measureText("M").width;
      rows = Math.max(12, Math.round(size / (fontPx * 1.08)));
      rh = size / rows;
      var glyphData = sampler(img, cols, rows);
      glyphLum = new Float32Array(cols * rows);
      var seen = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var ex = (c + 0.5) / cols - 0.5, ey = (r + 0.5) / rows - 0.5;
          var value = ex * ex + ey * ey > 0.2 ? -1 : luminance(glyphData, (r * cols + c) * 4);
          glyphLum[r * cols + c] = value;
          if (value >= 0) seen.push(value);
        }
      }
      seen.sort(function (a, b) { return a - b; });
      var top = seen[Math.floor(seen.length * 0.95)] || 1;
      for (var g = 0; g < glyphLum.length; g++) if (glyphLum[g] >= 0) glyphLum[g] = Math.min(1, glyphLum[g] / top);
      streams = [];
      for (var s = 0; s < rows; s++) streams.push(rowStream(s));

      var tile = size < 540 ? 62 : 84;
      var across = Math.floor(size / tile);
      var offset = (size - across * tile) / 2;
      var now = performance.now();
      var blocked = null;
      if (avoid) {
        var a = avoid.getBoundingClientRect(), b = box.getBoundingClientRect(), k2 = size / b.width;
        blocked = { x0: (a.left - b.left) * k2, y0: (a.top - b.top) * k2, x1: (a.right - b.left) * k2, y1: (a.bottom - b.top) * k2 };
      }
      tiles = [];
      for (var ty = 0; ty < across; ty++) {
        for (var tx = 0; tx < across; tx++) {
          var x0 = offset + tx * tile, y0 = offset + ty * tile;
          if (Math.hypot(x0 + tile / 2 - center, y0 + tile / 2 - center) > center * 0.82) continue;
          if (blocked && x0 < blocked.x1 && x0 + tile > blocked.x0 && y0 < blocked.y1 && y0 + tile > blocked.y0) continue;
          tiles.push({ x: x0, y: y0, w: tile, h: tile, on: false, onAt: 0, showAt: now + 1600 + Math.random() * 11000, hideAt: 0 });
        }
      }
      paintMatrix();
      return true;
    }

    function paintGlow() {
      var res = 96;
      var data = sampler(img, res, res);
      var small = document.createElement("canvas");
      small.width = small.height = res;
      var sctx = small.getContext("2d");
      var out = sctx.createImageData(res, res);
      sctx.fillStyle = colors.accent;
      sctx.fillRect(0, 0, 1, 1);
      var tint = sctx.getImageData(0, 0, 1, 1).data;
      for (var i = 0; i < res * res; i++) {
        var x = i % res, y = (i / res) | 0;
        var dx = x + 0.5 - res / 2, dy = y + 0.5 - res / 2;
        var inside = dx * dx + dy * dy < (res / 2 - 1) * (res / 2 - 1);
        var a = inside ? Math.max(0, Math.min(1, (luminance(data, i * 4) - 0.1) / 0.45)) : 0;
        out.data[i * 4] = tint[0];
        out.data[i * 4 + 1] = tint[1];
        out.data[i * 4 + 2] = tint[2];
        out.data[i * 4 + 3] = Math.round(Math.pow(a, 1.3) * 255);
      }
      sctx.putImageData(out, 0, 0);
      glow.width = glow.height = Math.round(size * dpr);
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gctx.clearRect(0, 0, size, size);
      gctx.filter = "blur(" + Math.round(size / 90) + "px)";
      gctx.imageSmoothingEnabled = true;
      gctx.drawImage(small, 0, 0, size, size);
      gctx.filter = "none";
    }

    function paintMatrix() {
      paintGlow();
      mctx.clearRect(0, 0, size, size);
      mctx.fillStyle = colors.off;
      var s = Math.max(1, cell * 0.38);
      mctx.beginPath();
      for (var k = 0; k < count; k++) mctx.rect(hx[k] - s / 2, hy[k] - s / 2, s, s);
      mctx.fill();
    }

    function inkOf(k) {
      return colors.positive ? 1 - lum[k] : lum[k];
    }

    function bandShift(y) {
      for (var b = 0; b < glitch.bands.length; b++) {
        var band = glitch.bands[b];
        if (y >= band.y0 && y <= band.y1) return band.dx;
      }
      return 0;
    }

    function drawDots(now, t, beat, glitching) {
      var s = cell * (gearTwo ? 0.6 : 0.66) * (1 + 0.42 * beat);
      var half = s / 2;
      var round = function (v) { return Math.round(v * dpr) / dpr; };
      var moving = motionAllowed(reduced);
      ctx.globalAlpha = colors.inkAlpha;
      ctx.fillStyle = colors.ink;
      ctx.beginPath();
      var split = glitching ? [] : null;
      for (var k = 0; k < count; k++) {
        var level = inkOf(k);
        var gate = thr[k];
        if (moving) {
          gate += 0.17 * Math.sin(t * freq[k] + phase[k]) + 0.07 * Math.sin(hx[k] * 0.013 + hy[k] * 0.009 - t * 1.6);
          if (blinkUntil[k] > now) continue;
        }
        if (level <= gate) continue;
        var x = px[k], y = py[k];
        if (glitching) {
          var shift = bandShift(y);
          if (shift) {
            x += shift;
            split.push(x, y);
          }
        }
        ctx.rect(round(x - half), round(y - half), s, s);
      }
      ctx.fill();
      if (split && split.length) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = colors.split;
        ctx.beginPath();
        for (var i = 0; i < split.length; i += 2) ctx.rect(round(split[i] - half + 3), round(split[i + 1] - half), s, s);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawGlyphs(now, t, glitching) {
      var fade = motionAllowed(reduced) ? Math.min(1, Math.max(0, (now - introAt - 900) / 700)) : 1;
      if (fade <= 0) return;
      var moving = motionAllowed(reduced);
      var shift = moving ? Math.floor(t * 9) : 0;
      var lensC = pointer.active ? pointer.x / cw : -99;
      var lensR = pointer.active ? pointer.y / rh : -99;
      var tick = Math.floor(t * 18);
      ctx.globalAlpha = fade;
      ctx.fillStyle = colors.accent;
      ctx.font = "700 " + fontPx + "px " + MONO;
      ctx.textBaseline = "middle";
      for (var r = 0; r < rows; r++) {
        if (gearTwo && moving && (r + Math.floor(t * 14)) % 9 < 1) continue;
        var stream = streams[r];
        var len = stream.length;
        var start = (shift + r * 7) % len;
        var line = "";
        for (var c = 0; c < cols; c++) {
          var l = glyphLum[r * cols + c];
          if (l < 0) { line += " "; continue; }
          var level = moving ? l + 0.17 * flow(c * 0.55, r * 0.7, t) : l;
          var lx = (c - lensC) / 6.5, ly = (r - lensR) / 3.6;
          var inLens = lx * lx + ly * ly < 1;
          if (inLens && l > 0.2) {
            line += SCRAMBLE[(c * 7 + r * 13 + tick) % SCRAMBLE.length];
            continue;
          }
          if (level < 0.33) { line += " "; continue; }
          if (gearTwo && moving && (c * 31 + r * 17 + tick) % 23 === 0) {
            line += TEARS[(c + r + tick) % TEARS.length];
            continue;
          }
          line += stream[(c + start) % len];
        }
        var y = (r + 0.5) * rh;
        var dx = glitching ? bandShift(y) : 0;
        if (gearTwo && moving && (r * 13 + tick) % 31 === 0) dx += ((r * 7 + tick) % 5) - 2;
        ctx.fillText(line, dx, y);
      }
      ctx.globalAlpha = 1;
    }

    function drawTiles(now) {
      if (!motionAllowed(reduced) || now - introAt < 1800) return;
      var active = 0;
      for (var i = 0; i < tiles.length; i++) if (tiles[i].on) active++;
      var center = size / 2;
      for (var j = 0; j < tiles.length; j++) {
        var tile = tiles[j];
        if (!tile.on && now >= tile.showAt) {
          if (active < (gearTwo ? 9 : 6)) {
            tile.on = true;
            tile.onAt = now;
            tile.hideAt = now + 380 + Math.random() * 820;
            active++;
          } else {
            tile.showAt = now + 400 + Math.random() * 1600;
          }
        } else if (tile.on && now >= tile.hideAt) {
          tile.on = false;
          tile.showAt = now + (gearTwo ? 2500 : 5000) + Math.random() * (gearTwo ? 6000 : 12000);
          active--;
        }
        if (!tile.on) continue;
        var edge = now - tile.onAt < 90 || tile.hideAt - now < 70;
        if (edge && ((now / 35) | 0) % 2 === 0) continue;
        ctx.save();
        ctx.beginPath();
        ctx.arc(center, center, center - cell * 0.6, 0, Math.PI * 2);
        ctx.clip();
        ctx.beginPath();
        ctx.rect(tile.x, tile.y, tile.w, tile.h);
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        var scale = img.naturalWidth / size;
        ctx.drawImage(img, tile.x * scale, tile.y * scale, tile.w * scale, tile.h * scale, tile.x, tile.y, tile.w, tile.h);
        if (gearTwo) {
          ctx.globalCompositeOperation = "multiply";
          ctx.fillStyle = colors.accent;
          ctx.fillRect(tile.x, tile.y, tile.w, tile.h);
          ctx.globalCompositeOperation = "source-over";
        }
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = colors.accent;
        for (var line = 0; line < tile.h; line += 3) ctx.fillRect(tile.x, tile.y + line, tile.w, 1);
        ctx.globalAlpha = 1;
        ctx.restore();
        ctx.strokeStyle = colors.accent;
        ctx.lineWidth = 1;
        ctx.strokeRect(tile.x + 0.5, tile.y + 0.5, tile.w - 1, tile.h - 1);
        ctx.fillStyle = colors.accent;
        ctx.fillRect(tile.x - 2, tile.y - 2, 5, 5);
        ctx.fillRect(tile.x + tile.w - 3, tile.y + tile.h - 3, 5, 5);
      }
    }

    function step(now, t, beat) {
      var dtRaw = last ? now - last : 16.7;
      last = now;
      var k60 = Math.min(3, dtRaw / 16.7);
      var center = size / 2;
      var damping = Math.pow(gearTwo ? 0.8 : 0.83, k60);
      var stiffness = (gearTwo ? 0.095 : 0.075) * k60;
      var reach = Math.max(60, size * 0.11);
      var throb = 1 + 0.02 * beat;
      var elapsed = now - introAt;
      waves = waves.filter(function (wave) { return now - wave.at < 1100; });
      for (var k = 0; k < count; k++) {
        var tx = center + (hx[k] - center) * throb;
        var ty = center + (hy[k] - center) * throb;
        var ax = 0, ay = 0;
        if (elapsed > delay[k]) {
          ax = (tx - px[k]) * stiffness;
          ay = (ty - py[k]) * stiffness;
        } else {
          ax = Math.sin(now * 0.002 + phase[k]) * 0.05 * k60;
          ay = Math.cos(now * 0.0017 + phase[k]) * 0.05 * k60;
        }
        if (pointer.active) {
          var dx = px[k] - pointer.x, dy = py[k] - pointer.y;
          var d2 = dx * dx + dy * dy;
          if (d2 < reach * reach && d2 > 0.01) {
            var d = Math.sqrt(d2), f = 1 - d / reach;
            f = f * f * (gearTwo ? 5.2 : 3.4) * k60;
            ax += (dx / d) * f;
            ay += (dy / d) * f;
          }
        }
        for (var w = 0; w < waves.length; w++) {
          var wave = waves[w];
          var age = (now - wave.at) / 1000;
          var wx = px[k] - wave.x, wy = py[k] - wave.y;
          var wd = Math.sqrt(wx * wx + wy * wy) || 1;
          var gap = Math.abs(wd - age * 760);
          if (gap < 42) {
            var push = (1 - gap / 42) * wave.power * (1 - age / 1.1) * k60;
            ax += (wx / wd) * push;
            ay += (wy / wd) * push;
          }
        }
        vx[k] = (vx[k] + ax) * damping;
        vy[k] = (vy[k] + ay) * damping;
        px[k] += vx[k] * k60;
        py[k] += vy[k] * k60;
      }
      var blinks = Math.ceil(count * (gearTwo ? 0.006 : 0.0035) * k60);
      for (var b = 0; b < blinks; b++) {
        var pick = (Math.random() * count) | 0;
        blinkUntil[pick] = now + 60 + Math.random() * 240;
      }
      if (now >= glitch.next) {
        glitch.until = now + 140 + Math.random() * 200;
        glitch.next = now + (gearTwo ? 1400 : 2600) + Math.random() * (gearTwo ? 2600 : 4200);
        glitch.bands = [];
        var bands = 1 + ((Math.random() * 3) | 0);
        for (var i = 0; i < bands; i++) {
          var y0 = Math.random() * size;
          glitch.bands.push({ y0: y0, y1: y0 + 6 + Math.random() * 38, dx: (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 28) });
        }
      }
    }

    function render(now) {
      var moving = motionAllowed(reduced);
      var t = now / 1000;
      var beat = gearTwo && moving ? heartbeat(t) : 0;
      if (moving) step(now, t, beat);
      var glitching = moving && now < glitch.until;
      ctx.clearRect(-margin, -margin, span, span);
      var matrixAlpha = moving ? Math.min(1, Math.max(0, (now - introAt) / 900)) : 1;
      ctx.globalAlpha = matrixAlpha;
      ctx.drawImage(matrix, 0, 0, size, size);
      ctx.globalAlpha = matrixAlpha * (gearTwo ? 0.42 : 0.26) * (1 + 0.6 * beat);
      ctx.drawImage(glow, 0, 0, size, size);
      ctx.globalAlpha = 1;
      drawDots(now, t, beat, glitching);
      drawTiles(now);
      drawGlyphs(now, t, glitching);
    }

    function loop(now) {
      raf = 0;
      if (!ready || !visible || document.hidden || !motionAllowed(reduced)) return;
      render(now);
      raf = requestAnimationFrame(loop);
    }

    function settle() {
      for (var k = 0; k < count; k++) {
        px[k] = hx[k];
        py[k] = hy[k];
        vx[k] = vy[k] = 0;
      }
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (!ready) return;
      if (!motionAllowed(reduced)) {
        settle();
        render(introAt + 5000);
        return;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    }

    function burst(x, y, power) {
      waves.push({ x: x, y: y, at: performance.now(), power: power });
    }

    function explode() {
      var center = size / 2;
      for (var k = 0; k < count; k++) {
        var angle = Math.atan2(py[k] - center, px[k] - center) + (Math.random() - 0.5) * 0.9;
        var speed = 5 + Math.random() * 15;
        vx[k] += Math.cos(angle) * speed - Math.sin(angle) * speed * 0.35;
        vy[k] += Math.sin(angle) * speed + Math.cos(angle) * speed * 0.35;
      }
      burst(center, center, 9);
    }

    function local(event) {
      var rect = box.getBoundingClientRect();
      return { x: (event.clientX - rect.left) * (size / rect.width), y: (event.clientY - rect.top) * (size / rect.height) };
    }

    box.addEventListener("pointermove", function (event) {
      var at = local(event);
      pointer.x = at.x;
      pointer.y = at.y;
      pointer.active = true;
    });
    box.addEventListener("pointerleave", function () { pointer.active = false; });
    box.addEventListener("pointerdown", function (event) {
      if (!ready || !motionAllowed(reduced)) return;
      var at = local(event);
      burst(at.x, at.y, gearTwo ? 11 : 8);
    });

    new ResizeObserver(function () {
      if (ready && box.clientWidth && Math.abs(box.clientWidth - size) > 0.5) {
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
      var wasGear = gearTwo;
      colors = palette();
      gearTwo = colors.gear;
      if (ready) {
        paintMatrix();
        if (gearTwo !== wasGear && motionAllowed(reduced)) explode();
      }
      sync();
    });

    img.onload = function () {
      if (!build(true)) return;
      ready = true;
      introAt = performance.now();
      glitch.next = introAt + 3200;
      box.classList.add("is-ready");
      sync();
    };
    img.src = options.src;

    return {
      burst: function (x, y) { burst(x == null ? size / 2 : x, y == null ? size / 2 : y, gearTwo ? 11 : 8); },
      explode: explode
    };
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
    var scanAt = 0, startAt = 0, raf = 0, visible = false, ready = false, seen = false;
    var highlight = options.ink === "highlight";

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
      var moving = motionAllowed(reduced);
      var t = now / 1000;
      var elapsed = now - startAt;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = colors.ink;
      ctx.globalAlpha = colors.inkAlpha;
      ctx.beginPath();
      var scanY = moving ? ((now - scanAt) / 1400) * height : -999;
      if (moving && scanY > height + 40) {
        scanAt = now + 1800 + Math.random() * 2600;
      }
      var s = cell - 1;
      for (var y = 0; y < gh; y++) {
        var rowY = y * cell;
        var nearScan = Math.abs(rowY - scanY) < 10;
        for (var x = 0; x < gw; x++) {
          var i = y * gw + x;
          if (moving && elapsed < reveal[i]) continue;
          var level = highlight || !colors.positive ? lum[i] : 1 - lum[i];
          var gate = bayer(x, y);
          if (moving) gate += 0.16 * Math.sin(t * freq[i] + phase[i]);
          if (pointer.active) {
            var dx = x * cell - pointer.x, dy = rowY - pointer.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < 4900) gate -= 0.55 * (1 - Math.sqrt(d2) / 70) * (0.6 + 0.4 * Math.sin(t * 14 + phase[i]));
          }
          var on = level > gate;
          if (nearScan) on = !on;
          if (on) ctx.rect(x * cell, rowY, s, s);
        }
      }
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function loop(now) {
      raf = 0;
      if (!ready || !visible || document.hidden || !motionAllowed(reduced)) return;
      render(now);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      if (!ready) return;
      if (!motionAllowed(reduced)) {
        render(startAt + 1e6);
        return;
      }
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
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
      if (visible && !seen && ready) {
        seen = true;
        startAt = performance.now();
        scanAt = startAt + 1600;
      }
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
      if (visible && !seen) {
        seen = true;
        startAt = performance.now();
        scanAt = startAt + 1600;
      }
      box.classList.add("is-ready");
      sync();
    };
    img.src = options.src;
  }

  var api = { mountHero: mountHero, mountDither: mountDither, bayer: bayer, rowStream: rowStream, heartbeat: heartbeat, flow: flow };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Dotfield = api;
})(typeof window !== "undefined" ? window : globalThis);
