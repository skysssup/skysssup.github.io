(function (global) {
  "use strict";

  var MARK = "M20.85 0 L41.7 50 H30.2 L20.85 24.5 L11.5 50 H0 Z";
  var MARK_W = 41.7, MARK_H = 50;
  var NAMES = ["AIRFORGE", "AGENTCRUCIBLE", "SHIPGATE", "RECALL-AI", "GHOST-NOTETAKER", "SPANFORGE", "LOCALPULSE", "MOLTDAO"];
  var SCRAMBLE = "#%&@$*+=<>{}[]01/\\";
  var MONO = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

  function stream(row) {
    var names = NAMES.slice();
    var seed = (Math.imul(row + 3, 2654435761) >>> 0) || 1;
    for (var i = names.length - 1; i > 0; i--) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0;
      var j = seed % (i + 1);
      var held = names[i]; names[i] = names[j]; names[j] = held;
    }
    return names.join("/") + "/";
  }

  function dissolveAt(ms) {
    var p = (ms % 9000) / 9000;
    if (p < 0.7) return 0;
    var k = (p - 0.7) / 0.3;
    return Math.sin(k * Math.PI);
  }

  function mountMark(box, options) {
    var reduced = options.reduced;
    var root = document.documentElement;
    var canvas = document.createElement("canvas");
    canvas.className = "figure-canvas";
    canvas.setAttribute("aria-hidden", "true");
    box.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var w = 0, h = 0, margin = 0, dpr = 1, cols = 0, rows = 0, cw = 0, rh = 0, fontPx = 0;
    var count = 0, hx, hy, px, py, vx, vy, col, row, spread, phase;
    var streams = [];
    var colors = {};
    var gearTwo = false;
    var pointer = { x: 0, y: 0, active: false };
    var waves = [];
    var tiles = [];
    var startAt = 0, last = 0, raf = 0, visible = true, ready = false;

    function motion() { return !reduced.matches; }

    function readColors() {
      var styles = getComputedStyle(root);
      colors = {
        ink: styles.getPropertyValue("--ink").trim(),
        paper: styles.getPropertyValue("--paper").trim(),
        accent: styles.getPropertyValue("--accent").trim(),
        off: styles.getPropertyValue("--figure-off").trim()
      };
      gearTwo = root.getAttribute("data-gear") === "two";
    }

    function build() {
      w = box.clientWidth;
      h = box.clientHeight;
      if (!w || !h) return false;
      margin = Math.round(w * 0.35);
      dpr = Math.min(2, global.devicePixelRatio || 1);
      canvas.width = Math.round((w + margin * 2) * dpr);
      canvas.height = Math.round((h + margin * 2) * dpr);
      canvas.style.left = canvas.style.top = -margin + "px";
      canvas.style.width = (w + margin * 2) + "px";
      canvas.style.height = (h + margin * 2) + "px";
      ctx.setTransform(dpr, 0, 0, dpr, dpr * margin, dpr * margin);
      cols = w < 320 ? 28 : w < 440 ? 34 : 44;
      cw = w / cols;
      ctx.font = "700 100px " + MONO;
      fontPx = (cw * 100) / ctx.measureText("M").width;
      rows = Math.round(h / (fontPx * 1.02));
      rh = h / rows;
      var mask = document.createElement("canvas");
      mask.width = cols;
      mask.height = rows;
      var mctx = mask.getContext("2d", { willReadFrequently: true });
      mctx.scale(cols / MARK_W, rows / MARK_H);
      mctx.fill(new Path2D(MARK));
      var alpha = mctx.getImageData(0, 0, cols, rows).data;
      var cells = [];
      for (var i = 0; i < cols * rows; i++) if (alpha[i * 4 + 3] > 110) cells.push(i);
      count = cells.length;
      hx = new Float32Array(count); hy = new Float32Array(count);
      px = new Float32Array(count); py = new Float32Array(count);
      vx = new Float32Array(count); vy = new Float32Array(count);
      col = new Int16Array(count); row = new Int16Array(count);
      spread = new Float32Array(count); phase = new Float32Array(count);
      for (var k = 0; k < count; k++) {
        col[k] = cells[k] % cols;
        row[k] = (cells[k] / cols) | 0;
        hx[k] = (col[k] + 0.5) * cw;
        hy[k] = (row[k] + 0.5) * rh;
        spread[k] = 0.4 + Math.random() * 1.1;
        phase[k] = Math.random() * Math.PI * 2;
        var a = Math.random() * Math.PI * 2, r = (w + h) * (0.4 + Math.random() * 0.5);
        px[k] = w / 2 + Math.cos(a) * r;
        py[k] = h / 2 + Math.sin(a) * r;
        vx[k] = vy[k] = 0;
      }
      streams = [];
      for (var s = 0; s < rows; s++) streams.push(stream(s));
      return true;
    }

    function step(now) {
      var k60 = Math.min(3, (last ? now - last : 16.7) / 16.7);
      last = now;
      var t = now - startAt;
      var d = t > 2200 ? dissolveAt(t - 2200) : 0;
      var cx = w / 2, cy = h * 0.55;
      var stiff = (gearTwo ? 0.1 : 0.07) * k60 * (1 - 0.85 * d);
      var damp = Math.pow(gearTwo ? 0.8 : 0.84, k60);
      var reach = Math.max(50, w * 0.16);
      var beat = gearTwo ? Math.max(0, Math.sin(now / 1000 * Math.PI * 2 / 0.92)) : 0;
      waves = waves.filter(function (wave) { return now - wave.at < 1000; });
      for (var k = 0; k < count; k++) {
        var ox = hx[k] - cx, oy = hy[k] - cy;
        var len = Math.sqrt(ox * ox + oy * oy) || 1;
        var push = d * spread[k] * (gearTwo ? 150 : 95);
        var tx = hx[k] + (ox / len) * push + Math.sin(phase[k] + t * 0.002) * 12 * d;
        var ty = hy[k] + (oy / len) * push - d * 40 * spread[k];
        tx = cx + (tx - cx) * (1 + 0.015 * beat);
        ty = cy + (ty - cy) * (1 + 0.015 * beat);
        var ax = (tx - px[k]) * stiff, ay = (ty - py[k]) * stiff;
        if (pointer.active) {
          var dx = px[k] - pointer.x, dy = py[k] - pointer.y, d2 = dx * dx + dy * dy;
          if (d2 < reach * reach && d2 > 0.01) {
            var dist = Math.sqrt(d2), f = 1 - dist / reach;
            f = f * f * (gearTwo ? 4.5 : 3) * k60;
            ax += (dx / dist) * f;
            ay += (dy / dist) * f;
          }
        }
        for (var i = 0; i < waves.length; i++) {
          var wave = waves[i], age = (now - wave.at) / 1000;
          var wx = px[k] - wave.x, wy = py[k] - wave.y, wd = Math.sqrt(wx * wx + wy * wy) || 1;
          var gap = Math.abs(wd - age * 700);
          if (gap < 40) {
            var p = (1 - gap / 40) * wave.power * (1 - age) * k60;
            ax += (wx / wd) * p;
            ay += (wy / wd) * p;
          }
        }
        vx[k] = (vx[k] + ax) * damp;
        vy[k] = (vy[k] + ay) * damp;
        px[k] += vx[k] * k60;
        py[k] += vy[k] * k60;
      }
      if (Math.random() < (gearTwo ? 0.09 : 0.04) * k60 && tiles.length < 6 && count) {
        var pick = (Math.random() * count) | 0;
        tiles.push({ c: col[pick], r: row[pick], w: 3 + ((Math.random() * 5) | 0), h: 1 + ((Math.random() * 2) | 0), until: now + 180 + Math.random() * 520 });
      }
      tiles = tiles.filter(function (tile) { return tile.until > now; });
      return d;
    }

    function render(now) {
      var moving = motion();
      var d = moving && ready ? step(now) : 0;
      var t = now / 1000;
      ctx.clearRect(-margin, -margin, w + margin * 2, h + margin * 2);
      ctx.fillStyle = colors.off;
      var s = Math.max(1.5, cw * 0.22);
      ctx.beginPath();
      for (var m = 0; m < count; m++) ctx.rect(hx[m] - s / 2, hy[m] - s / 2, s, s);
      ctx.fill();
      var intro = moving ? Math.min(1, (now - startAt) / 900) : 1;
      ctx.font = "700 " + fontPx + "px " + MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      var shift = moving ? Math.floor(t * (gearTwo ? 14 : 8)) : 0;
      var tick = Math.floor(t * 18);
      var lensR = Math.max(40, w * 0.12);
      for (var k = 0; k < count; k++) {
        var line = streams[row[k]];
        var ch = line[(col[k] + shift + row[k] * 5) % line.length];
        var x = moving ? px[k] : hx[k], y = moving ? py[k] : hy[k];
        if (pointer.active) {
          var dx = x - pointer.x, dy = y - pointer.y;
          if (dx * dx + dy * dy < lensR * lensR) ch = SCRAMBLE[(col[k] * 7 + row[k] * 13 + tick) % SCRAMBLE.length];
        }
        if (gearTwo && moving && (row[k] + Math.floor(t * 12)) % 11 === 0) x += ((row[k] * 7 + tick) % 7) - 3;
        var shimmer = moving ? 0.55 + 0.45 * Math.sin(hy[k] * 0.045 - t * 2.4 + col[k] * 0.12) : 1;
        ctx.globalAlpha = intro * Math.max(0.12, (1 - 0.85 * d) * (0.35 + 0.65 * shimmer));
        ctx.fillStyle = colors.accent;
        ctx.fillText(ch, x, y);
      }
      ctx.globalAlpha = 1;
      for (var i = 0; i < tiles.length; i++) {
        var tile = tiles[i];
        var tx = tile.c * cw, ty = tile.r * rh;
        ctx.fillStyle = colors.accent;
        ctx.fillRect(tx, ty, tile.w * cw, tile.h * rh);
        ctx.fillStyle = colors.paper;
        for (var c = 0; c < tile.w; c++) {
          for (var r = 0; r < tile.h; r++) {
            var g = SCRAMBLE[(tile.c + c + (tile.r + r) * 3 + tick) % SCRAMBLE.length];
            ctx.fillText(g, tx + (c + 0.5) * cw, ty + (r + 0.5) * rh);
          }
        }
      }
    }

    function loop(now) {
      raf = 0;
      if (!ready || !visible || document.hidden || !motion()) return;
      render(now);
      raf = requestAnimationFrame(loop);
    }

    function sync() {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (!ready) return;
      if (!motion()) {
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
      if (!ready || !motion()) return;
      var at = local(event);
      waves.push({ x: at.x, y: at.y, at: performance.now(), power: gearTwo ? 12 : 8 });
    });
    new ResizeObserver(function () {
      if (ready && Math.abs(box.clientWidth - w) > 0.5) {
        build();
        sync();
      }
    }).observe(box);
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      sync();
    }).observe(box);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    new MutationObserver(function () {
      var was = gearTwo;
      readColors();
      if (ready && gearTwo !== was && motion()) {
        for (var k = 0; k < count; k++) {
          var a = Math.random() * Math.PI * 2, sp = 6 + Math.random() * 14;
          vx[k] += Math.cos(a) * sp;
          vy[k] += Math.sin(a) * sp;
        }
      }
      sync();
    }).observe(root, { attributes: true, attributeFilter: ["data-theme", "data-gear"] });

    readColors();
    if (build()) {
      ready = true;
      startAt = performance.now();
      box.classList.add("is-ready");
      sync();
    }
  }

  var api = { mountMark: mountMark, stream: stream, dissolveAt: dissolveAt, names: NAMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SkyMark = api;
})(typeof window !== "undefined" ? window : globalThis);
