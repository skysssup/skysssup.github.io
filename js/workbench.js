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
  var announcement = document.querySelector('[data-announce]');
  var connections = bench.querySelector("[data-bench-connections]"), connectionContext = connections && connections.getContext("2d");
  var connectionBounds = null, connectionGeometry = null;
  var keyTimers = new Map(), latticeInk = '#d4d0b0';
  var echoKeys = new Map(Array.from(bench.querySelectorAll('[data-echo-key]')).map(function (key) { return [key.dataset.echoKey, key]; }));
  var wheelTimer = 0, mobileScrollTimer = 0, suppressClickUntil = 0;
  var drag = null, followingWheel = false, spacing = 100, focusY = 250, posedX = NaN;
  function clamp(n, low, high) { return Math.max(low, Math.min(high, n)); }
  function reduced() { return motion.reduced(); }
  function queue() {
    if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  function select(next, announce) {
    next = clamp(Math.round(next), 0, items.length - 1);
    if (next === selected) return;
    var old = selected;
    selected = next; posedX = NaN; connectionGeometry = null;
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
    document.dispatchEvent(new CustomEvent('sky:workselect', { detail: { index: selected } }));
    if (announce && announcement) announcement.textContent = data[selected].name + ' selected';
    sceneBounds = sceneTransform = null;
    pointer.inside = false; cards.forEach(function (card) { card.classList.remove("is-pointed"); });
  }
  function move(next, focus, announce, gesture) {
    target = clamp(next, 0, items.length - 1);
    followingWheel = !!gesture;
    if (!gesture) { clearTimeout(wheelTimer); wheelTimer = 0; }
    if (!gesture || reduced() || mobile.matches) select(target, announce);
    if (focus) picks[selected].focus({ preventScroll: true });
    if (mobile.matches) items[selected].scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduced() ? 'instant' : 'smooth' });
    if (reduced()) { x = target; velocity = 0; pose(); }
    else queue();
  }
  function pose() {
    if (posedX === x) return;
    posedX = x;
    focusY = height / 2 - 92 * Math.exp(-x / 1.1) + 92 * Math.exp(-(items.length - 1 - x) / 1.1);
    items.forEach(function (item, i) {
      if (mobile.matches) { item.style.transform = ''; item.style.opacity = ''; item.style.zIndex = ''; return; }
      var delta = i - x, distance = Math.abs(delta);
      var proximity = Math.max(0, 1 - distance / 3), shift = Math.pow(Math.min(3, distance), 1.5) * -4;
      item.style.transform = 'translate3d(' + shift.toFixed(2) + 'px,' + (focusY + delta * spacing - 48).toFixed(2) + 'px,' + (proximity * 12).toFixed(2) + 'px) rotateX(' + clamp(delta * -7, -26, 26).toFixed(2) + 'deg) rotateZ(' + clamp(delta * -3, -10, 10).toFixed(2) + 'deg)';
      item.style.opacity = '1';
      item.style.setProperty('--proximity', proximity.toFixed(3));
      item.style.zIndex = String(20 - Math.round(distance));
    });
    drawLattice();
    drawConnections();
  }
  function drawConnections() {
    if (!connectionContext || mobile.matches || selected < 0) return;
    if (!connectionGeometry) {
      var rect = bench.querySelector('.bench-body').getBoundingClientRect();
      var rail = viewport.getBoundingClientRect();
      var to = cards[selected].querySelector('.scene-drawing').getBoundingClientRect();
      connectionGeometry = { width: rect.width, height: rect.height, sourceX: rail.left - rect.left, sourceY: rail.top - rect.top, railWidth: viewport.clientWidth, toX: to.left - rect.left, toY: to.top - rect.top + 26 };
      if (!connectionBounds || connectionBounds.width !== rect.width || connectionBounds.height !== rect.height) {
        connectionBounds = { width: rect.width, height: rect.height };
        connections.width = Math.round(rect.width * dpr); connections.height = Math.round(rect.height * dpr);
      }
    }
    // Project the card's centre with the same perspective as the wheel.
    // Geometry is read on selection/resize, rather than forcing layout every frame.
    var g = connectionGeometry, delta = selected - x, distance = Math.abs(delta);
    var proximity = Math.max(0,1 - distance / 3), shift = Math.pow(Math.min(3,distance),1.5) * -4;
    var projection = 900 / (900 - proximity * 12);
    var ax = g.sourceX + g.railWidth / 2 + (g.railWidth / 2 + shift) * projection + 4;
    var ay = g.sourceY + height / 2 + (focusY + delta * spacing - height / 2) * projection;
    var bx = g.toX, by = g.toY, elbow = ax + Math.max(6,(bx - ax) * .5), c = connectionContext;
    c.setTransform(dpr,0,0,dpr,0,0); c.clearRect(0,0,g.width,g.height);
    c.strokeStyle = latticeInk; c.lineWidth = .65; c.globalAlpha = .35;
    c.beginPath(); c.moveTo(ax,ay); c.lineTo(elbow,ay); c.lineTo(elbow,by); c.lineTo(bx,by); c.stroke();
    c.globalAlpha = .8; c.fillStyle = latticeInk;
    c.fillRect(ax - 1,ay - 1,2,2); c.fillRect(bx - 1,by - 1,2,2); c.globalAlpha = 1;
  }
  function drawLattice() {
    if (!ctx || mobile.matches) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0,0,width,height);
    ctx.strokeStyle = latticeInk; ctx.fillStyle = latticeInk; ctx.lineWidth = .6;
    // Ticks travel with the actual wheel, while the focus notch stays in the centre.
    var middle = focusY, step = spacing / 5;
    ctx.globalAlpha = .2;
    ctx.beginPath(); ctx.moveTo(20,18); ctx.lineTo(20,height - 18); ctx.stroke();
    for (var i = -18; i <= 18; i++) {
      var y = middle + i * step - (x % 1) * spacing;
      if (y < 18 || y > height - 18) continue;
      var major = i % 5 === 0, intensity = Math.max(.08, .5 * (1 - Math.abs(y - middle) / middle));
      ctx.globalAlpha = intensity; ctx.beginPath(); ctx.moveTo(20,y); ctx.lineTo(major ? 31 : 25,y); ctx.stroke();
    }
    ctx.globalAlpha = .85; ctx.beginPath(); ctx.moveTo(17,middle - 3); ctx.lineTo(20,middle); ctx.lineTo(17,middle + 3); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function feedback() {
    var card = cards[selected], mark = card.querySelector('.scene-pointer');
    if (mark) mark.setAttribute('transform', 'translate(' + (pointer.x * 640).toFixed(2) + ' ' + (pointer.y * 360).toFixed(2) + ')');
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    var dt = Math.min(.033, Math.max(.001, (now - last) / 1000)); last = now;
    if (reduced()) { x = target; velocity = 0; pointer.x = pointer.tx; pointer.y = pointer.ty; }
    else {
      // Analytic critically damped spring: stable across slow frames and rapid reversals.
      var omega = followingWheel ? 23 : 17, offset = x - target, c = velocity + omega * offset, decay = Math.exp(-omega * dt);
      x = target + (offset + c * dt) * decay;
      velocity = (velocity - omega * c * dt) * decay;
      var follow = 1 - Math.exp(-dt * 22);
      pointer.x += (pointer.tx - pointer.x) * follow;
      pointer.y += (pointer.ty - pointer.y) * follow;
    }
    if (followingWheel) select(Math.round(x), false);
    pose(); feedback();
    var moving = Math.abs(x - target) > .001 || Math.abs(velocity) > .005;
    var tracking = Math.abs(pointer.x - pointer.tx) + Math.abs(pointer.y - pointer.ty) > .001;
    if (!reduced() && (moving || tracking)) raf = requestAnimationFrame(frame);
    else { x = target; velocity = 0; if (followingWheel) { select(Math.round(x), true); followingWheel = false; } pose(); }
  }
  function layout() {
    posedX = NaN;
    height = viewport.clientHeight || 460; width = lattice.clientWidth || 250;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    lattice.width = Math.round(width * dpr); lattice.height = Math.round(height * dpr);
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0';
    x = target; velocity = 0; if (followingWheel) select(Math.round(x), false); connectionBounds = connectionGeometry = null; sceneBounds = sceneTransform = null; pose(); feedback();
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
    move(target + clamp(delta / 140, -1.4, 1.4), false, false, true);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelTimer = 0; move(Math.round(target), false, true, true); }, 110);
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
    move(drag.start - dy / spacing, false, false, true);
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    var moved = drag.moved;
    drag = null; orbit.classList.remove('is-dragging');
    if (orbit.hasPointerCapture(event.pointerId)) orbit.releasePointerCapture(event.pointerId);
    if (moved) { suppressClickUntil = performance.now() + 120; move(Math.round(target), false, true, true); }
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
      cancelAnimationFrame(raf); raf = 0; clearTimeout(wheelTimer); clearTimeout(mobileScrollTimer); wheelTimer = mobileScrollTimer = 0;
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
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0'; drawLattice(); drawConnections();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-gear'] });
  mobile.addEventListener('change', layout);
  motion.subscribe(function () { cancelAnimationFrame(raf); raf = 0; layout(); });
  bench.classList.add('is-ready');
  select(0, false); layout();
  window.SkyWorkbench = { select: function (index) { move(index, false, true); }, selected: function () { return selected; }, settled: function () { return !raf && !wheelTimer; }, position: function () { return x; } };
})();
