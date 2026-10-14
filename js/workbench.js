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
  var raf = 0, last = 0, visible = false, height = 460, width = 250, dpr = 1;
  var pointer = { x: .5, y: .5, tx: .5, ty: .5, inside: false }, sceneBounds = null, sceneTransform = null;
  var announcement = document.querySelector('[data-announce]');
  var connections = bench.querySelector("[data-bench-connections]"), connectionContext = connections && connections.getContext("2d");
  var connectionBounds = null, connectionGeometry = null;
  var keyTimers = new Map(), latticeInk = '#d4d0b0';
  var echoKeys = new Map(Array.from(bench.querySelectorAll('[data-echo-key]')).map(function (key) { return [key.dataset.echoKey, key]; }));
  var wheelTimer = 0, mobileScrollTimer = 0, suppressClickUntil = 0;
  var drag = null, followingWheel = false, spacing = 100, focusY = 250, posedX = NaN;
  var sceneRun = null, sceneTop = 0, sceneHeight = 1, sceneRead = -1, sceneVisible = false, previewed = false, sceneObserver = null;
  var labs = [], liveButton = bench.querySelector('[data-bench-live]'), live = true, repeatTimer = 0;
  function clearRepeat() { clearTimeout(repeatTimer); repeatTimer = 0; }
  function scheduleExample() {
    clearRepeat();
    if (!live || reduced() || document.hidden || !visible || !sceneVisible || !drawingOnscreen() || selected < 0 || labs[selected].activated()) return;
    repeatTimer = setTimeout(function () { repeatTimer = 0; previewed = false; automaticPreview(); }, 1800);
  }
  function syncLabMotion() {
    labs.forEach(function (lab, i) { if (i === selected && visible && sceneVisible && drawingOnscreen() && !document.hidden && live) lab.resume(); else lab.pause(); });
  }
  function drawingOnscreen() { return sceneTop - scrollY < innerHeight && sceneTop - scrollY + sceneHeight > 0; }
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
    clearRepeat(); sceneRun = null; sceneRead = -1; previewed = false;
    cards.forEach(function (card, i) {
      var on = i === selected;
      card.classList.toggle('is-on', on);
      card.setAttribute('aria-hidden', on ? 'false' : 'true');
      card.inert = !on;
      if (!on && old === i) {
        labs[i].reset(); labs[i].pause(); card.classList.remove('is-lab-active');
        card.classList.remove('is-probed');
        card.classList.remove('is-running', 'is-previewed'); card.removeAttribute('data-scene-step');
        card.querySelector('[data-scene-status]').textContent = data[i].scene.idle;
        resetSceneVisuals(card);
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
    pointer.inside = false; cards.forEach(function (card) { card.classList.remove("is-pointed", "is-inspecting"); });
    sceneLayout();
    if (sceneObserver) { sceneVisible = false; sceneObserver.disconnect(); sceneObserver.observe(cards[selected].querySelector('.scene-drawing')); }
  }
  function move(next, focus, announce, gesture) {
    target = clamp(next, 0, items.length - 1);
    followingWheel = !reduced() && !mobile.matches;
    if (!gesture) {
      clearTimeout(wheelTimer); wheelTimer = 0;
      if (drag) {
        var id = drag.id; drag = null; orbit.classList.remove('is-dragging');
        if (orbit.hasPointerCapture(id)) orbit.releasePointerCapture(id);
      }
    }
    clearTimeout(mobileScrollTimer); mobileScrollTimer = 0;
    if (reduced()) select(target, announce);
    if (focus) picks[Math.round(target)].focus({ preventScroll: true });
    if (mobile.matches) {
      var item = items[Math.round(target)];
      viewport.scrollTo({ left: item.offsetLeft + item.offsetWidth / 2 - viewport.clientWidth / 2, behavior: reduced() ? 'instant' : 'smooth' });
      if (reduced()) { x = target; velocity = 0; pose(); }
      return;
    }
    if (reduced()) { x = target; velocity = 0; pose(); }
    else queue();
  }
  function pose() {
    if (posedX === x) return;
    posedX = x;
    focusY = height / 2;
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
    if (labs[selected] && labs[selected].activated()) return;
    if (!mark || !pointer.inside || (sceneRun && (!sceneRun.preview || sceneRun.ignoreInspect))) return;
    var points = data[selected].scene.points, near = 0, distance = Infinity;
    points.forEach(function (point, i) {
      var gap = Math.hypot(point[0] - pointer.x * 640, point[1] - pointer.y * 360);
      if (gap < distance) { near = i; distance = gap; }
    });
    card.classList.toggle('is-inspecting', distance < 100);
    if (distance < 100) {
      mark.setAttribute('transform', 'translate(' + points[near].join(' ') + ')');
      card.querySelector('[data-scene-status]').textContent = data[selected].scene.inspect[near];
    } else if (!sceneRun) restoreStatus(card);
  }
  function restoreStatus(card) {
    if (labs[cards.indexOf(card)] && labs[cards.indexOf(card)].activated()) return;
    var scene = data[cards.indexOf(card)].scene;
    card.querySelector('[data-scene-status]').textContent = card.classList.contains('is-probed') || card.classList.contains('is-previewed') ? scene.steps[scene.steps.length - 1][1] : scene.idle;
  }
  function preview(force) {
    if (reduced() || document.hidden || !visible || !sceneVisible || selected < 0 || sceneRun || (!force && !live) || labs[selected].activated()) return;
    clearRepeat();
    var card = cards[selected], action = card.querySelector('[data-scene-action]');
    resetSceneVisuals(card); card.classList.remove('is-probed', 'is-inspecting', 'is-previewed');
    action.setAttribute('aria-pressed','false'); action.firstChild.textContent = action.dataset.idleLabel + ' ';
    card.classList.add('is-running'); previewed = true;
    sceneRun = { elapsed: 0, step: -1, preview: true, ignoreInspect: !!force }; playScene(0); queue();
  }
  function automaticPreview() {
    if (!previewed && !drag && !wheelTimer && !mobileScrollTimer && target === Math.round(target) && Math.abs(x - target) < .01) preview();
  }
  function resetSceneVisuals(card) {
    card.querySelectorAll('.physics-ball,.capture-dot,.recall-marker,.recall-active,.trace-span,.trace-span rect,.pulse-bar,.pulse-wave,.voter,.vote-link,.fault-marker,.blocked-route,.scene-courier').forEach(function (node) {
      ['transform','opacity','fill','stroke','stroke-dasharray','stroke-dashoffset'].forEach(function (property) { node.style.removeProperty(property); });
      if (node.classList.contains('pulse-wave')) node.removeAttribute('pathLength');
    });
  }
  function actionVisuals(card, progress) {
    var hot = 'var(--bench-hot)', paper = 'var(--paper)';
    card.querySelector('.scene-courier').style.opacity = progress < 1 ? '1' : '0';
    card.querySelectorAll('.fault-marker').forEach(function (node) { node.style.opacity = '1'; });
    card.querySelectorAll('.blocked-route').forEach(function (node) { node.style.opacity = String(clamp((progress - .45) / .25,0,1)); });
    var capture = card.querySelector('.capture-dot');
    if (capture) { capture.style.opacity = '1'; capture.style.transform = 'translateX(' + (41 * Math.min(1,progress / .75)).toFixed(2) + 'px)'; }
    [['.recall-marker',99],['.recall-active',100]].forEach(function (entry) {
      var node = card.querySelector(entry[0]); if (node) node.style.transform = 'translateX(' + (entry[1] * Math.min(1,progress / .9)).toFixed(2) + 'px)';
    });
    card.querySelectorAll('.trace-span').forEach(function (node,i) {
      var show = clamp((progress - i * .08) / .65,0,1);
      node.style.opacity = String(.15 + .85 * show); node.style.transform = 'translateX(' + (-8 * (1 - show)).toFixed(2) + 'px)';
      node.querySelector('rect').style.stroke = hot;
    });
    var bars = card.querySelectorAll('.pulse-bar');
    bars.forEach(function (node,i) {
      var show = clamp((progress - i / bars.length * .35) / .65,0,1);
      node.style.opacity = String(.1 + .7 * show); node.style.transform = 'translateY(' + (20 * (1 - show)).toFixed(2) + 'px)'; node.style.fill = hot;
    });
    var wave = card.querySelector('.pulse-wave');
    if (wave) { wave.setAttribute('pathLength','1'); wave.style.strokeDasharray = '1'; wave.style.strokeDashoffset = String(1 - progress); }
    var voters = card.querySelectorAll('.voter');
    voters.forEach(function (node,i) { node.style.fill = progress >= (i + 1) / (voters.length + 1) ? hot : paper; });
    card.querySelectorAll('.vote-link').forEach(function (node) { node.style.opacity = String(.22 + .48 * progress); node.style.stroke = hot; });
  }
  function sceneLayout() {
    if (selected < 0) return;
    var box = cards[selected].querySelector('.scene-drawing').getBoundingClientRect();
    sceneTop = box.top + scrollY; sceneHeight = box.height || 1; sceneRead = -1;
  }
  function revealScene() {
    var read = reduced() ? 1 : clamp((innerHeight - sceneTop + scrollY - 40) / (Math.min(sceneHeight, innerHeight) * 1.35), 0, 1);
    read = Math.round(read * 1000) / 1000;
    if (read !== sceneRead) { sceneRead = read; cards[selected].style.setProperty('--scene-read', read); }
  }
  function playScene(dt) {
    if (!sceneRun || !live || !sceneVisible || !drawingOnscreen() || (sceneRun.preview && !sceneRun.ignoreInspect && cards[selected].classList.contains('is-inspecting'))) return;
    var scene = data[selected].scene, run = sceneRun, card = cards[selected];
    run.elapsed += dt * 1000;
    var step = 0;
    scene.steps.forEach(function (entry, i) { if (run.elapsed >= entry[0]) step = i; });
    if (step !== run.step) {
      run.step = step; card.dataset.sceneStep = step;
      card.querySelector('[data-scene-status]').textContent = scene.steps[step][1];
    }
    var end = scene.steps[scene.steps.length - 1][0], progress = clamp(run.elapsed / end, 0, 1);
    actionVisuals(card, progress);
    var path = progress * (scene.points.length - 1), at = Math.min(scene.points.length - 2, Math.floor(path)), k = path - at;
    k = k * k * (3 - 2 * k);
    var a = scene.points[at], b = scene.points[at + 1];
    card.querySelector('.scene-courier').setAttribute('transform', 'translate(' + (a[0] + (b[0] - a[0]) * k).toFixed(2) + ' ' + (a[1] + (b[1] - a[1]) * k).toFixed(2) + ')');
    var ball = card.querySelector('.physics-ball');
    if (ball) {
      var stops = [[0,0,0],[.38,198,113],[.48,229,138],[.64,296,207],[.74,340,168],[.83,375,207],[.92,403,188],[1,426,207]], segment = 0;
      for (var i = 0; i < stops.length - 2; i++) if (progress >= stops[i + 1][0]) segment = i + 1;
      var from = stops[segment], to = stops[segment + 1], mix = (progress - from[0]) / (to[0] - from[0]);
      ball.style.transform = 'translate(' + (from[1] + (to[1] - from[1]) * mix).toFixed(2) + 'px,' + (from[2] + (to[2] - from[2]) * mix).toFixed(2) + 'px)';
    }
    if (progress >= 1) {
      if (run.preview) card.classList.add('is-previewed');
      card.classList.remove('is-running'); sceneRun = null;
      if (!run.preview && announcement) announcement.textContent = 'Illustration: ' + scene.steps[scene.steps.length - 1][1];
      if (run.preview) scheduleExample();
    }
  }
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    var frameTime = Math.max(.001, (now - last) / 1000), dt = Math.min(.1, frameTime); last = now;
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
    select(Math.round(x), false);
    pose(); feedback(); revealScene(); playScene(Math.min(frameTime,.12));
    var moving = Math.abs(x - target) > .001 || Math.abs(velocity) > .005;
    var tracking = Math.abs(pointer.x - pointer.tx) + Math.abs(pointer.y - pointer.ty) > .001;
    if (!moving) automaticPreview();
    var playing = live && sceneRun && sceneVisible && (!sceneRun.preview || sceneRun.ignoreInspect || !cards[selected].classList.contains('is-inspecting'));
    if (!reduced() && (moving || tracking || playing)) raf = requestAnimationFrame(frame);
    else { x = target; velocity = 0; if (followingWheel) { select(Math.round(x), true); followingWheel = false; } pose(); }
  }
  function layout() {
    posedX = NaN;
    height = viewport.clientHeight || 460; width = lattice.clientWidth || 250;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    cards.forEach(function (card,i) {
      var drawing = card.querySelector('.scene-drawing'); drawing.tabIndex = 0;
      drawing.setAttribute('role',reduced() ? 'group' : 'button');
      drawing.setAttribute('aria-label',(reduced() ? '' : 'Replay ') + data[i].name + ' workflow illustration');
    });
    lattice.width = Math.round(width * dpr); lattice.height = Math.round(height * dpr);
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0';
    x = target; velocity = 0; select(Math.round(x), false); connectionBounds = connectionGeometry = null; sceneBounds = sceneTransform = null; pose(); feedback();
    sceneLayout(); revealScene();
    automaticPreview();
    if (mobile.matches && selected >= 0) viewport.scrollTo({ left: items[selected].offsetLeft + items[selected].offsetWidth / 2 - viewport.clientWidth / 2, behavior: 'instant' });
  }
  picks.forEach(function (pick, i) {
    pick.disabled = false;
    pick.addEventListener('click', function () { move(i, false, true); });
    pick.addEventListener('keydown', function (event) {
      var base = Math.round(target);
      var next = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? base + 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? base - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); move(next, true, true);
    });
  });
  orbit.querySelectorAll('[data-orbit-step]').forEach(function (button) {
    button.addEventListener('click', function () { move(Math.round(target) + Number(button.dataset.orbitStep), false, true); });
  });
  orbit.addEventListener('wheel', function (event) {
    if (mobile.matches || drag || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
    if (!delta || (target <= 0 && delta < 0) || (target >= items.length - 1 && delta > 0)) return;
    event.preventDefault();
    move(target + clamp(delta / 140, -1.4, 1.4), false, false, true);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { wheelTimer = 0; move(Math.round(target), false, true, true); }, 110);
  }, { passive: false });
  function mobileSelection(announce) {
      var center = viewport.scrollLeft + viewport.clientWidth / 2, nearest = 0, distance = Infinity;
      items.forEach(function (item, i) {
        var gap = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
        if (gap < distance) { nearest = i; distance = gap; }
      });
      x = nearest; select(nearest, announce);
      if (announce) target = nearest;
      if (announce) automaticPreview();
  }
  viewport.addEventListener('scroll', function () {
    if (!mobile.matches) return;
    mobileSelection(false);
    clearTimeout(mobileScrollTimer);
    mobileScrollTimer = setTimeout(function () { mobileScrollTimer = 0; mobileSelection(true); }, 120);
  }, { passive: true });
  // Desktop pen/mouse dragging shares the same spring. Touch keeps native page scrolling.
  orbit.addEventListener('pointerdown', function (event) {
    if (mobile.matches || event.pointerType === 'touch' || event.button !== 0 || event.target.closest('a, .orbit-step')) return;
    clearTimeout(wheelTimer); wheelTimer = 0;
    drag = { id: event.pointerId, y: event.clientY, start: x, moved: false };
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
  cards.forEach(function (card, index) {
    var drawing = card.querySelector('.scene-drawing');
    drawing.querySelectorAll('.contour,.trajectory,.note-sheet,.vote-link,.trace-span rect').forEach(function (path, i) { path.setAttribute('pathLength', '1'); path.classList.add('scroll-trace'); path.style.setProperty('--trace-order', i); });
    labs[index] = window.SkyLabControls.mount(card, data[index].slug, {
      beforeChange: function () {
        clearRepeat(); sceneRun = null; previewed = true;
        if (!card.classList.contains('is-lab-active')) resetSceneVisuals(card);
        card.classList.remove('is-running', 'is-previewed', 'is-inspecting');
        card.classList.add('is-lab-active', 'is-probed');
        card.querySelector('[data-scene-action]').setAttribute('aria-pressed', 'true');
        card.querySelector('[data-scene-action]').firstChild.textContent = 'Reset ';
      },
      status: function (text) { card.querySelector('[data-scene-status]').textContent = text.replace(/^Illustration:\s*/i, ''); }
    });
    card.querySelector('[data-lab-controls]').addEventListener('focusin', function () { clearRepeat(); sceneRun = null; previewed = true; card.classList.remove('is-running'); });
    function replay() { if (index !== selected) return; if (labs[index].activated()) labs[index].run(); else { sceneRun = null; preview(true); } }
    drawing.addEventListener('click', replay);
    drawing.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault(); replay();
    });
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
      card.classList.remove('is-pointed', 'is-inspecting'); pointer.inside = false; pointer.tx = pointer.ty = .5;
      if (!sceneRun) restoreStatus(card); queue();
    });
    var action = card.querySelector('[data-scene-action]');
    action.addEventListener('click', function () {
      clearRepeat(); previewed = true; card.classList.remove('is-previewed');
      if (labs[index].activated()) {
        sceneRun = null; labs[index].reset();
        card.classList.remove('is-probed', 'is-lab-active', 'is-running', 'is-inspecting');
        card.removeAttribute('data-scene-step'); resetSceneVisuals(card); restoreStatus(card);
        action.setAttribute('aria-pressed', 'false'); action.firstChild.textContent = action.dataset.idleLabel + ' '; syncLabMotion(); return;
      }
      var on = !card.classList.contains('is-probed');
      card.classList.toggle('is-probed', on); action.setAttribute('aria-pressed', String(on));
      action.firstChild.textContent = (on ? action.dataset.activeLabel : action.dataset.idleLabel) + ' ';
      card.classList.toggle('is-running', on && !reduced()); card.classList.remove('is-inspecting');
      if (on && !reduced()) { resetSceneVisuals(card); sceneRun = { elapsed: 0, step: -1 }; playScene(0); queue(); }
      else { sceneRun = null; card.removeAttribute('data-scene-step'); resetSceneVisuals(card); restoreStatus(card); }
    });
  });
  liveButton.addEventListener('click', function () {
    live = !live; liveButton.setAttribute('aria-pressed', String(live));
    liveButton.firstChild.textContent = live ? 'Pause examples ' : 'Play examples ';
    liveButton.lastElementChild.textContent = live ? 'Ⅱ' : '▷';
    clearRepeat(); syncLabMotion();
    if (live) { if (sceneRun) queue(); else scheduleExample(); }
  });
  bench.addEventListener('keydown', function (event) {
    var key = echoKeys.get(event.key);
    if (!key) return;
    clearTimeout(keyTimers.get(key)); key.classList.add('is-pressed');
    keyTimers.set(key, setTimeout(function () { key.classList.remove('is-pressed'); keyTimers.delete(key); }, 180));
  });
  window.addEventListener('resize', layout, { passive: true });
  window.addEventListener('scroll', function () { sceneBounds = sceneTransform = null; syncLabMotion(); if (!drawingOnscreen()) clearRepeat(); if (visible && !document.hidden) { if (reduced()) revealScene(); else queue(); } }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      clearRepeat(); syncLabMotion();
      cancelAnimationFrame(raf); raf = 0; clearTimeout(wheelTimer); clearTimeout(mobileScrollTimer); wheelTimer = mobileScrollTimer = 0;
      target = Math.round(target);
      keyTimers.forEach(function (timer, key) { clearTimeout(timer); key.classList.remove('is-pressed'); }); keyTimers.clear();
      if (drag && orbit.hasPointerCapture(drag.id)) orbit.releasePointerCapture(drag.id);
      drag = null; orbit.classList.remove('is-dragging');
    }
    else { layout(); syncLabMotion(); if (sceneRun) queue(); else scheduleExample(); }
  });
  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    bench.classList.toggle('is-visible', visible);
    syncLabMotion();
    if (!visible) { clearRepeat(); cancelAnimationFrame(raf); raf = 0; }
    else { layout(); if (sceneRun) queue(); else scheduleExample(); }
  }, { rootMargin: '80px' }).observe(bench);
  sceneObserver = new IntersectionObserver(function (entries) {
    sceneVisible = entries[0].isIntersecting;
    bench.classList.toggle('is-drawing-visible', sceneVisible);
    syncLabMotion(); if (!sceneVisible) clearRepeat();
    if (sceneVisible) automaticPreview();
    if (sceneVisible && sceneRun) queue();
  });
  sceneObserver.observe(bench.querySelector('.scene-drawing'));
  new MutationObserver(function () {
    latticeInk = getComputedStyle(bench).getPropertyValue('--bench-ink').trim() || '#d4d0b0'; drawLattice(); drawConnections();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-gear'] });
  mobile.addEventListener('change', layout);
  motion.subscribe(function () {
    clearRepeat();
    if (reduced() && selected >= 0 && labs[selected].activated()) labs[selected].run();
    cancelAnimationFrame(raf); raf = 0;
    if (reduced() && sceneRun) { cards[selected].classList.remove('is-running'); sceneRun = null; resetSceneVisuals(cards[selected]); restoreStatus(cards[selected]); }
    layout();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  bench.classList.add('is-ready');
  select(0, false); layout();
  window.SkyWorkbench = { select: function (index) { move(index, false, true); }, selected: function () { return selected; }, settled: function () { return Math.abs(x - target) < .001 && Math.abs(velocity) < .005 && !wheelTimer && !mobileScrollTimer; }, playing: function () { return !!sceneRun; }, position: function () { return x; } };
})();
