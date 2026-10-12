/* Scroll-driven ink ribbons. No idle animation loop, no pointer replacement. */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-scroll-field]');
  if (!canvas) return;
  var ctx;
  try { ctx = canvas.getContext('2d'); } catch (e) { canvas.remove(); return; }
  if (!ctx) { canvas.remove(); return; }
  var motion = window.SkyMotion || { reduced: function () { return false; }, subscribe: function () {} };
  var coarse = matchMedia('(pointer: coarse)'), w = 0, h = 0, dpr = 1;
  var actual = scrollY, position = actual, lastActual = actual, wind = 0, desiredWind = 0;
  var pointer = { x: .5, y: .5, tx: .5, ty: .5 }, raf = 0, last = 0, ink, hot, draws = 0;
  var rail = document.querySelector('.scroll-waypoints'), links = Array.from(rail.querySelectorAll('a'));
  var sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); });
  var tops = [], maxScroll = 1;
  var stars = Array.from({ length: 135 }, function (_, i) {
    function hash(n) { return (Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1; }
    return { x: Math.abs(hash(i + 3)), y: Math.abs(hash(i + 157)), z: .2 + Math.abs(hash(i + 303)) * .8 };
  });
  function queue() {
    if (!raf && !document.hidden && !motion.reduced()) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function colors() {
    var style = getComputedStyle(document.documentElement);
    ink = style.getPropertyValue('--ink').trim();
    hot = style.getPropertyValue('--figure-key').trim();
  }
  function navigation() {
    var at = 0;
    tops.forEach(function (top, i) { if (actual + h * .42 >= top) at = i; });
    links.forEach(function (link, i) {
      link.classList.toggle('is-current', i === at);
      if (i === at) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    });
    rail.style.setProperty('--read', String(Math.max(0, Math.min(1, actual / maxScroll))));
  }
  function paint() {
    draws++;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    var phase = position * .0017, momentum = Math.max(-1, Math.min(1, wind / 40));
    var heroPart = Math.max(0, 1 - position / Math.max(h, 1));
    var lines = coarse.matches ? 16 : 26, steps = coarse.matches ? 38 : 58;
    var lanes = [.10, .90], radius = Math.min(w * .105, 150);
    ctx.lineWidth = .55;
    for (var lane = 0; lane < lanes.length; lane++) {
      var axis = w * lanes[lane], mirror = lane ? -1 : 1;
      for (var strand = 0; strand < lines; strand++) {
        var spread = (strand / (lines - 1) - .5), r = radius * (1 + spread * .55);
        ctx.strokeStyle = strand % 7 ? ink : hot;
        ctx.globalAlpha = .025 + (1 - Math.abs(spread) * 1.5) * (.07 + heroPart * .035);
        ctx.beginPath();
        for (var step = 0; step <= steps; step++) {
          var u = step / steps, angle = u * Math.PI * 2.4 + phase * mirror + spread * .7;
          var depth = Math.sin(angle) * r, perspective = 800 / (800 + depth);
          var bend = Math.sin(u * Math.PI) * momentum * 32;
          var px = axis + (Math.cos(angle) * r + bend + (pointer.x - .5) * 16) * perspective * mirror;
          var py = (u * h * 1.5 - h * .25 - h / 2) * perspective + h / 2 + spread * 16 + (pointer.y - .5) * 8;
          if (!step) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.fillStyle = hot;
    stars.forEach(function (star, i) {
      var sx = star.x * w + (pointer.x - .5) * 12 * star.z;
      var sy = ((star.y * h - position * star.z * .06) % h + h) % h;
      var edge = Math.abs(sx / w - .5) * 2;
      ctx.globalAlpha = (.04 + star.z * .1) * (.3 + edge * .7);
      var size = i % 11 === 0 ? 1.2 : .65;
      ctx.fillRect(sx, sy, size, size);
    });
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    if (document.hidden || motion.reduced()) return;
    var dt = Math.min(.04, Math.max(.001, (now - last) / 1000)); last = now;
    var follow = 1 - Math.exp(-dt * 12), calm = Math.exp(-dt * 6);
    position += (actual - position) * follow;
    wind += (desiredWind - wind) * follow; desiredWind *= calm;
    pointer.x += (pointer.tx - pointer.x) * follow;
    pointer.y += (pointer.ty - pointer.y) * follow;
    paint();
    if (Math.abs(actual - position) > .1 || Math.abs(wind) > .03 || Math.abs(desiredWind) > .03 || Math.abs(pointer.tx - pointer.x) + Math.abs(pointer.ty - pointer.y) > .001) raf = requestAnimationFrame(frame);
  }
  function layout() {
    w = innerWidth; h = innerHeight; dpr = Math.min(devicePixelRatio || 1, coarse.matches ? 1.25 : 1.5);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    actual = position = scrollY; maxScroll = Math.max(1, document.documentElement.scrollHeight - h);
    tops = sections.map(function (section) { return section ? section.getBoundingClientRect().top + actual : 0; });
    navigation(); colors();
    canvas.hidden = motion.reduced();
    if (!motion.reduced()) paint();
  }
  window.addEventListener('scroll', function () {
    actual = scrollY; desiredWind = Math.max(-90, Math.min(90, desiredWind + (actual - lastActual) * .28)); lastActual = actual;
    navigation(); queue();
  }, { passive: true });
  window.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch' || coarse.matches || motion.reduced()) return;
    pointer.tx = event.clientX / Math.max(w, 1); pointer.ty = event.clientY / Math.max(h, 1); queue();
  }, { passive: true });
  window.addEventListener('resize', layout, { passive: true });
  document.addEventListener('visibilitychange', function () { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) layout(); });
  new MutationObserver(function () { colors(); if (!motion.reduced()) paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-gear'] });
  motion.subscribe(function () { cancelAnimationFrame(raf); raf = 0; wind = desiredWind = 0; layout(); });
  if (window.SkyBlackHole) window.SkyBlackHole.after(layout); else layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.SkyScrollField = { settled: function () { return !raf; }, draws: function () { return draws; } };
})();
