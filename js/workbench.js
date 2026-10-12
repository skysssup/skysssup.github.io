/* A connected project wheel, original vector scenes, and quiet input feedback. */
(function () {
  'use strict';
  var bench = document.querySelector('[data-workbench]');
  if (!bench) return;
  var motion = window.SkyMotion || { reduced: function () { return false; }, subscribe: function () {} };
  var data = JSON.parse(document.getElementById('workbench-data').textContent);
  var orbit = bench.querySelector('[data-orbit]'), viewport = orbit.querySelector('.orbit-window');
  var items = Array.from(orbit.querySelectorAll('[data-orbit-item]'));
  var picks = items.map(function (item) { return item.querySelector('[data-work-pick]'); });
  var cards = Array.from(bench.querySelectorAll('.work-card'));
  var count = bench.querySelector('[data-orbit-count]'), category = bench.querySelector('[data-bench-category]');
  var lattice = orbit.querySelector('canvas'), ctx = null;
  try { ctx = lattice.getContext('2d'); } catch (e) {}
  var mobile = matchMedia('(max-width: 760px)'), x = 0, velocity = 0, target = 0, selected = -1;
  var raf = 0, last = 0, visible = true, height = 460, width = 250, dpr = 1;
  var pointer = { x: .5, y: .5, tx: .5, ty: .5, inside: false }, sceneBounds = null, sceneTransform = null;
  var compass = bench.querySelector('[data-compass-pointer]'), announcement = document.querySelector('[data-announce]');
  var keyTimers = new Map(), latticeInk = '#d4d0b0';
  var echoKeys = new Map(Array.from(bench.querySelectorAll('[data-echo-key]')).map(function (key) { return [key.dataset.echoKey, key]; }));
  var wheelTimer = 0, mobileScrollTimer = 0, suppressClickUntil = 0;
  var drag = null;
  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
  function reduced() { return motion.reduced(); }
  function queue() {
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function select(next, announce) {
    next = clamp(Math.round(next), 0, items.length - 1);
    if (next === selected) return;
    var old = selected;
    selected = next;
    cards.forEach(function (card, i) {
      var on = i === selected;
      card.classList.toggle('is-on', on);
      card.setAttribute('aria-hidden', on ? 'false' : 'true');
      card.inert = !on;
      if (!on && old === i) {
        card.classList.remove('is-probed');
        var action = card.querySelector('[data-scene-action]');
        action.setAttribute('aria-pressed', 'false');
        action.firstChild.textContent = action.dataset.idleLabel + ' ';
      }
    });
    items.forEach(function (item, i) {
      item.classList.toggle('is-active', i === selected);
      picks[i].setAttribute('aria-pressed', String(i === selected));
      picks[i].tabIndex = i === selected ? 0 : -1;
      item.querySelector('.orbit-open').tabIndex = i === selected ? 0 : -1;
    });
    count.textContent = String(selected + 1).padStart(2, '0') + ' / ' + String(items.length).padStart(2, '0');
    category.textContent = data[selected].category;
    orbit.querySelector('[data-orbit-step="-1"]').disabled = selected === 0;
    orbit.querySelector('[data-orbit-step="1"]').disabled = selected === items.length - 1;
    bench.setAttribute('data-selected', data[selected].slug);
    if (announce && announcement) announcement.textContent = data[selected].name + ' selected';
    sceneBounds = sceneTransform = null;
  }
  function move(next, focus, announce) {
    target = clamp(next, 0, items.length - 1);
    select(target, announce);
    if (focus) picks[selected].focus({ preventScroll: true });
    if (mobile.matches) items[selected].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced() ? 'instant' : 'smooth' });
    if (reduced()) { x = target; velocity = 0; pose(); }
    else queue();
  }
  function pose() {
    items.forEach(function (item, i) {
      if (mobile.matches) { item.style.transform = ''; item.style.opacity = ''; item.style.zIndex = ''; return; }
      var delta = i - x, distance = Math.abs(delta);
      item.style.transform = 'translate3d(' + (18 - Math.min(4, distance) * 9).toFixed(2) + 'px,' + (height / 2 + delta * 88 - 44).toFixed(2) + 'px,' + (24 - Math.min(4, distance) * 14).toFixed(2) + 'px) rotateX(' + clamp(delta * -9, -32, 32).toFixed(2) + 'deg) rotateZ(' + clamp(delta * -3, -9, 9).toFixed(2) + 'deg)';
      item.style.opacity = String(Math.max(.85, 1 - distance * .04));
      item.style.zIndex = String(20 - Math.round(distance));
    });
    drawLattice();
  }
  function drawLattice() {
    if (!ctx || mobile.matches) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    var ink = latticeInk;
    ctx.strokeStyle = ink;
    ctx.lineWidth = .65;
    var middle = height * .5, tilt = (pointer.x - .5) * 6;
    for (var i = 0; i < 66; i++) {
      var y = (i / 65) * height, bend = Math.sin(i * 1.91 + x * .3) * 13;
      var delta = Math.abs(y - middle), reach = 20 + Math.pow(Math.cos(delta / height * Math.PI), 5) * 22;
      ctx.globalAlpha = .16 + Math.exp(-delta / 90) * .38;
      ctx.beginPath();
      ctx.moveTo(12 + Math.sin(y * .032 + x * .4) * 5, y);
      ctx.bezierCurveTo(24 + tilt, y + bend, 36 + tilt, y - bend * .6, reach + tilt, y + bend * .3);
      ctx.stroke();
      if (i % 3 === 0) { ctx.fillStyle = ink; ctx.fillRect(reach + tilt - .5, y + bend * .3 - .5, 1, 1); }
    }
    ctx.globalAlpha = .6;
    ctx.beginPath();
    for (var j = 0; j <= 64; j++) {
      var yy = j * height / 64, xx = 12 + Math.sin(yy * .032 + x * .4) * 5;
      if (!j) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }
  function feedback() {
    var card = cards[selected], mark = card.querySelector('.scene-pointer');
    if (mark) mark.setAttribute('transform', 'translate(' + (pointer.x * 640).toFixed(2) + ' ' + (pointer.y * 360).toFixed(2) + ')');
    if (compass) compass.setAttribute('transform', 'translate(' + ((pointer.x - .5) * 50).toFixed(2) + ' ' + ((pointer.y - .5) * 50).toFixed(2) + ')');
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = Math.min(.033, Math.max(.001, (now - last) / 1000)); last = now;
    if (reduced()) { x = target; velocity = 0; pointer.x = pointer.tx; pointer.y = pointer.ty; }
    else {
      // Analytic critically damped spring: stable across slow frames and rapid reversals.
      var omega = 15, offset = x - target, c = velocity + omega * offset, decay = Math.exp(-omega * dt);
      x = target + (offset + c * dt) * decay;
      velocity = (velocity - omega * c * dt) * decay;
      var follow = 1 - Math.exp(-dt * 22);
      pointer.x += (pointer.tx - pointer.x) * follow;
      pointer.y += (pointer.ty - pointer.y) * follow;
    }
    pose(); feedback();
    var moving = Math.abs(x - target) > .001 || Math.abs(velocity) > .005;
    var tracking = Math.abs(pointer.x - pointer.tx) + Math.abs(pointer.y - pointer.ty) > .001;
    if (!reduced() && (moving || tracking)) raf = requestAnimationFrame(frame);
    else { x = target; velocity = 0; pose(); }
  }
  function layout() {
    height = viewport.clientHeight || 460; width = lattice.clientWidth || 250;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    lattice.width = Math.round(width * dpr); lattice.height = Math.round(height * dpr);
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0';
    x = target; velocity = 0; sceneBounds = sceneTransform = null; pose(); feedback();
  }
  picks.forEach(function (pick, i) {
    pick.disabled = false;
    pick.addEventListener('click', function () { move(i, false, true); });
    pick.addEventListener('keydown', function (event) {
      var next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? selected + 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? selected - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); move(next, true, true);
    });
  });
  orbit.querySelectorAll('[data-orbit-step]').forEach(function (button) {
    button.addEventListener('click', function () { move(selected + Number(button.dataset.orbitStep), false, true); });
  });
  orbit.addEventListener('wheel', function (event) {
    if (mobile.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    if (!delta || (target <= 0 && delta < 0) || (target >= items.length - 1 && delta > 0)) return;
    event.preventDefault();
    move(target + clamp(delta / 140, -1.4, 1.4), false, false);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { move(Math.round(target), false, true); }, 130);
  }, { passive: false });
  viewport.addEventListener('scroll', function () {
    if (!mobile.matches) return;
    clearTimeout(mobileScrollTimer);
    mobileScrollTimer = setTimeout(function () {
      var center = viewport.scrollLeft + viewport.clientWidth / 2, nearest = 0, distance = Infinity;
      items.forEach(function (item, i) {
        var gap = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
        if (gap < distance) { nearest = i; distance = gap; }
      });
      target = x = nearest; select(nearest, true);
    }, 120);
  }, { passive: true });
  // Desktop pen/mouse dragging shares the same spring. Touch keeps native page scrolling.
  orbit.addEventListener('pointerdown', function (event) {
    if (mobile.matches || event.pointerType === 'touch' || event.button !== 0 || event.target.closest('a, .orbit-step')) return;
    drag = { id: event.pointerId, y: event.clientY, start: target, moved: false };
  });
  orbit.addEventListener('pointermove', function (event) {
    if (!drag || drag.id !== event.pointerId) return;
    var dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dy) < 8) return;
    drag.moved = true;
    orbit.setPointerCapture(event.pointerId);
    orbit.classList.add('is-dragging');
    move(drag.start - dy / 88, false, false);
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    var moved = drag.moved;
    drag = null; orbit.classList.remove('is-dragging');
    if (orbit.hasPointerCapture(event.pointerId)) orbit.releasePointerCapture(event.pointerId);
    if (moved) { suppressClickUntil = performance.now() + 120; move(Math.round(target), false, true); }
  }
  orbit.addEventListener('pointerup', endDrag);
  orbit.addEventListener('pointercancel', endDrag);
  orbit.addEventListener('lostpointercapture', endDrag);
  orbit.addEventListener('click', function (event) {
    // A drag ending on a project button must not select that button afterwards.
    if (event.detail && performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  cards.forEach(function (card) {
    var drawing = card.querySelector('.scene-drawing');
    drawing.addEventListener('pointerenter', function (event) {
      if (event.pointerType === 'touch') return;
      sceneBounds = drawing.getBoundingClientRect(); pointer.inside = true; card.classList.add('is-pointed');
      var matrix = card.querySelector('.scene-svg').getScreenCTM(); sceneTransform = matrix ? matrix.inverse() : null;
    });
    drawing.addEventListener('pointermove', function (event) {
      if (event.pointerType === 'touch' || reduced()) return;
      if (!sceneBounds) sceneBounds = drawing.getBoundingClientRect();
      if (!sceneTransform) { var matrix = card.querySelector('.scene-svg').getScreenCTM(); sceneTransform = matrix ? matrix.inverse() : null; }
      if (sceneTransform && window.DOMPoint) {
        var point = new DOMPoint(event.clientX, event.clientY).matrixTransform(sceneTransform);
        pointer.tx = clamp(point.x / 640, 0, 1); pointer.ty = clamp(point.y / 360, 0, 1);
      } else {
        pointer.tx = clamp((event.clientX - sceneBounds.left) / sceneBounds.width, 0, 1);
        pointer.ty = clamp((event.clientY - sceneBounds.top) / sceneBounds.height, 0, 1);
      }
      queue();
    }, { passive: true });
    drawing.addEventListener('pointerleave', function () {
      card.classList.remove('is-pointed'); pointer.inside = false; pointer.tx = pointer.ty = .5; queue();
    });
    var action = card.querySelector('[data-scene-action]');
    action.addEventListener('click', function () {
      var on = !card.classList.contains('is-probed');
      card.classList.toggle('is-probed', on);
      action.setAttribute('aria-pressed', String(on));
      action.firstChild.textContent = (on ? action.dataset.activeLabel : action.dataset.idleLabel) + ' ';
    });
  });
  bench.addEventListener('keydown', function (event) {
    var key = echoKeys.get(event.key);
    if (!key) return;
    clearTimeout(keyTimers.get(key)); key.classList.add('is-pressed');
    keyTimers.set(key, setTimeout(function () { key.classList.remove('is-pressed'); keyTimers.delete(key); }, 180));
  });
  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('scroll', function () { sceneBounds = sceneTransform = null; }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      cancelAnimationFrame(raf); raf = 0; clearTimeout(wheelTimer); clearTimeout(mobileScrollTimer);
      target = Math.round(target);
      keyTimers.forEach(function (timer, key) { clearTimeout(timer); key.classList.remove('is-pressed'); }); keyTimers.clear();
      if (drag && orbit.hasPointerCapture(drag.id)) orbit.releasePointerCapture(drag.id);
      drag = null; orbit.classList.remove('is-dragging');
    }
    else layout();
  });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    bench.classList.toggle('is-visible', visible);
    if (!visible) { cancelAnimationFrame(raf); raf = 0; }
    else layout();
  }, { rootMargin: '80px' }).observe(bench);
  new MutationObserver(function () {
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0'; drawLattice();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-gear'] });
  mobile.addEventListener('change', layout);
  motion.subscribe(function () { cancelAnimationFrame(raf); raf = 0; layout(); });
  bench.classList.add('is-ready');
  select(0, false); layout();
  window.SkyWorkbench = { select: function (index) { move(index, false, true); }, selected: function () { return selected; }, settled: function () { return !raf; } };
})();
