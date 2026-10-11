/* A brief, non-blocking particle dive. The page remains usable and any input skips it. */
(function () {
  "use strict";
  var motion = window.SkyMotion;
  var canvas, raf = 0, timeout = 0, finished = false;
  var listeners = ["pointerdown", "keydown", "wheel", "touchstart"];
  var waiting = [];
  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(timeout);
    if (canvas) canvas.remove();
    listeners.forEach(function (name) { document.removeEventListener(name, finish, true); });
    document.removeEventListener("visibilitychange", hide);
    window.removeEventListener("resize", finish);
    window.SkyBlackHole.active = false;
    waiting.splice(0).forEach(function (fn) { fn(); });
  }
  function hide() { if (document.hidden) finish(); }
  window.SkyBlackHole = {
    active: false,
    after: function (fn) { if (finished) fn(); else waiting.push(fn); }
  };
  if (location.hash || document.hidden || (motion && motion.reduced())) { finish(); return; }
  canvas = document.createElement("canvas");
  canvas.className = "blackhole-transition";
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:1000;pointer-events:none";
  canvas.setAttribute("aria-hidden", "true");
  var ctx;
  try { ctx = canvas.getContext("2d", { alpha: false }); } catch (e) { finish(); return; }
  if (!ctx) { finish(); return; }
  var w = innerWidth, h = innerHeight, cx = w * .5, cy = h * .5;
  var ratio = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
  ctx.scale(ratio, ratio);
  var reach = Math.hypot(w, h), base = Math.min(w, h) * .21;
  var total = w < 700 ? 1100 : 2300;
  var particles = new Float32Array(total * 4);
  for (var i = 0; i < total; i++) {
    particles[i * 4] = Math.random() * Math.PI * 2;
    particles[i * 4 + 1] = base + Math.pow(Math.random(), 1.7) * reach;
    particles[i * 4 + 2] = .65 + Math.random() * .7;
    particles[i * 4 + 3] = (Math.random() - .5) * .3;
  }
  var begun = performance.now(), last = begun;
  function ease(n) { n = Math.max(0, Math.min(1, n)); return n * n * (3 - 2 * n); }
  function draw(now) {
    if (finished) return;
    var progress = Math.min(1, (now - begun) / 1650);
    if (progress >= 1) { finish(); return; }
    var dt = Math.min(.04, (now - last) / 1000); last = now;
    var radius = 16 + base * ease(progress / .32) + reach * Math.pow(ease((progress - .68) / .32), 3);
    var strength = 1 + progress * 3 + Math.pow(progress, 5) * 9;
    ctx.fillStyle = "#050505"; ctx.fillRect(0, 0, w, h);
    var glow = ctx.createRadialGradient(cx, cy, radius, cx, cy, radius + base * .65);
    glow.addColorStop(0, "rgba(224,220,202,.22)"); glow.addColorStop(1, "rgba(224,220,202,0)");
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    var paths = Array.from({ length: 6 }, function () { return new Path2D(); });
    for (var p = 0; p < total; p++) {
      var n = p * 4, r = particles[n + 1];
      if (r < radius + 2) { r = radius + 8 + Math.random() * reach; particles[n] = Math.random() * Math.PI * 2; }
      var distance = r - radius;
      var speed = (100 + 4200 / (distance + 30)) * strength * particles[n + 2];
      particles[n + 1] = r - speed * dt;
      particles[n] += particles[n + 3] * dt * strength;
      var angle = particles[n], x = Math.cos(angle), y = Math.sin(angle);
      var tail = Math.min(90, 2 + speed * .045);
      var band = Math.min(5, Math.floor(6 * Math.exp(-distance / (base + 80))));
      paths[band].moveTo(cx + x * (r + tail), cy + y * (r + tail));
      paths[band].lineTo(cx + x * r, cy + y * r);
    }
    ctx.lineWidth = .85;
    for (var b = 0; b < paths.length; b++) { ctx.strokeStyle = "rgba(224,220,202," + (.16 + b * .15) + ")"; ctx.stroke(paths[b]); }
    [[12,.04],[5,.12],[1.5,.75]].forEach(function (ring) {
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.lineWidth = ring[0]; ctx.strokeStyle = "rgba(224,220,202," + ring[1] + ")"; ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(cx, cy, radius - .5, 0, Math.PI * 2); ctx.fillStyle = "#050505"; ctx.fill();
    canvas.style.opacity = String(1 - ease((progress - .83) / .17));
    raf = requestAnimationFrame(draw);
  }
  window.SkyBlackHole.active = true;
  document.body.appendChild(canvas);
  listeners.forEach(function (name) { document.addEventListener(name, finish, { capture: true, passive: true }); });
  document.addEventListener("visibilitychange", hide);
  window.addEventListener("resize", finish, { passive: true });
  if (motion) motion.subscribe(function () { if (motion.reduced()) finish(); });
  // A throttled or unavailable animation frame cannot strand an overlay over the page.
  timeout = setTimeout(finish, 1900);
  draw(begun);
})();
