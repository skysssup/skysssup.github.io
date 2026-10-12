/* Engraved contour margins: scroll moves the drawing, selection changes its relief. */
(function () {
  'use strict';
  var canvas = document.querySelector('[data-scroll-field]');
  if (!canvas) return;
  var ctx;
  try { ctx = canvas.getContext('2d'); } catch (e) { canvas.remove(); return; }
  if (!ctx) { canvas.remove(); return; }
  var motion = window.SkyMotion || { reduced: function () { return false; }, subscribe: function () {} };
  var coarse = matchMedia('(pointer: coarse)'), w = 0, h = 0, dpr = 1;
  var actual = scrollY, position = actual;
  var raf = 0, last = 0, ink, hot, draws = 0, relief = 0, reliefTarget = 0;
  var rail = document.querySelector('.scroll-waypoints'), links = Array.from(rail.querySelectorAll('a'));
  var sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); });
  var tops = [], maxScroll = 1;
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
    // Restrict the marks to the page margins; the portrait and writing stay clear.
    var mobile = w <= 760, margin = mobile ? 12 : Math.max(18, Math.min(120, (w - 1200) / 2 - 12));
    var progress = Math.min(1, position / Math.max(1, tops[1] || h));
    var travel = position * .12, phase = position * .0007;
    ctx.lineWidth = .6;
    for (var side = 0; side < 2; side++) {
      ctx.save();
      ctx.beginPath(); ctx.rect(side ? w - margin : 0, 0, margin, h); ctx.clip();
      for (var line = 0; line < (mobile ? 7 : 30); line++) {
        ctx.strokeStyle = line % 6 === 0 ? hot : ink;
        ctx.globalAlpha = line % 6 === 0 ? .2 : .075;
        ctx.beginPath();
        for (var step = 0; step <= 72; step++) {
          var y = step * h / 72;
          var u = (y + travel) / Math.max(h, 1);
          var wave = Math.sin(u * 5.2 + phase + side * 1.6 + relief * .18);
          var shoulder = Math.exp(-Math.pow((u % 1.5 - .55) * 4, 2));
          var distance = line * (mobile ? 3 : 5.4) - 20 + shoulder * (28 + relief * 2) + wave * (10 + 18 * (1 - progress));
          var xx = side ? w - distance : distance;
          if (!step) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
        }
        ctx.stroke();
      }
      // Fine registration ticks carry the same scroll direction as the contours.
      ctx.strokeStyle = ink; ctx.globalAlpha = .22;
      var stride = mobile ? 120 : 84, offset = ((travel % stride) + stride) % stride;
      for (var tick = -1; tick < h / stride + 1; tick++) {
        var yy = tick * stride - offset + stride, edge = side ? w - 7 : 7, sign = side ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(edge, yy); ctx.lineTo(edge + sign * 4, yy);
        ctx.moveTo(edge, yy - 2); ctx.lineTo(edge, yy + 2); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function frame(now) {
    raf = 0;
    if (document.hidden || motion.reduced()) return;
    var dt = Math.min(.04, Math.max(.001, (now - last) / 1000)); last = now;
    var follow = 1 - Math.exp(-dt * 12);
    position += (actual - position) * follow;
    relief += (reliefTarget - relief) * follow;
    paint();
    if (Math.abs(reliefTarget - relief) > .001 || Math.abs(actual - position) > .1) raf = requestAnimationFrame(frame);
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
    actual = scrollY;
    navigation(); queue();
  }, { passive: true });
  document.addEventListener('sky:workselect', function (event) {
    reliefTarget = event.detail.index;
    if (motion.reduced()) relief = reliefTarget; else queue();
  });
  window.addEventListener('resize', layout, { passive: true });
  document.addEventListener('visibilitychange', function () { cancelAnimationFrame(raf); raf = 0; if (!document.hidden) layout(); });
  new MutationObserver(function () { colors(); if (!motion.reduced()) paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-gear'] });
  motion.subscribe(function () { cancelAnimationFrame(raf); raf = 0; layout(); });
  if (window.SkyBlackHole) window.SkyBlackHole.after(layout); else layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.SkyScrollField = { settled: function () { return !raf; }, draws: function () { return draws; } };
})();
