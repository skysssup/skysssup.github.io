/* Home-root entrance: a short elliptical accretion disk and photon ring.
   The page stays interactive. Hero mount is never deferred. Any input skips. */
(function () {
  "use strict";
  var motion = window.SkyMotion;
  var DURATION = 1850;
  var SAFETY = 2100;
  var canvas, raf = 0, timeout = 0, finished = false;
  var listeners = ["pointerdown", "keydown", "wheel", "touchstart"];

  function finish() {
    if (finished) return;
    finished = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(timeout);
    timeout = 0;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    listeners.forEach(function (name) { document.removeEventListener(name, finish, true); });
    document.removeEventListener("visibilitychange", onHide);
    window.removeEventListener("resize", onResize);
    window.SkyBlackHole.active = false;
  }

  function onHide() { if (document.hidden) finish(); }
  function onResize() {
    if (Math.abs(window.innerWidth - w) < 2 && Math.abs(window.innerHeight - h) < 2) return;
    finish();
  }

  window.SkyBlackHole = {
    active: false,
    /* Ready immediately. Callers must not wait for the entrance to end. */
    after: function (fn) {
      if (typeof fn === "function") fn();
    }
  };

  function homeRoot() {
    var path = location.pathname || "/";
    return path === "/" || path === "/index.html";
  }

  if (!homeRoot() || location.hash || document.hidden || (motion && motion.reduced())) {
    finish();
    return;
  }

  var reduceQuery = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceQuery && reduceQuery.matches) { finish(); return; }

  canvas = document.createElement("canvas");
  canvas.className = "blackhole-transition";
  canvas.setAttribute("aria-hidden", "true");
  var ctx;
  try { ctx = canvas.getContext("2d", { alpha: false }); } catch (e) { finish(); return; }
  if (!ctx) { finish(); return; }

  var w = 0, h = 0, ratio = 1, cx = 0, cy = 0;
  function size() {
    w = window.innerWidth;
    h = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.max(1, Math.round(w * ratio));
    canvas.height = Math.max(1, Math.round(h * ratio));
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    cx = w * 0.5;
    cy = h * 0.46;
  }

  var css = getComputedStyle(document.documentElement);
  function read(name, fallback) {
    var v = (css.getPropertyValue(name) || "").trim();
    return v || fallback;
  }
  var paper = read("--paper", "#0b0b0c");
  var ink = read("--ink", "#ecebe8");
  var sheen = read("--figure-sheen", "#cf9a2e");
  var dark = (document.documentElement.getAttribute("data-theme") || "") !== "light";

  size();
  var count = w < 700 ? 320 : 560;
  var parts = new Float32Array(count * 4);
  for (var i = 0; i < count; i++) {
    var lane = i % 11 === 0 ? 1 : 0;
    parts[i * 4] = (i / count) * Math.PI * 2 + (i % 5) * 0.017;
    parts[i * 4 + 1] = lane ? 0.34 + (i % 7) * 0.012 : 0.22 + (i % 17) / 17 * 0.78;
    parts[i * 4 + 2] = 1;
    parts[i * 4 + 3] = lane;
  }

  function ease(n) {
    n = n < 0 ? 0 : n > 1 ? 1 : n;
    return n * n * (3 - 2 * n);
  }

  var begun = 0;
  var last = 0;

  function frame(now) {
    if (finished) return;
    try {
      if (!begun) {
        begun = last = now;
        clearTimeout(timeout);
        timeout = setTimeout(finish, SAFETY);
      }
      var t = (now - begun) / DURATION;
      if (t >= 1) { finish(); return; }
      var dt = Math.min(0.034, (now - last) / 1000);
      last = now;
      var open = ease(Math.min(1, t / 0.2));
      var flow = ease(Math.min(1, Math.max(0, (t - 0.06) / 0.7)));
      var reveal = ease(Math.min(1, Math.max(0, (t - 0.8) / 0.2)));
      var scale = 0.62 + 0.38 * open;
      var reach = Math.min(w, h);
      var rx = reach * 0.42 * scale;
      var ry = rx * 0.34;
      var hole = reach * 0.075 * (0.72 + 0.28 * open);

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = paper;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);
      var veil = ctx.createRadialGradient(0, 0, hole, 0, 0, rx * 1.15);
      veil.addColorStop(0, dark ? "rgba(0,0,0,0.92)" : "rgba(8,8,10,0.88)");
      veil.addColorStop(0.42, dark ? "rgba(0,0,0,0.45)" : "rgba(12,12,14,0.28)");
      veil.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = veil;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 1.15, ry * 1.15, -0.18, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = "round";
      for (var p = 0; p < count; p++) {
        var o = p * 4;
        var ang = parts[o];
        var rad = parts[o + 1];
        var dir = parts[o + 2];
        var lane = parts[o + 3];
        var spin = (0.55 + 2.4 / (rad * rad + 0.06)) * dt * (0.45 + flow) * dir;
        ang += spin;
        if (lane === 0) rad -= dt * (0.05 + 0.42 * flow) * (0.35 + (1 - rad));
        else rad = 0.36 + Math.sin(ang * 2) * 0.015;
        if (rad < 0.16) rad = 0.9 + (p % 8) * 0.01;
        parts[o] = ang;
        parts[o + 1] = rad;
        var c = Math.cos(ang);
        var s = Math.sin(ang);
        var px = c * rx * rad;
        var py = s * ry * rad;
        var tx = -s * dir;
        var ty = c * dir;
        var tail = (6 + (1 - rad) * 22) * (0.4 + flow);
        var hot = 0.15 + 0.85 * (0.5 + 0.5 * c);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px - tx * tail * 0.5, py - ty * tail * 0.17, Math.cos(ang - tail / Math.max(1, rx * rad)) * rx * rad, Math.sin(ang - tail / Math.max(1, rx * rad)) * ry * rad);
        ctx.lineWidth = lane ? 1.35 : 0.7 + hot * 0.6;
        ctx.strokeStyle = lane ? sheen : ink;
        ctx.globalAlpha = (lane ? 0.35 + hot * 0.55 : 0.12 + hot * 0.45) * (1 - reveal);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Rear light bends around a circular shadow; the surrounding disk stays tilted.
      ctx.beginPath();
      ctx.arc(0, 0, hole * 1.2, Math.PI, Math.PI * 2);
      ctx.lineWidth = 5;
      ctx.strokeStyle = sheen;
      ctx.globalAlpha = 0.22 * open * (1 - reveal * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, hole * 1.08, 0, Math.PI * 2);
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.85 * open;
      ctx.strokeStyle = dark ? "#f4efe4" : "#fffaf2";
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, hole, 0, Math.PI * 2);
      ctx.fillStyle = "#050506";
      ctx.fill();
      ctx.restore();

      canvas.style.opacity = String(1 - reveal);
      raf = requestAnimationFrame(frame);
    } catch (err) {
      finish();
    }
  }

  window.SkyBlackHole.active = true;
  document.body.appendChild(canvas);
  listeners.forEach(function (name) {
    document.addEventListener(name, finish, { capture: true, passive: true });
  });
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("resize", onResize, { passive: true });
  if (motion && motion.subscribe) {
    motion.subscribe(function () { if (motion.reduced()) finish(); });
  }
  timeout = setTimeout(finish, SAFETY + DURATION);
  raf = requestAnimationFrame(frame);
})();
