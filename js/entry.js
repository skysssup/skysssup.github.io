/* A procedural caduceus, drawn once per frame with no images, library, or WebGL context. */
(function () {
  "use strict";
  var root = document.documentElement;
  var dialog = document.querySelector("[data-entry-screen]");
  if (!dialog || !dialog.showModal) { root.removeAttribute("data-entry"); return; }
  window.skyEntryReady = true;
  var canvas = dialog.querySelector("canvas"), ctx = canvas.getContext("2d");
  var motion = window.SkyMotion;
  var raf = 0, last = 0, time = 0, width = 0, height = 0, ink = "", accent = "";
  var opened = false, leaving = false, exitTimer = 0, pointer = { x: 0, y: 0 }, aim = { x: 0, y: 0 };
  var paths = [];
  function curve(points, bright) { paths.push({ points: points, bright: bright }); }
  // A staff, two winding paths, and articulated wing ribs. Each point lives in a small 3D coordinate space.
  curve([[0,-1.12,0],[0,1.12,0]], true);
  for (var side = -1; side <= 1; side += 2) {
    var helix = [];
    for (var j = 0; j <= 96; j++) {
      var t = j / 96, phase = t * Math.PI * 5 + (side < 0 ? Math.PI : 0);
      var radius = .2 * Math.sin(t * Math.PI);
      helix.push([Math.sin(phase) * radius, .94 - t * 1.62, Math.cos(phase) * radius]);
    }
    curve(helix, true);
    for (var feather = 0; feather < 22; feather++) {
      var q = feather / 21, rib = [];
      for (var k = 0; k <= 14; k++) {
        var u = k / 14;
        rib.push([side * (.05 + u * (.36 + q * .68)), -.63 - Math.sin(u * Math.PI * .7) * (.3 + q * .38) + q * .44, Math.sin(u * Math.PI) * (.14 + q * .08)]);
      }
      curve(rib, feather % 5 === 0);
    }
  }
  var halo = [];
  for (var h = 0; h <= 80; h++) { var a = h / 80 * Math.PI * 2; halo.push([Math.cos(a) * 1.23, Math.sin(a) * 1.23, 0]); }
  curve(halo, false);
  function reduced() { return motion ? motion.reduced() : matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function size() {
    if (!opened || !ctx) return;
    var rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
    width = rect.width; height = rect.height;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var style = getComputedStyle(root);
    ink = style.getPropertyValue("--ink").trim(); accent = style.getPropertyValue("--accent").trim();
    draw();
  }
  function draw() {
    if (!ctx || !width || !height) return;
    ctx.clearRect(0, 0, width, height);
    var turn = reduced() ? -.2 : Math.sin(time * .3) * .3 + pointer.x * .3;
    var pitch = reduced() ? .04 : pointer.y * .12;
    var cy = Math.cos(turn), sy = Math.sin(turn), cx = Math.cos(pitch), sx = Math.sin(pitch);
    var scale = Math.min(width, height) * .34;
    function project(p) {
      var x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy;
      var y = p[1] * cx - z * sx;
      var perspective = 4 / (4 + p[1] * sx + z * cx);
      return [width / 2 + x * scale * perspective, height / 2 + y * scale * perspective];
    }
    paths.forEach(function (path, index) {
      ctx.beginPath();
      path.points.forEach(function (p, i) { var xy = project(p); if (i) ctx.lineTo(xy[0], xy[1]); else ctx.moveTo(xy[0], xy[1]); });
      ctx.strokeStyle = path.bright ? ink : accent;
      ctx.globalAlpha = index === paths.length - 1 ? .15 : path.bright ? .7 : .25;
      ctx.lineWidth = path.bright ? .8 : .6; ctx.stroke();
      if (index < paths.length - 1 && index % 3 === 0) {
        var at = reduced() ? .5 : (time * .08 + index * .071) % 1;
        var point = project(path.points[Math.floor(at * (path.points.length - 1))]);
        ctx.globalAlpha = .9; ctx.fillStyle = ink; ctx.fillRect(point[0] - 1, point[1] - 1, 2, 2);
      }
    });
    ctx.globalAlpha = .2; ctx.strokeStyle = ink; ctx.lineWidth = .5;
    [[width / 2, height / 2 - scale * 1.4],[width / 2, height / 2 + scale * 1.4]].forEach(function (p) {
      ctx.beginPath(); ctx.moveTo(p[0]-5,p[1]); ctx.lineTo(p[0]+5,p[1]); ctx.moveTo(p[0],p[1]-5); ctx.lineTo(p[0],p[1]+5); ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    if (!opened || leaving || document.hidden || reduced()) return;
    if (now - last >= 1000 / 30 - 1) {
      var dt = Math.min((now - last) / 1000, .06); last = now; time += dt;
      pointer.x += (aim.x - pointer.x) * .12; pointer.y += (aim.y - pointer.y) * .12;
      draw();
    }
    raf = requestAnimationFrame(frame);
  }
  function sync() {
    cancelAnimationFrame(raf); raf = 0;
    if (!opened || leaving || document.hidden) return;
    draw();
    if (!reduced()) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function finish() {
    clearTimeout(exitTimer);
    opened = false; leaving = false;
    cancelAnimationFrame(raf); raf = 0;
    dialog.close(); root.removeAttribute("data-entry");
    if (motion) motion.setScrollLocked(false);
    var main = document.getElementById("main");
    main.tabIndex = -1;
    main.focus({ preventScroll: true });
  }
  function enter() {
    if (!opened || leaving) return;
    leaving = true;
    try { sessionStorage.setItem("sky-entry", "seen"); } catch (e) {}
    cancelAnimationFrame(raf); raf = 0;
    root.setAttribute("data-entry", "entering");
    window.dispatchEvent(new Event("sky:enter"));
    if (reduced()) finish(); else exitTimer = setTimeout(finish, 650);
  }
  function open() {
    if (opened) return;
    opened = true; root.setAttribute("data-entry", "waiting");
    dialog.showModal();
    window.dispatchEvent(new Event("sky:entry-open"));
    if (motion) motion.setScrollLocked(true);
    size(); sync();
  }
  dialog.querySelector("[data-enter]").addEventListener("click", enter);
  dialog.addEventListener("cancel", function (event) { event.preventDefault(); enter(); });
  dialog.addEventListener("keydown", function (event) { if (event.key === "Enter") { event.preventDefault(); enter(); } });
  dialog.addEventListener("pointermove", function (event) {
    if (event.pointerType === "touch" || reduced()) return;
    aim.x = event.clientX / innerWidth * 2 - 1; aim.y = event.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  dialog.addEventListener("pointerleave", function () { aim.x = aim.y = 0; });
  document.querySelector("[data-entry-replay]").addEventListener("click", open);
  document.addEventListener("visibilitychange", function () { if (document.hidden && leaving) finish(); else sync(); });
  window.addEventListener("resize", size, { passive: true });
  if (motion) motion.subscribe(function () { size(); if (leaving && reduced()) finish(); else sync(); });
  if (root.getAttribute("data-entry") === "waiting") open();
})();
