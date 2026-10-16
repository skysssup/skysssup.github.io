/* Project list, evidence, and the portrait. The home page scrolls as a document. */
(function () {
  'use strict';
  var root = document.querySelector('[data-studio]');
  if (!root) return;
  var data = JSON.parse(document.getElementById('studio-data').textContent);
  var layers = {
    portrait: root.querySelector('[data-studio-layer="portrait"]'),
    work: root.querySelector('[data-studio-layer="work"]'),
    contact: root.querySelector('[data-studio-layer="contact"]')
  };
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-studio-pick]'));
  var list = document.getElementById('studio-projects');
  var detail = root.querySelector('[data-studio-detail]');
  var announce = document.querySelector('[data-announce]');
  var figure = document.getElementById('figure');
  var readout = root.querySelector('[data-studio-readout]');
  var marker = root.querySelector('[data-studio-marker]');
  var header = root.querySelector('.studio-header');
  var identity = root.querySelector('.studio-identity');
  var measuredHeader = -1;
  var motion = window.SkyMotion;
  var projectPanels = Array.prototype.slice.call(root.querySelectorAll('.work-card[data-studio-panel]'));
  var labs = projectPanels.map(function (panel) {
    if (!window.SkyProjectLab || typeof window.SkyProjectLab.mount !== 'function') return null;
    return window.SkyProjectLab.mount(panel, { motion: motion });
  });
  var videos = projectPanels.map(function (panel) {
    var video = panel.querySelector('[data-studio-video]');
    return video ? { video: video, visible: false, userPaused: false } : null;
  });
  var labSeen = projectPanels.map(function () { return false; });
  var labRunning = projectPanels.map(function () { return false; });
  var committed = -1;
  var preview = -1;
  var lastPreviewIndex = -2;
  var previewAnim = null;
  var enabled = true;
  var current = 0;
  var stage = 'portrait';
  var anchorFlight = false;
  var anchorKeepTarget = null;
  var flightTarget = null;
  var landedTarget = null;
  var landedY = -1;
  var frame = 0;
  var booting = true;
  var viewer = document.getElementById('studio-viewer');
  var viewerStage = viewer.querySelector('.studio-viewer-stage');
  var returnFocus = null;
  var parked = null;
  var skipViewerFocus = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (motion && motion.setScrollLocked) motion.setScrollLocked(false);

  function reducedMotion() {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
    if (document.documentElement.getAttribute('data-motion') === 'full') return false;
    return !!(motion && motion.reduced && motion.reduced());
  }
  function syncMotionClass() {
    document.body.classList.toggle('is-motion', !reducedMotion());
  }
  function readHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; }
  }
  function projectRow(slug) {
    return rows.findIndex(function (row) { return row.id === slug; });
  }
  function dataIndexForSlug(slug) {
    return data.findIndex(function (item) { return item.slug === slug; });
  }
  function narrowWork() {
    return window.matchMedia('(max-width: 720px)').matches;
  }
  function wideWork() {
    return window.matchMedia('(min-width: 1100px)').matches;
  }
  function pageInView() {
    if (document.hidden) return false;
    var main = document.getElementById('main');
    if (!main) return true;
    var box = main.getBoundingClientRect();
    return box.bottom >= 0 && box.top <= window.innerHeight;
  }
  function scrollPad() {
    var height = header ? header.offsetHeight : 64;
    if (height !== measuredHeader) {
      measuredHeader = height;
      root.style.setProperty('--studio-head', height + 'px');
      document.documentElement.style.scrollPaddingTop = height + 'px';
    }
    return height;
  }

  function onStage(item) {
    var open = viewer.open && parked && parked.node.contains(item.video);
    return open || (stage === 'work' && videos.indexOf(item) === committed && item.visible);
  }
  function bumpMedia(video) {
    video._mediaGuard = (video._mediaGuard || 0) + 1;
  }
  function takeMediaGuard(video) {
    if (!video._mediaGuard) return false;
    video._mediaGuard -= 1;
    return true;
  }
  function drivePause(video) {
    if (video.paused) return;
    bumpMedia(video);
    video.pause();
  }
  function drivePlay(video) {
    if (!video.paused) return;
    bumpMedia(video);
    var promise = video.play();
    if (promise && promise.catch) {
      promise.catch(function () {
        if (video.paused && video._mediaGuard) video._mediaGuard -= 1;
      });
    }
  }
  function syncEvidence() {
    videos.forEach(function (item) {
      if (!item) return;
      var blocked = item.userPaused || !enabled || document.hidden || !onStage(item);
      if (blocked || (reducedMotion() && !item.holdPlay)) {
        drivePause(item.video);
        return;
      }
      if (!reducedMotion()) item.holdPlay = false;
      drivePlay(item.video);
    });
  }
  var videoByEl = new Map();
  videos.forEach(function (item) {
    if (!item) return;
    videoByEl.set(item.video, item);
    item.video.addEventListener('pause', function () {
      if (takeMediaGuard(item.video) || item.video.ended) return;
      item.userPaused = true;
      item.holdPlay = false;
    });
    item.video.addEventListener('play', function () {
      if (takeMediaGuard(item.video)) return;
      item.userPaused = false;
      if (reducedMotion()) item.holdPlay = true;
    });
  });
  if (typeof IntersectionObserver === 'function' && videoByEl.size) {
    var videoWatch = new IntersectionObserver(function (records) {
      records.forEach(function (record) {
        var item = videoByEl.get(record.target);
        if (item) item.visible = record.isIntersecting && record.intersectionRatio >= 0.2;
      });
      syncEvidence();
    }, { threshold: [0, 0.2, 0.5] });
    videoByEl.forEach(function (item) { videoWatch.observe(item.video); });
  }

  function labOpen(i) {
    var details = projectPanels[i] && projectPanels[i].querySelector('details.studio-lab');
    return !!(details && details.open);
  }
  function syncLabs() {
    var allow = enabled && !document.hidden && !reducedMotion();
    labs.forEach(function (lab, i) {
      if (!lab) return;
      var run = allow && stage === 'work' && committed === i && labOpen(i) && labSeen[i];
      if (run && !labRunning[i]) {
        labRunning[i] = true;
        if (lab.activate) lab.activate();
      } else if (!run && labRunning[i]) {
        labRunning[i] = false;
        if (lab.deactivate) lab.deactivate();
      }
      if (lab.enabled) lab.enabled(enabled);
    });
  }
  projectPanels.forEach(function (panel, i) {
    var details = panel.querySelector('details.studio-lab');
    var labEl = panel.querySelector('[data-project-lab]');
    if (details) details.addEventListener('toggle', function () { syncLabs(); schedule(); });
    if (!labEl || typeof IntersectionObserver !== 'function') return;
    new IntersectionObserver(function (records) {
      var record = records[records.length - 1];
      labSeen[i] = !!(record && record.isIntersecting && record.intersectionRatio >= 0.12);
      syncLabs();
    }, { threshold: [0, 0.12, 0.4] }).observe(labEl);
  });

  function targets() {
    var items = [{ id: 'about', node: layers.portrait, kind: 'portrait', index: -1 }];
    if (layers.work) items.push({ id: 'work-list', node: layers.work, kind: 'work', index: -1 });
    projectPanels.forEach(function (panel, i) {
      items.push({ id: panel.id, node: panel, kind: 'project', index: i });
    });
    if (layers.contact) items.push({ id: 'contact', node: layers.contact, kind: 'contact', index: -1 });
    return items;
  }
  function pickTarget() {
    var pad = scrollPad();
    var line = pad + (window.innerHeight - pad) * 0.34;
    var items = targets();
    var chosen = items[0];
    items.forEach(function (item) {
      if (!item.node) return;
      if (item.node.getBoundingClientRect().top <= line + 1) chosen = item;
    });
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (layers.contact && window.scrollY >= maxScroll - 4) {
      var contactBox = layers.contact.getBoundingClientRect();
      if (contactBox.top < window.innerHeight && contactBox.bottom > pad) {
        return { id: 'contact', node: layers.contact, kind: 'contact', index: -1 };
      }
    }
    return chosen;
  }

  function easeStudio(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    var x1 = 0.22, y1 = 0, x2 = 0.2, y2 = 1;
    var ax = 1 - 3 * x2 + 3 * x1;
    var bx = 3 * x2 - 6 * x1;
    var cx = 3 * x1;
    var guess = t;
    var i;
    for (i = 0; i < 6; i++) {
      var x = ((ax * guess + bx) * guess + cx) * guess;
      var dx = (3 * ax * guess + 2 * bx) * guess + cx;
      if (Math.abs(dx) < 1e-5) break;
      guess = Math.min(1, Math.max(0, guess - (x - t) / dx));
    }
    var ay = 1 - 3 * y2 + 3 * y1;
    var by = 3 * y2 - 6 * y1;
    var cy = 3 * y1;
    return ((ay * guess + by) * guess + cy) * guess;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function applyFigure() {
    if (!figure) return;
    if (parked && parked.node === figure) return;
    if (!pageInView()) return;
    var pad = scrollPad();
    var line = pad + (window.innerHeight - pad) * 0.34;
    var vh = window.innerHeight;
    var workTop = layers.work ? layers.work.getBoundingClientRect().top : vh;
    var contactTop = layers.contact ? layers.contact.getBoundingClientRect().top : vh * 2;
    var workStart = workTop + window.scrollY;
    var workT = reducedMotion() ? 0 : easeStudio(Math.min(1, Math.max(0, window.scrollY / Math.max(1, workStart - line))));
    var contactT = reducedMotion() ? 0 : easeStudio(Math.min(1, Math.max(0, 1 - (contactTop - line) / (vh * 0.55))));
    var band = narrowWork() ? 'narrow' : wideWork() ? 'wide' : 'mid';
    var workScale = band === 'wide' ? 0.6 : band === 'mid' ? 0.48 : 0.42;
    var workOpacity = band === 'wide' ? 0.85 : band === 'mid' ? 0.72 : 0.32;
    var contactScale = band === 'wide' ? 0.52 : band === 'mid' ? 0.42 : 0.28;
    var contactOpacity = band === 'wide' ? 0.62 : band === 'mid' ? 0.5 : 0.28;
    var opacity = lerp(lerp(1, workOpacity, workT), contactOpacity, contactT);
    var scale = lerp(lerp(1, workScale, workT), contactScale, contactT);
    var width = figure.offsetWidth || 320;
    var portraitY = Math.max(20, ((identity ? identity.offsetTop : vh * 0.7) - width) * 0.5);
    var shift = Math.max(workT, contactT);
    var x = 0;
    var y = portraitY;
    if (band === 'narrow') {
      y = lerp(lerp(portraitY, 8, workT), 4, contactT);
      x = lerp(0, Math.max(0, document.documentElement.clientWidth * 0.5 - width * scale * 0.5 - 16), shift);
    } else {
      var wrap = root.querySelector('.studio-list-wrap');
      var slot = figure.parentElement;
      if (wrap && list && slot) {
        var wrapBox = wrap.getBoundingClientRect();
        var listBox = list.getBoundingClientRect();
        var slotBox = slot.getBoundingClientRect();
        var hostH = figure.offsetHeight || width;
        var hostCenter = slotBox.left + slotBox.width / 2;
        var railCenter = wrapBox.left + wrapBox.width / 2;
        var reserve = listBox.top - wrapBox.top;
        if (!(reserve > 48)) reserve = band === 'wide' ? 230 : 150;
        var bandMid = listBox.top - reserve / 2;
        var yInRail = bandMid - hostH * scale * 0.5 - slotBox.top;
        x = lerp(0, railCenter - hostCenter, shift);
        y = lerp(portraitY, yInRail, shift);
      }
    }
    figure.style.opacity = String(Math.round(opacity * 1000) / 1000);
    figure.style.setProperty('--studio-figure-scale', scale.toFixed(3));
    figure.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
  }

  function applyFocus() {
    if (!pageInView()) return;
    var pad = scrollPad();
    var vh = window.innerHeight;
    var line = pad + (vh - pad) * 0.34;
    var span = vh * 0.45;
    var reduced = reducedMotion();
    projectPanels.forEach(function (panel, i) {
      var rect = panel.getBoundingClientRect();
      var dist = rect.top - line;
      var near = rect.bottom > -span && rect.top < vh + span;
      if (!near) return;
      var focus;
      var travel;
      if (reduced) {
        focus = panel.classList.contains('is-shown') ? 1 : 0.55;
        travel = 0;
      } else {
        var reach = (i === committed && stage === 'work') ? span * 1.35 : span;
        focus = easeStudio(Math.min(1, Math.max(0, 1 - Math.abs(dist) / reach)));
        if (i === committed && stage === 'work') focus = Math.min(1, Math.max(focus, 0.82));
        travel = (1 - focus) * 12;
      }
      panel.style.setProperty('--studio-focus', focus.toFixed(3));
      panel.style.setProperty('--studio-travel', travel.toFixed(1) + 'px');
    });
  }

  function applyWorkProgress() {
    if (!pageInView()) return;
    var host = root.querySelector('[data-studio-progress]');
    if (!host || !projectPanels.length) return;
    var pad = scrollPad();
    var line = pad + (window.innerHeight - pad) * 0.34;
    var startNode = layers.work || projectPanels[0];
    var start = startNode.getBoundingClientRect().top + window.scrollY;
    var end = projectPanels[projectPanels.length - 1].getBoundingClientRect().bottom + window.scrollY;
    var t = (window.scrollY + line - start) / Math.max(1, end - start);
    if (stage === 'portrait') t = 0;
    else if (stage === 'contact') t = 1;
    t = Math.min(1, Math.max(0, t));
    host.style.transformOrigin = 'top center';
    host.style.transform = 'scaleY(' + t.toFixed(3) + ')';
  }

  function moveMarker() {
    if (!marker) return;
    var row = committed >= 0 ? rows[committed] : null;
    if (!row || stage !== 'work') {
      marker.style.opacity = '0';
      return;
    }
    var wrap = marker.offsetParent;
    if (!wrap || !wrap.classList.contains('studio-index')) wrap = root.querySelector('.studio-index');
    if (!wrap) return;
    var wrapBox = wrap.getBoundingClientRect();
    var rect = row.getBoundingClientRect();
    marker.style.opacity = '1';
    if (narrowWork()) {
      marker.style.width = Math.round(rect.width) + 'px';
      marker.style.height = '2px';
      marker.style.transform = 'translate(' + Math.round(rect.left - wrapBox.left) + 'px,' + Math.round(rect.bottom - wrapBox.top - 2) + 'px)';
    } else {
      marker.style.width = '2px';
      marker.style.height = Math.round(rect.height) + 'px';
      marker.style.transform = 'translateY(' + Math.round(rect.top - wrapBox.top) + 'px)';
    }
  }
  function syncReadout() {
    if (!readout) return;
    if (stage === 'portrait') readout.textContent = 'portrait';
    else if (stage === 'contact') readout.textContent = 'contact';
    else readout.textContent = committed >= 0 ? rows[committed].id : 'work';
  }
  function placeNav() {
    var section = stage === 'contact' ? 'contact' : stage === 'work' ? 'work-list' : 'about';
    var brand = root.querySelector('.studio-brand');
    if (brand) brand.classList.toggle('is-section', section === 'about');
    var nav = root.querySelector('.studio-header-links');
    var navLinks = nav ? nav.querySelectorAll('a[href^="#"]') : [];
    var active = null;
    Array.prototype.forEach.call(navLinks, function (link) {
      var on = link.getAttribute('href') === '#' + section;
      link.classList.toggle('is-section', on);
      if (on) active = link;
    });
    if (!nav || !navMark) return;
    if (!active) {
      navMark.style.opacity = '0';
      return;
    }
    var box = nav.getBoundingClientRect();
    var rect = active.getBoundingClientRect();
    navMark.style.opacity = '1';
    navMark.style.width = Math.round(rect.width) + 'px';
    navMark.style.transform = 'translateX(' + Math.round(rect.left - box.left) + 'px)';
  }

  function applySelection(target, meta) {
    meta = meta || {};
    var nextStage = target.kind === 'project' || target.kind === 'work' ? 'work' : target.kind === 'contact' ? 'contact' : 'portrait';
    var nextRow = target.kind === 'project' ? target.index : target.kind === 'work' ? 0 : -1;
    var slug = nextStage === 'contact' ? 'contact' : nextStage === 'portrait' ? 'about' : rows[Math.max(0, nextRow)].id;
    var nextCurrent = dataIndexForSlug(slug);
    if (nextCurrent < 0) nextCurrent = 0;
    var changed = nextStage !== stage || nextRow !== committed || nextCurrent !== current;
    stage = nextStage;
    committed = nextRow;
    if (preview === committed) preview = -1;
    current = nextCurrent;
    syncPreviewChrome();
    root.dataset.stage = stage;
    root.dataset.workMode = 'list';
    if (figure) figure.setAttribute('aria-hidden', stage === 'portrait' ? 'false' : 'true');
    rows.forEach(function (row, i) {
      var on = i === committed;
      row.classList.toggle('is-selected', on);
      if (on) row.classList.remove('is-preview');
      row.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (committed >= 0) list.setAttribute('aria-activedescendant', rows[committed].id);
    else list.removeAttribute('aria-activedescendant');
    projectPanels.forEach(function (panel, i) {
      var on = i === committed;
      panel.classList.toggle('is-shown', on);
      panel.classList.toggle('is-selected', on);
    });
    if (changed) {
      document.dispatchEvent(new CustomEvent('sky:workselect', { detail: { index: Math.max(0, committed) } }));
    }
    if (meta.announce && announce && data[current]) announce.textContent = data[current].name + ' selected';
    placeNav();
    moveMarker();
    syncReadout();
    syncLabs();
    syncEvidence();
    return changed;
  }

  function hashFor(target) {
    if (!target) return 'about';
    if (target.kind === 'portrait') return 'about';
    if (target.kind === 'work') return 'work-list';
    return target.id;
  }
  function syncFromScroll() {
    // An explicit anchor can be clamped at the document end. Keep its intended
    // selection until scrolling resumes, rather than immediately picking Contact.
    var target = landedTarget && Math.abs(window.scrollY - landedY) < 2 ? landedTarget : pickTarget();
    if (target !== landedTarget) landedTarget = null;
    if (!target) return;
    applySelection(target, { announce: false });
    if (booting && !location.hash) return;
    var id = hashFor(target);
    if (anchorKeepTarget === id) return;
    anchorKeepTarget = null;
    var next = '#' + id;
    if (location.hash === next) return;
    if (!location.hash && window.scrollY < 8 && id === 'about') return;
    history.replaceState({ studio: id }, '', next);
  }

  function endFlight() {
    anchorFlight = false;
    landedTarget = flightTarget && flightTarget.kind !== 'work' ? flightTarget : null;
    landedY = window.scrollY;
    anchorKeepTarget = hashFor(landedTarget || pickTarget());
    syncFromScroll();
    applyFigure();
  }
  function armFlight() {
    anchorFlight = true;
    anchorKeepTarget = null;
    landedTarget = null;
  }
  function nodeForHash(id) {
    if (!id || id === 'about' || id === 'hero') return document.getElementById('about') || layers.portrait;
    return document.getElementById(id);
  }
  function goTo(id, historyMode) {
    if (projectRow(id) >= 0) {
      id = 'project-' + id;
      if (historyMode !== 'push') history.replaceState({ studio: id }, '', '#' + id);
    }
    var node = nodeForHash(id);
    if (!node) return;
    var url = '#' + (id === 'hero' ? 'about' : id);
    if (historyMode === 'push' && location.hash !== url) history.pushState({ studio: url.slice(1) }, '', url);
    else if (historyMode === 'replace' && location.hash !== url) history.replaceState({ studio: url.slice(1) }, '', url);
    armFlight();
    var pad = scrollPad();
    var top = node.getBoundingClientRect().top + window.scrollY - pad;
    if (id === 'about' || id === 'hero') top = 0;
    else if (narrowWork() && id.indexOf('project-') === 0) {
      var projectNav = root.querySelector('.studio-list-wrap');
      if (projectNav) top -= projectNav.offsetHeight + 8;
    }
    var target = targets().filter(function (item) { return hashFor(item) === url.slice(1); })[0];
    if (!target && url.slice(1).indexOf('project-') === 0) {
      var index = projectRow(url.slice(1).replace(/^project-/, ''));
      if (index >= 0) target = { id: projectPanels[index].id, node: projectPanels[index], kind: 'project', index: index };
    }
    flightTarget = target || null;
    if (target) applySelection(target, { announce: historyMode === 'push' });
    if (motion && motion.scrollTo) motion.scrollTo(Math.max(0, top), { easing: easeStudio, immediate: booting || reducedMotion(), onComplete: endFlight });
    else {
      window.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
      endFlight();
    }
  }

  function previewFields(host) {
    var title = host.querySelector('[data-studio-preview-title]');
    var summary = host.querySelector('[data-studio-preview-summary]');
    if (title && summary) return { title: title, summary: summary };
    title = document.createElement('p');
    title.setAttribute('data-studio-preview-title', '');
    summary = document.createElement('p');
    summary.setAttribute('data-studio-preview-summary', '');
    host.appendChild(title);
    host.appendChild(summary);
    return { title: title, summary: summary };
  }
  function stopPreviewAnim() {
    if (!previewAnim) return;
    var anim = previewAnim;
    previewAnim = null;
    try { anim.cancel(); } catch (e) {}
  }
  function syncPreviewChrome() {
    var index = preview >= 0 && preview !== committed ? preview : -1;
    preview = index;
    if (index === lastPreviewIndex) return;
    lastPreviewIndex = index;
    rows.forEach(function (row, n) { row.classList.toggle('is-preview', n === index); });
    projectPanels.forEach(function (panel, n) { panel.classList.toggle('is-preview', n === index); });
    var host = root.querySelector('[data-studio-preview]');
    if (!host) return;
    host.setAttribute('aria-hidden', 'true');
    stopPreviewAnim();
    if (index < 0) {
      host.hidden = true;
      var title = host.querySelector('[data-studio-preview-title]');
      var summary = host.querySelector('[data-studio-preview-summary]');
      if (title) title.textContent = '';
      if (summary) summary.textContent = '';
      return;
    }
    var panel = projectPanels[index];
    var name = panel && panel.querySelector('.work-card-name');
    var desc = panel && panel.querySelector('.work-card-desc');
    var fields = previewFields(host);
    fields.title.textContent = name ? name.textContent : '';
    fields.summary.textContent = desc ? desc.textContent : '';
    host.hidden = false;
    if (!reducedMotion() && typeof host.animate === 'function') {
      previewAnim = host.animate(
        [{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 180, easing: 'cubic-bezier(0.22, 0, 0.2, 1)', fill: 'both' }
      );
      previewAnim.onfinish = function () { stopPreviewAnim(); };
    }
  }
  function setPreview(index) {
    if (index === committed) index = -1;
    preview = index;
    syncPreviewChrome();
  }
  rows.forEach(function (row, i) {
    row.addEventListener('pointerenter', function () { setPreview(i); });
    row.addEventListener('pointerleave', function () { if (preview === i) setPreview(-1); });
    row.addEventListener('focusin', function () { setPreview(i); });
    row.addEventListener('focusout', function (event) {
      var next = event.relatedTarget;
      if (next && next.closest && next.closest('[data-studio-pick]')) return;
      if (preview === i) setPreview(-1);
    });
    row.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      setPreview(-1);
      goTo(row.getAttribute('href').slice(1), 'push');
    });
  });
  if (list) {
    list.addEventListener('keydown', function (event) {
      var focused = rows.indexOf(event.target.closest ? event.target.closest('[data-studio-pick]') : event.target);
      if (focused < 0) focused = Math.max(0, committed);
      var next = null;
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = Math.min(rows.length - 1, focused + 1);
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = Math.max(0, focused - 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = rows.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goTo('project-' + rows[focused].id, 'push');
        rows[focused].focus({ preventScroll: true });
        return;
      } else return;
      event.preventDefault();
      rows[next].focus({ preventScroll: true });
      goTo('project-' + rows[next].id, 'push');
    });
    list.addEventListener('scroll', function () { schedule(); }, { passive: true });
  }

  root.querySelectorAll('a[href^="#"]').forEach(function (link) {
    if (link.hasAttribute('data-studio-pick')) return;
    link.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      var id = (link.getAttribute('href') || '').slice(1);
      if (!id || !nodeForHash(id)) return;
      event.preventDefault();
      goTo(id, 'push');
      if (link.classList.contains('skip')) {
        var destination = nodeForHash(id);
        if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
        destination.focus({ preventScroll: true });
      }
    });
  });
  window.addEventListener('popstate', function () {
    if (viewer.open) closeViewer(true);
    var id = readHash() || 'about';
    goTo(id, false);
  });
  window.addEventListener('hashchange', function () {
    if (anchorFlight) return;
    if (viewer.open) closeViewer(true);
    var id = readHash();
    if (!id) return;
    goTo(id, false);
  });

  var live = root.querySelector('[data-bench-live]');
  live.addEventListener('click', function () {
    enabled = !enabled;
    live.setAttribute('aria-pressed', String(enabled));
    root.querySelector('[data-studio-live-label]').textContent = enabled ? 'on' : 'off';
    labs.forEach(function (lab) { if (lab && lab.enabled) lab.enabled(enabled); });
    syncLabs();
    syncEvidence();
  });
  if (motion && motion.subscribe) motion.subscribe(function () {
    syncMotionClass();
    labs.forEach(function (lab) { if (lab && lab.motionChanged) lab.motionChanged(); });
    syncLabs();
    syncEvidence();
    schedule();
  });
  document.addEventListener('visibilitychange', function () {
    syncLabs();
    syncEvidence();
    if (!document.hidden) schedule();
  });

  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      if (document.hidden) return;
      if (!anchorFlight) syncFromScroll();
      applyFigure();
      applyFocus();
      applyWorkProgress();
      placeGear(null);
      if (anchorFlight) {
        moveMarker();
        placeNav();
      }
    });
  }
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', function () {
    if (anchorFlight || landedTarget) {
      var id = readHash();
      if (id && nodeForHash(id)) goTo(id, false);
    }
    schedule();
  });
  window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && preview >= 0 && !(viewer && viewer.open)) {
      setPreview(-1);
      return;
    }
    if (event.defaultPrevented || !/^(PageDown|PageUp|Home|End|ArrowDown|ArrowUp| )$/.test(event.key)) return;
    if (event.target.closest && event.target.closest('input, textarea, select, button, [contenteditable]')) return;
    landedTarget = null;
    schedule();
  });
  window.addEventListener('wheel', function () {
    landedTarget = null;
    schedule();
    if (!anchorFlight) return;
    anchorFlight = false;
  }, { passive: true });
  window.addEventListener('touchmove', function () {
    landedTarget = null;
    schedule();
    if (!anchorFlight) return;
    anchorFlight = false;
  }, { passive: true });

  function finishViewerClose() {
    if (parked) {
      if (parked.parent && parked.parent.isConnected && parked.node.parentNode !== parked.parent) {
        var next = parked.next && parked.next.parentNode === parked.parent ? parked.next : null;
        parked.parent.insertBefore(parked.node, next);
      }
      if (parked.placeholder) parked.placeholder.remove();
      parked = null;
    }
    if (viewerStage) viewerStage.replaceChildren();
    syncEvidence();
    applyFigure();
    var focus = returnFocus;
    returnFocus = null;
    var silent = skipViewerFocus;
    skipViewerFocus = false;
    if (silent || !focus || !focus.isConnected) return;
    var box = focus.getBoundingClientRect();
    if (box.width < 1 && box.height < 1) return;
    focus.focus({ preventScroll: true });
  }
  function closeViewer(silent) {
    skipViewerFocus = !!silent;
    if (viewer.open) viewer.close();
    else finishViewerClose();
  }
  viewer.addEventListener('close', finishViewerClose);
  viewer.querySelector('[data-studio-viewer-close]').addEventListener('click', function () { closeViewer(false); });
  viewer.addEventListener('click', function (event) { if (event.target === viewer) closeViewer(false); });
  root.querySelectorAll('[data-studio-zoom],[data-studio-evidence-zoom]').forEach(function (opener) {
    opener.addEventListener('click', function () {
      if (viewer.open) return;
      returnFocus = opener;
      var about = opener.dataset.studioZoom === 'about';
      var node = about ? document.getElementById('figure') : opener.closest('[data-studio-evidence]');
      if (!node || (parked && parked.node === node)) return;
      document.getElementById('studio-viewer-title').textContent = about ? 'Hermes' : (opener.getAttribute('aria-label') || 'Evidence');
      var host = node.closest('[data-studio-panel]');
      parked = {
        node: node,
        parent: node.parentNode,
        next: node.nextSibling,
        panelIndex: host ? projectPanels.indexOf(host) : -1
      };
      if (!about) {
        // The evidence keeps its place in the scrolling document while the same
        // media node is enlarged, so opening and returning never move the page.
        var placeholder = document.createElement('div');
        placeholder.setAttribute('aria-hidden', 'true');
        placeholder.style.height = node.getBoundingClientRect().height + 'px';
        placeholder.style.margin = window.getComputedStyle(node).margin;
        parked.parent.insertBefore(placeholder, node);
        parked.placeholder = placeholder;
      }
      if (node === figure) {
        figure.style.opacity = '';
        figure.style.transform = '';
        figure.style.setProperty('--studio-figure-scale', '1');
      }
      viewerStage.appendChild(node);
      viewer.showModal();
      syncEvidence();
    });
  });

  var gearBox = root.querySelector('.studio-avatar-controls');
  var gearMark = null;
  function placeGear(pressedButton) {
    if (!gearBox || !gearMark) return;
    var button = pressedButton;
    if (!button || button.getAttribute('aria-pressed') !== 'true') {
      button = gearBox.querySelector('button[aria-pressed="true"]') || gearBox.querySelector('button');
    }
    if (!button) return;
    var box = gearBox.getBoundingClientRect();
    var rect = button.getBoundingClientRect();
    gearMark.style.width = Math.round(rect.width) + 'px';
    gearMark.style.height = Math.round(rect.height) + 'px';
    gearMark.style.transform = 'translate(' + Math.round(rect.left - box.left) + 'px,' + Math.round(rect.top - box.top) + 'px)';
  }
  if (gearBox) {
    gearMark = document.createElement('span');
    gearMark.className = 'studio-gear-mark';
    gearMark.setAttribute('aria-hidden', 'true');
    gearBox.insertBefore(gearMark, gearBox.firstChild);
    gearBox.addEventListener('pointerdown', function (event) {
      var button = event.target.closest('button');
      if (!button || !gearBox.contains(button)) return;
      gearMark.classList.add('is-immediate');
      var box = gearBox.getBoundingClientRect();
      var rect = button.getBoundingClientRect();
      gearMark.style.width = Math.round(rect.width) + 'px';
      gearMark.style.height = Math.round(rect.height) + 'px';
      gearMark.style.transform = 'translate(' + Math.round(rect.left - box.left) + 'px,' + Math.round(rect.top - box.top) + 'px)';
    });
    gearBox.addEventListener('pointerup', function () {
      gearMark.classList.remove('is-immediate');
      placeGear(null);
    });
    gearBox.addEventListener('pointercancel', function () {
      gearMark.classList.remove('is-immediate');
      placeGear(null);
    });
    if (typeof MutationObserver === 'function') {
      new MutationObserver(function () { placeGear(null); }).observe(gearBox, {
        subtree: true,
        attributes: true,
        attributeFilter: ['aria-pressed']
      });
    }
  }

  var nav = root.querySelector('.studio-header-links');
  var navMark = null;
  if (nav) {
    navMark = document.createElement('span');
    navMark.className = 'studio-nav-mark';
    navMark.setAttribute('aria-hidden', 'true');
    nav.appendChild(navMark);
  }

  syncMotionClass();
  scrollPad();
  applyFigure();
  applyFocus();
  applyWorkProgress();
  syncPreviewChrome();
  var initial = readHash();
  if (initial) goTo(initial, false);
  else syncFromScroll();
  placeGear(null);
  placeNav();
  booting = false;
  root.classList.add('is-ready');

  function apiSelect(index) {
    if (index <= 0) { goTo('about', 'push'); return; }
    if (index >= data.length - 1) { goTo('contact', 'push'); return; }
    goTo('project-' + data[index].slug, 'push');
  }
  window.SkyStudio = {
    select: apiSelect,
    selectSlug: function (slug) {
      var i = data.findIndex(function (item) { return item.slug === slug; });
      if (i >= 0) apiSelect(i);
    },
    selected: function () { return current; },
    settled: function () { return !anchorFlight; },
    position: function () { return current; },
    slug: function () { return data[current] ? data[current].slug : 'about'; },
    playing: function () {
      var slug = data[current] && data[current].slug;
      var index = projectRow(slug);
      var lab = index >= 0 ? labs[index] : null;
      if (!lab || !lab.snapshot) return false;
      if (!enabled || document.hidden || reducedMotion()) return false;
      if (!labRunning[index] || !labOpen(index) || !labSeen[index]) return false;
      var snap = lab.snapshot();
      return !!(snap && snap.playing);
    },
    snapshot: function () {
      var slug = data[current] && data[current].slug;
      var index = projectRow(slug);
      var lab = index >= 0 ? labs[index] : null;
      return { selected: current, slug: slug || '', stage: stage, scene: lab && lab.snapshot ? lab.snapshot() : null };
    },
    wheel: null
  };
})();
