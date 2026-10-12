/* Living linework. Geometry follows actual scroll, pointer, keys, and project selection. */
(function () {
  'use strict';
  var motion = window.SkyMotion, root = document.documentElement;
  var coarse = matchMedia('(pointer: coarse)');
  var pointer = { x: .5, y: .5, tx: .5, ty: .5 }, impulse = 0, selection = 0;
  var slots = [], raf = 0, lastPaint = 0, frames = 0, elapsed = 0;
  var ink = '#e3e1d6', accent = '#c7c7ad', pose = 0;
  function colors() {
    var style = getComputedStyle(root);
    ink = style.getPropertyValue('--ink').trim(); accent = style.getPropertyValue('--accent').trim();
  }
  function line(ctx, points, color, alpha, dashed) {
    ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = .65;
    ctx.setLineDash(dashed ? [2, 5] : []); ctx.beginPath();
    points.forEach(function (p, i) { if (!i) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function cross(ctx, x, y, size, color, alpha) {
    line(ctx, [[x - size, y], [x + size, y]], color, alpha);
    line(ctx, [[x, y - size], [x, y + size]], color, alpha);
  }
  function hero(slot, time) {
    var c = slot.ctx, w = slot.w, h = slot.h, f = slot.figure;
    var margin = Math.max(22, f.x), radius = Math.min(112, margin * .46), center = margin * .5;
    c.save();
    // Keep the artwork around the full-size avatar; no deformation or miniature copy.
    c.beginPath(); c.rect(0, 0, w, h); c.rect(f.x + 6, f.y + 8, f.w - 12, f.h - 16); c.clip('evenodd');
    if (w > 760) {
      var stem = [], top = f.y + 12, span = f.h - 24;
      for (var twig = 0; twig < 96; twig++) {
        var yy = top + twig * span / 95, phase = twig * .32 + time * .28 + pose * 2;
        var xx = center + Math.sin(yy * .021 + time * .19 + pose * 1.7) * (11 + impulse * 4);
        var fork = twig % 2 ? -1 : 1;
        var reach = radius * (.28 + .65 * Math.pow(Math.sin(twig * .071 + .8 + pose * .65), 4));
        var drift = Math.sin(phase) * (10 + impulse * 12) + (pointer.y - .5) * 8;
        c.strokeStyle = twig % 5 ? ink : accent; c.lineWidth = .55; c.globalAlpha = .28;
        c.beginPath(); c.moveTo(xx,yy); c.bezierCurveTo(xx + fork * reach * .35,yy + drift,xx + fork * reach * .7,yy - drift,xx + fork * reach,yy + drift * .35); c.stroke();
        if (twig % 2 === 0) {
          line(c,[[xx + fork * reach * .58,yy - drift * .18],[xx + fork * reach * 1.12,yy - 8 - drift]],ink,.18);
          c.fillStyle = twig % 5 ? ink : accent; c.globalAlpha = .7; c.fillRect(xx + fork * reach,yy + drift * .35,1.1,1.1);
        }
        stem.push([xx,yy]);
      }
      line(c,stem,ink,.5);
      for (var bead = 0; bead < 9; bead++) {
        var syy = top + ((time * 24 + bead * span / 9) % span);
        cross(c,center + Math.sin(syy * .021 + time * .19 + pose * 1.7) * (11 + impulse * 4),syy,1.5,accent,.85);
      }
      // A field attached to the portrait boundary opens with actual scroll/pointer travel.
      // It has no independent floating object or perpetual rotation.
      var edgeX = f.x + f.w + 12, endX = w - center * .45;
      for (var feather = 0; feather < 18; feather++) {
        var fy = f.y + f.h * (.32 + feather * .019);
        var bend = Math.sin(feather * .19 + pose * 2) * radius * .32 + (pointer.y - .5) * radius * .16;
        c.strokeStyle = feather % 5 ? ink : accent; c.lineWidth = .55; c.globalAlpha = feather % 5 ? .12 : .25;
        c.beginPath(); c.moveTo(edgeX,fy); c.bezierCurveTo(edgeX + radius * .5,fy + bend,endX - radius * .3,fy - bend,endX,fy + bend * .2); c.stroke();
      }
    } else {
      cross(c,9,h * .32,3,accent,.65); cross(c,w - 9,h * .61,3,accent,.65);
    }
    for (var side = 0; side < 2; side++) {
      var sx = side ? w - center : center, sy = h * (side ? .57 : .36), sign = side ? -1 : 1;
      var edge = side ? f.x + f.w : f.x;
      line(c, [[sx, sy], [sx + sign * radius * 1.4, sy], [edge, f.y + f.h * (side ? .62 : .31)]], ink, .22, true);
      for (var i = 0; i < 18; i++) {
        var y = f.y + i * f.h / 17;
        var length = i % 4 ? 4 : 11;
        line(c, [[edge + sign * 9, y], [edge + sign * (9 + length), y]], ink, i % 4 ? .16 : .38);
      }
      var targetY = f.y + f.h * (.5 + Math.sin(time * .2 + side) * .2);
      cross(c, edge + sign * 12, targetY, 2.5, accent, .7);
      for (var j = 0; j < 12; j++) {
        var yy = h * .13 + j * h * .055, reach = radius * (.5 + .5 * Math.sin(j * 1.3 + time * .16));
        line(c, [[sx - reach / 2, yy], [sx + reach / 2, yy]], ink, .06);
      }
    }
    if (slot.hover) {
      var at = slot.hover, origin = at.x < w / 2 ? [center, h * .36] : [w - center, h * .57];
      line(c, [origin, [at.x, at.y]], accent, .38, true); cross(c, at.x, at.y, 5, accent, .8);
    }
    c.restore();
  }
  function work(slot, time) {
    var c = slot.ctx, h = Math.min(500, slot.h), spine = 24;
    var position = window.SkyWorkbench ? window.SkyWorkbench.position() : selection;
    for (var i = 0; i < 92; i++) {
      var y = i * h / 91, phase = y * .031 + time * .27 + position * .4;
      var x = spine + Math.sin(phase) * 6, distance = Math.abs(y - h * .5);
      var reach = 9 + 27 * Math.exp(-distance / 110) + impulse * 6;
      var curl = Math.sin(i * .71 + time * .53) * reach * .55;
      c.strokeStyle = i % 7 ? ink : accent; c.lineWidth = .6; c.globalAlpha = .16 + .32 * Math.exp(-distance / 160);
      c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + reach * .5, y + curl, x + reach * .8, y - curl, x + reach, y + curl * .25); c.stroke();
      if (i % 3 === 0) { c.fillStyle = ink; c.globalAlpha = .65; c.fillRect(x + reach, y + curl * .25, 1, 1); }
    }
    var stem = [];
    for (var j = 0; j <= 100; j++) { var yy = j * h / 100; stem.push([spine + Math.sin(yy * .031 + time * .27 + position * .4) * 6, yy]); }
    line(c, stem, ink, .42);
    for (var bead = 0; bead < 7; bead++) {
      var at = ((time * 22 + bead * 83 + position * 31) % h + h) % h;
      cross(c, spine + Math.sin(at * .031 + time * .27 + position * .4) * 6, at, 1.5, accent, .8);
    }
  }
  function draw(slot, time) {
    var c = slot.ctx; c.setTransform(slot.dpr, 0, 0, slot.dpr, 0, 0); c.clearRect(0, 0, slot.w, slot.h);
    if (slot.type === 'hero') hero(slot, time); else work(slot, time);
    c.globalAlpha = 1;
  }
  function active() { return !document.hidden && !motion.reduced() && slots.some(function (slot) { return slot.visible && slot.enabled; }); }
  function queue() { if (!raf && active()) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!active()) return;
    if (now - lastPaint >= 1000 / 30) {
      var dt = Math.min(.1, (now - lastPaint) / 1000); lastPaint = now; elapsed += dt;
      var follow = 1 - Math.exp(-dt * 9);
      pointer.x += (pointer.tx - pointer.x) * follow; pointer.y += (pointer.ty - pointer.y) * follow;
      impulse *= Math.exp(-dt * 3); pose = scrollY * .001;
      slots.forEach(function (slot) { if (slot.visible && slot.enabled) draw(slot, elapsed); }); frames++;
    }
    queue();
  }
  function layout(slot) {
    slot.canvas.hidden = false;
    var box = slot.canvas.getBoundingClientRect();
    slot.w = box.width; slot.h = box.height; slot.top = box.top + scrollY; slot.left = box.left;
    slot.dpr = Math.min(devicePixelRatio || 1, coarse.matches ? 1 : 1.25);
    slot.canvas.width = Math.round(slot.w * slot.dpr); slot.canvas.height = Math.round(slot.h * slot.dpr);
    slot.enabled = slot.type === 'hero' || innerWidth > 760;
    if (slot.type === 'hero') { var figure = document.getElementById('figure').getBoundingClientRect(); slot.figure = { x: figure.left - box.left, y: figure.top - box.top, w: figure.width, h: figure.height }; }
    slot.canvas.hidden = !slot.enabled;
    if (motion.reduced() && slot.enabled) draw(slot, 0);
  }
  document.querySelectorAll('[data-presence]').forEach(function (canvas) {
    var ctx; try { ctx = canvas.getContext('2d', { desynchronized: true }); } catch (e) { canvas.remove(); return; }
    if (!ctx) { canvas.remove(); return; }
    var slot = { canvas: canvas, ctx: ctx, type: canvas.dataset.presence, visible: false, enabled: true, hover: null };
    slots.push(slot); layout(slot);
    new IntersectionObserver(function (entries) { slot.visible = entries[0].isIntersecting; queue(); if (!active()) { cancelAnimationFrame(raf); raf = 0; } }).observe(canvas);
  });
  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;
    pointer.tx = event.clientX / Math.max(1, innerWidth); pointer.ty = event.clientY / Math.max(1, innerHeight);
  }, { passive: true });
  document.addEventListener('pointerover', function (event) {
    var target = event.target.closest && event.target.closest('a[href],button');
    slots.forEach(function (slot) { slot.hover = null; });
    if (!target || !target.closest('.hero')) return;
    var box = target.getBoundingClientRect();
    slots.forEach(function (slot) { if (slot.type === 'hero') slot.hover = { x: box.left + box.width / 2 - slot.left, y: box.top + scrollY + box.height / 2 - slot.top }; });
  }, { passive: true });
  document.addEventListener('pointerout', function (event) {
    if (event.relatedTarget && event.relatedTarget.closest && event.relatedTarget.closest('.hero a,.hero button')) return;
    slots.forEach(function (slot) { slot.hover = null; });
  }, { passive: true });
  window.addEventListener('wheel', function (event) { if (event.ctrlKey || !event.target.closest('.hero,.workbench')) return; impulse = Math.min(1, impulse + Math.abs(event.deltaY) * .002); }, { passive: true });
  document.addEventListener('keydown', function (event) { if (event.target.closest('.workbench') && /^(Arrow|Home|End)/.test(event.key)) { impulse = Math.min(1, impulse + .25); } });
  window.addEventListener('blur', function () { pointer.tx = pointer.ty = .5; });
  document.addEventListener('sky:workselect', function (event) { selection = event.detail.index; impulse = Math.min(1, impulse + .3); });
  function refresh() { colors(); slots.forEach(layout); queue(); }
  new MutationObserver(function () { colors(); if (motion.reduced()) slots.forEach(function (slot) { if (slot.enabled) draw(slot, 0); }); }).observe(root, { attributes: true, attributeFilter: ['data-gear', 'data-theme'] });
  window.addEventListener('resize', refresh, { passive: true });
  document.addEventListener('visibilitychange', function () { cancelAnimationFrame(raf); raf = 0; queue(); });
  motion.subscribe(function () { cancelAnimationFrame(raf); raf = 0; refresh(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  colors(); queue();
  window.SkyPresence = { running: function () { return !!raf; }, frames: function () { return frames; } };
})();
