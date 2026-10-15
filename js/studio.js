/* Project list, evidence, and the portrait viewer. The home page stays in one viewport; the hash is the stage. */
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
  var work = document.getElementById('work-list');
  var marker = root.querySelector('[data-studio-marker]');
  var announce = document.querySelector('[data-announce]');
  var figure = document.getElementById('figure');
  var listBack = root.querySelector('[data-studio-list-back]');
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
  var committed = 0;
  var shown = -1;
  var preview = -1;
  var enabled = true;
  var dwell = 0;
  var current = 1;
  var booting = true;
  var stage = 'portrait';
  var viewer = document.getElementById('studio-viewer');
  var viewerStage = viewer.querySelector('.studio-viewer-stage');
  var returnFocus = null;
  var parked = null;
  var skipViewerFocus = false;
  var leaveTimers = {};

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (motion && motion.setScrollLocked) motion.setScrollLocked(true);

  function reducedMotion() {
    if (document.documentElement.getAttribute('data-motion') === 'reduced') return true;
    if (document.documentElement.getAttribute('data-motion') === 'full') return false;
    return !!(motion && motion.reduced && motion.reduced());
  }
  function syncMotionClass() {
    document.body.classList.toggle('is-motion', !reducedMotion());
  }
  function projectIndexFromSlug(slug) {
    return data.findIndex(function (item) { return item.kind === 'project' && item.slug === slug; });
  }
  function dataIndexForProject(i) { return projectIndexFromSlug(rows[i].id); }
  function shownPanel() { return shown >= 0 ? projectPanels[shown] : null; }
  function readHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; }
  }
  function routeIndex() {
    var raw = readHash();
    if (raw === 'contact') return data.length - 1;
    if (!raw || raw === 'hero' || raw === 'about') return 0;
    var slug = raw.indexOf('project-') === 0 ? raw.slice(8) : raw;
    if (slug === 'work-list' || slug === 'studio-projects') return dataIndexForProject(committed);
    var exact = data.findIndex(function (item) { return item.slug === slug && item.kind !== 'profile'; });
    if (exact >= 0) return exact;
    return dataIndexForProject(committed);
  }
  function rowIndexFrom(node) {
    var row = node && node.closest ? node.closest('[data-studio-pick]') : null;
    if (!row) return -1;
    return rows.indexOf(row);
  }
  function narrowWork() {
    return window.matchMedia('(max-width: 720px)').matches;
  }

  function onStage(item, i) {
    var panel = projectPanels[i];
    var open = viewer.open && parked && parked.node.contains(item.video);
    return open || (stage === 'work' && panel === shownPanel() && item.visible);
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
    videos.forEach(function (item, i) {
      if (!item) return;
      var blocked = item.userPaused || !enabled || document.hidden || stage !== 'work' || !onStage(item, i);
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
        if (item) item.visible = record.isIntersecting;
      });
      syncEvidence();
    }, { threshold: 0.2, root: detail || null });
    videoByEl.forEach(function (item) { videoWatch.observe(item.video); });
  }

  function labOpen(i) {
    var details = projectPanels[i] && projectPanels[i].querySelector('details.studio-lab');
    return !!(details && details.open);
  }
  function syncLabs() {
    var allow = enabled && !document.hidden && !reducedMotion() && stage === 'work';
    labs.forEach(function (lab, i) {
      if (!lab) return;
      var run = allow && i === shown && labOpen(i) && labSeen[i];
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
    if (details) details.addEventListener('toggle', syncLabs);
    if (!labEl || typeof IntersectionObserver !== 'function') return;
    new IntersectionObserver(function (records) {
      labSeen[i] = records[records.length - 1].isIntersecting;
      syncLabs();
    }, { threshold: 0.12, root: detail || null }).observe(labEl);
  });

  function clearLeaving(panel) {
    if (panel._onLeave) {
      panel.removeEventListener('transitionend', panel._onLeave);
      panel._onLeave = null;
    }
    if (!panel.classList.contains('is-shown')) panel.classList.remove('is-leaving');
  }
  function beginLeave(panel) {
    if (panel.classList.contains('is-leaving') && panel._onLeave) return;
    panel.classList.add('is-leaving');
    var onLeave = function (event) {
      if (event && (event.target !== panel || event.propertyName !== 'opacity')) return;
      if (panel._onLeave !== onLeave) return;
      panel.removeEventListener('transitionend', onLeave);
      panel._onLeave = null;
      if (!panel.classList.contains('is-shown')) panel.classList.remove('is-leaving');
    };
    panel._onLeave = onLeave;
    panel.addEventListener('transitionend', onLeave);
    window.setTimeout(function () {
      if (panel._onLeave === onLeave) onLeave(null);
    }, 700);
  }
  function paint(index, opts) {
    if (index < 0) return;
    opts = opts || {};
    var previewing = !!opts.previewing;
    if (detail) detail.classList.toggle('is-previewing', previewing && !reducedMotion());
    if (index !== shown) {
      detail.dataset.dir = shown < 0 || index > shown ? 'down' : 'up';
      projectPanels.forEach(function (panel, i) {
        var on = i === index;
        var was = panel.classList.contains('is-shown');
        if (on) clearLeaving(panel);
        else if (was && !reducedMotion()) beginLeave(panel);
        else clearLeaving(panel);
        panel.classList.toggle('is-shown', on);
      });
      shown = index;
    }
    projectPanels.forEach(function (panel, i) {
      var on = i === shown;
      panel.inert = !on;
      panel.setAttribute('aria-hidden', on ? 'false' : 'true');
      if (on) panel.classList.remove('is-leaving');
    });
    syncLabs();
    syncEvidence();
    moveMarker();
  }

  function markerTop(row, wrap) {
    if (row.offsetParent === wrap) return row.offsetTop;
    var top = 0;
    var node = row;
    while (node && node !== wrap) {
      top += node.offsetTop;
      node = node.offsetParent;
    }
    return node === wrap ? top : row.offsetTop;
  }
  function moveMarker() {
    if (!marker) return;
    var index = shown >= 0 ? shown : committed;
    var row = rows[index];
    if (!row) return;
    var wrap = marker.parentElement;
    if (!wrap) return;
    marker.style.transform = 'translateY(' + Math.round(markerTop(row, wrap)) + 'px)';
    marker.style.height = row.offsetHeight + 'px';
  }

  function setWorkMode(mode) {
    root.dataset.workMode = mode === 'detail' ? 'detail' : 'list';
  }
  function clearLayerLeave(name) {
    var layer = layers[name];
    if (!layer) return;
    if (leaveTimers[name]) {
      window.clearTimeout(leaveTimers[name]);
      leaveTimers[name] = 0;
    }
    layer.classList.remove('is-leaving');
  }
  function setStage(next, meta) {
    meta = meta || {};
    if (next !== 'portrait' && next !== 'work' && next !== 'contact') next = 'portrait';
    var prev = stage;
    stage = next;
    root.dataset.stage = next;
    Object.keys(layers).forEach(function (name) {
      var layer = layers[name];
      if (!layer) return;
      var on = name === next;
      if (on) {
        clearLayerLeave(name);
        layer.classList.add('is-active');
        layer.inert = false;
        layer.removeAttribute('aria-hidden');
      } else if (layer.classList.contains('is-active')) {
        layer.classList.remove('is-active');
        layer.inert = true;
        layer.setAttribute('aria-hidden', 'true');
        if (!reducedMotion() && prev === name) {
          layer.classList.add('is-leaving');
          leaveTimers[name] = window.setTimeout(function () {
            layer.classList.remove('is-leaving');
            leaveTimers[name] = 0;
          }, 400);
        } else {
          clearLayerLeave(name);
        }
      } else {
        layer.inert = true;
        layer.setAttribute('aria-hidden', 'true');
      }
    });
    if (figure) figure.setAttribute('aria-hidden', next === 'portrait' ? 'false' : 'true');
    if (next !== 'work') setWorkMode('list');
    else if (narrowWork() && meta.workMode) setWorkMode(meta.workMode);
    else if (!narrowWork()) setWorkMode('list');
    syncLabs();
    syncEvidence();
    placeNav();
    if (next === 'work') window.requestAnimationFrame(moveMarker);
  }

  function writeHash(mode, id) {
    var url = id.indexOf('#') === 0 ? id : '#' + id;
    if (location.hash === url) return;
    if (mode === 'push') history.pushState({ studio: id }, '', url);
    else history.replaceState({ studio: id }, '', url);
    noteHash();
  }
  function closeViewer(silent) {
    skipViewerFocus = !!silent;
    if (viewer.open) viewer.close();
    else finishViewerClose();
  }
  function commit(index, meta) {
    if (index < 0 || index >= rows.length) return;
    meta = meta || {};
    if (parked && parked.panelIndex !== index) closeViewer(true);
    var prev = committed;
    committed = index;
    current = dataIndexForProject(index);
    preview = -1;
    rows.forEach(function (row, i) {
      var on = i === index;
      row.classList.toggle('is-selected', on);
      row.classList.remove('is-preview');
      row.setAttribute('aria-selected', on ? 'true' : 'false');
      row.tabIndex = on ? 0 : -1;
    });
    list.setAttribute('aria-activedescendant', rows[index].id);
    root.dataset.selected = rows[index].id;
    if (!meta.holdStage) {
      if (stage !== 'work') setStage('work', { workMode: narrowWork() ? (meta.focusDetail ? 'detail' : 'list') : 'list' });
      else if (narrowWork() && meta.focusDetail) setWorkMode('detail');
    }
    paint(index, { previewing: false });
    if (meta.focus) {
      if (meta.focusDetail && narrowWork()) {
        var article = projectPanels[index];
        var focusArticle = function () {
          if (article && article.isConnected) article.focus({ preventScroll: true });
        };
        focusArticle();
        window.requestAnimationFrame(focusArticle);
      } else rows[index].focus({ preventScroll: true });
    }
    if (meta.history) writeHash(meta.history, 'project-' + rows[index].id);
    if (meta.announce && announce && data[current]) announce.textContent = data[current].name + ' selected';
    if (prev !== index) document.dispatchEvent(new CustomEvent('sky:workselect', { detail: { index: index } }));
    placeNav();
  }

  function setPreview(index) {
    if (index === committed) index = -1;
    if (index === preview) return;
    preview = index;
    rows.forEach(function (row, n) { row.classList.toggle('is-preview', n === index); });
    paint(index < 0 ? committed : index, { previewing: index >= 0 });
  }

  function openCaseStudy(index) {
    var row = rows[index];
    if (!row) return;
    var panel = projectPanels[index];
    var link = panel && panel.querySelector('.scene-links a[href^="/work/"]');
    if (link) {
      location.href = link.getAttribute('href');
      return;
    }
    location.href = '/work/' + row.id + '/';
  }

  rows.forEach(function (row, i) {
    row.addEventListener('pointerenter', function () {
      if (stage !== 'work') return;
      clearTimeout(dwell);
      dwell = setTimeout(function () { setPreview(i); }, 40);
    });
    row.addEventListener('pointerleave', function (event) {
      var to = event.relatedTarget;
      if (to && detail && (detail === to || detail.contains(to))) {
        clearTimeout(dwell);
        setPreview(i);
      }
    });
    row.addEventListener('focus', function () {
      if (stage === 'work') setPreview(i);
    });
    row.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (narrowWork()) commit(i, { history: 'push', announce: true, focusDetail: true });
      else commit(i, { history: 'push', announce: true });
    });
  });

  function pinPreviewForDetail() {
    if (preview >= 0 && preview !== committed) commit(preview, { history: 'replace', announce: false });
  }
  if (detail) {
    detail.addEventListener('pointerdown', pinPreviewForDetail, true);
    detail.addEventListener('focusin', pinPreviewForDetail);
  }
  if (work) {
    work.addEventListener('pointerleave', function (event) {
      var to = event.relatedTarget;
      if (to && work.contains(to)) return;
      clearTimeout(dwell);
      setPreview(-1);
    });
    work.addEventListener('focusout', function (event) {
      var to = event.relatedTarget;
      if (to && work.contains(to)) return;
      setPreview(-1);
    });
  }
  if (listBack) {
    listBack.addEventListener('click', function () {
      setWorkMode('list');
      if (rows[committed]) rows[committed].focus({ preventScroll: true });
    });
  }

  list.addEventListener('keydown', function (event) {
    var focused = rowIndexFrom(event.target);
    if (focused < 0) focused = committed;
    var next = null;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, focused + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, focused - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'Enter') {
      event.preventDefault();
      if (focused === committed && stage === 'work') openCaseStudy(focused);
      else commit(focused, { history: 'push', announce: true, focus: true, focusDetail: narrowWork() });
      return;
    } else if (event.key === ' ') {
      event.preventDefault();
      commit(focused, { history: 'push', announce: true, focus: true, focusDetail: narrowWork() });
      return;
    } else return;
    event.preventDefault();
    commit(next, { history: 'replace', announce: true, focus: true });
  });

  function applyHash(fromHistory) {
    var raw = readHash();
    if (!raw || raw === 'hero' || raw === 'about') {
      setPreview(-1);
      current = 0;
      setStage('portrait');
      placeNav();
      return;
    }
    if (raw === 'work-list' || raw === 'studio-projects') {
      setPreview(-1);
      current = dataIndexForProject(committed);
      setStage('work', { workMode: 'list' });
      paint(committed, { previewing: false });
      placeNav();
      return;
    }
    if (raw === 'contact') {
      setPreview(-1);
      current = data.length - 1;
      setStage('contact');
      placeNav();
      return;
    }
    var slug = raw.replace(/^project-/, '');
    var index = rows.findIndex(function (row) { return row.id === slug; });
    if (index >= 0) {
      commit(index, {
        history: false,
        announce: !!fromHistory,
        focusDetail: narrowWork() && !booting
      });
      setStage('work', { workMode: narrowWork() ? 'detail' : 'list' });
    } else {
      setStage('portrait');
    }
    placeNav();
  }
  var seenHash = location.hash;
  function noteHash() { seenHash = location.hash; }
  window.addEventListener('hashchange', function () { noteHash(); applyHash(true); });
  window.addEventListener('popstate', function () { noteHash(); applyHash(true); });
  document.addEventListener('click', function () {
    if (location.hash === seenHash) return;
    noteHash();
    applyHash(false);
  });

  root.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (link.hasAttribute('data-studio-pick')) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      var id = link.getAttribute('href').slice(1);
      if (!id) return;
      event.preventDefault();
      if (location.hash !== '#' + id) history.pushState({ studio: id }, '', '#' + id);
      noteHash();
      applyHash(false);
    });
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
    if (reducedMotion()) {
      projectPanels.forEach(clearLeaving);
      Object.keys(layers).forEach(clearLayerLeave);
      if (detail) detail.classList.remove('is-previewing');
    }
    syncLabs();
    syncEvidence();
    scheduleLayout();
  });
  document.addEventListener('visibilitychange', function () {
    syncLabs();
    syncEvidence();
  });
  var layoutFrame = 0;
  function scheduleLayout() {
    if (layoutFrame) return;
    layoutFrame = window.requestAnimationFrame(function () {
      layoutFrame = 0;
      moveMarker();
      placeGear(null);
      placeNav();
      if (narrowWork() && stage === 'work' && root.dataset.workMode !== 'detail') setWorkMode('list');
      if (!narrowWork() && stage === 'work') setWorkMode('list');
    });
  }
  window.addEventListener('resize', scheduleLayout);

  function finishViewerClose() {
    if (parked) {
      if (parked.parent && parked.parent.isConnected && parked.node.parentNode !== parked.parent) {
        var next = parked.next && parked.next.parentNode === parked.parent ? parked.next : null;
        parked.parent.insertBefore(parked.node, next);
      }
      parked = null;
    }
    if (viewerStage) viewerStage.replaceChildren();
    syncEvidence();
    var focus = returnFocus;
    returnFocus = null;
    var silent = skipViewerFocus;
    skipViewerFocus = false;
    if (silent || !focus || !focus.isConnected) return;
    if (focus.closest('[inert], [hidden], [aria-hidden="true"]')) return;
    var box = focus.getBoundingClientRect();
    if (box.width < 1 && box.height < 1) return;
    focus.focus({ preventScroll: true });
  }
  viewer.addEventListener('close', finishViewerClose);
  viewer.querySelector('[data-studio-viewer-close]').addEventListener('click', function () { closeViewer(false); });
  viewer.addEventListener('click', function (event) { if (event.target === viewer) closeViewer(false); });
  root.querySelectorAll('[data-studio-zoom],[data-studio-evidence-zoom]').forEach(function (opener) {
    opener.addEventListener('click', function () {
      if (viewer.open) return;
      pinPreviewForDetail();
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
  var navLinks = nav ? Array.prototype.filter.call(nav.querySelectorAll('a[href^="#"]'), function () { return true; }) : [];
  function activeSection() {
    if (stage === 'contact') return 'contact';
    if (stage === 'work') return 'work-list';
    return 'about';
  }
  function placeNav() {
    var section = activeSection();
    var brand = root.querySelector('.studio-brand');
    if (brand) brand.classList.toggle('is-section', section === 'about');
    navLinks.forEach(function (link) {
      link.classList.toggle('is-section', link.getAttribute('href') === '#' + section);
    });
    if (!nav || !navMark) return;
    var link = null;
    for (var i = 0; i < navLinks.length; i++) {
      if (navLinks[i].classList.contains('is-section')) link = navLinks[i];
    }
    if (!link) {
      navMark.style.opacity = '0';
      return;
    }
    var box = nav.getBoundingClientRect();
    var rect = link.getBoundingClientRect();
    navMark.style.opacity = '1';
    navMark.style.width = Math.round(rect.width) + 'px';
    navMark.style.transform = 'translateX(' + Math.round(rect.left - box.left) + 'px)';
  }
  if (nav) {
    navMark = document.createElement('span');
    navMark.className = 'studio-nav-mark';
    navMark.setAttribute('aria-hidden', 'true');
    nav.appendChild(navMark);
  }

  syncMotionClass();
  if (detail) detail.classList.add('is-instant');
  commit(0, { history: false, holdStage: true });
  applyHash(false);
  window.scrollTo(0, 0);
  booting = false;
  placeGear(null);
  placeNav();
  window.requestAnimationFrame(function () {
    if (detail) detail.classList.remove('is-instant');
    moveMarker();
    placeGear(null);
    placeNav();
  });
  root.classList.add('is-ready');

  function apiSelect(index) {
    if (index <= 0) {
      if (location.hash !== '#about') history.pushState({ studio: 'about' }, '', '#about');
      noteHash();
      applyHash(false);
      return;
    }
    if (index >= data.length - 1) {
      if (location.hash !== '#contact') history.pushState({ studio: 'contact' }, '', '#contact');
      noteHash();
      applyHash(false);
      return;
    }
    var slug = data[index].slug;
    var row = rows.findIndex(function (item) { return item.id === slug; });
    if (row >= 0) commit(row, { history: 'push', announce: true });
  }
  window.SkyStudio = {
    select: apiSelect,
    selectSlug: function (slug) {
      var i = data.findIndex(function (item) { return item.slug === slug; });
      if (i >= 0) apiSelect(i);
    },
    selected: function () { return routeIndex(); },
    settled: function () { return preview < 0; },
    position: function () { return routeIndex(); },
    stage: function () { return stage; },
    workMode: function () { return root.dataset.workMode || 'list'; },
    slug: function () {
      if (stage === 'contact') return 'contact';
      if (stage === 'portrait') {
        var about = data[0];
        return about && about.slug === 'about' ? 'about' : 'about';
      }
      var i = routeIndex();
      return data[i] ? data[i].slug : rows[committed].id;
    },
    playing: function () {
      var index = shown >= 0 ? shown : committed;
      var lab = labs[index];
      if (!lab || !lab.snapshot) return false;
      if (!enabled || document.hidden || reducedMotion() || stage !== 'work') return false;
      if (!labRunning[index] || index !== shown || !labOpen(index) || !labSeen[index]) return false;
      var snap = lab.snapshot();
      return !!(snap && snap.playing);
    },
    snapshot: function () {
      var lab = labs[shown >= 0 ? shown : committed];
      return { selected: current, slug: data[current] ? data[current].slug : '', stage: stage, scene: lab && lab.snapshot ? lab.snapshot() : null };
    },
    wheel: null
  };
})();
