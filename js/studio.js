/* Project list, evidence, and the portrait viewer. The page scrolls natively. */
(function () {
  'use strict';
  var root = document.querySelector('[data-studio]');
  if (!root) return;
  var data = JSON.parse(document.getElementById('studio-data').textContent);
  var panels = Array.prototype.slice.call(root.querySelectorAll('[data-studio-panel]'));
  var rows = Array.prototype.slice.call(root.querySelectorAll('[data-studio-pick]'));
  var list = document.getElementById('studio-projects');
  var detail = root.querySelector('[data-studio-detail]');
  var work = document.getElementById('work-list');
  var marker = root.querySelector('[data-studio-marker]');
  var announce = document.querySelector('[data-announce]');
  var motion = window.SkyMotion;
  var projectPanels = panels.filter(function (panel) { return panel.classList.contains('work-card'); });
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
  var viewer = document.getElementById('studio-viewer');
  var viewerStage = viewer.querySelector('.studio-viewer-stage');
  var returnFocus = null;
  var parked = null;
  var skipViewerFocus = false;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

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
  function headerOffset() {
    var header = root.querySelector('.studio-header');
    return (header ? header.getBoundingClientRect().height : 52) + 8;
  }
  function readHash() {
    try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ''; }
  }
  function routeIndex() {
    var raw = readHash();
    if (raw === 'contact') return data.length - 1;
    var slug = raw.indexOf('project-') === 0 ? raw.slice(8) : raw;
    var section = !slug || slug === 'hero' || slug === 'about' || slug === 'work-list' || slug === 'studio-projects';
    if (!section) {
      var exact = data.findIndex(function (item) { return item.slug === slug && item.kind !== 'profile'; });
      if (exact >= 0) return exact;
    }
    return dataIndexForProject(committed);
  }
  function rowIndexFrom(node) {
    var row = node && node.closest ? node.closest('[data-studio-pick]') : null;
    if (!row) return -1;
    return rows.indexOf(row);
  }

  function onStage(item, i) {
    var panel = projectPanels[i];
    var open = viewer.open && parked && parked.node.contains(item.video);
    return open || (panel === shownPanel() && item.visible);
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
      var blocked = item.userPaused || !enabled || document.hidden || !onStage(item, i);
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
    }, { threshold: 0.2 });
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
    }, { threshold: 0.12 }).observe(labEl);
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
  function paint(index) {
    if (index < 0) return;
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

  function narrowWork() {
    return window.matchMedia('(max-width: 720px)').matches;
  }
  function revealRow(row) {
    if (!row) return;
    var rect = row.getBoundingClientRect();
    var topLimit = headerOffset();
    var bottomLimit = window.innerHeight - 12;
    var delta = 0;
    if (rect.top < topLimit) delta = rect.top - topLimit;
    else if (rect.bottom > bottomLimit) delta = rect.bottom - bottomLimit;
    if (delta !== 0) window.scrollBy({ top: delta, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  function placeListJump() {
    if (!detail) return;
    var jump = detail.querySelector('.studio-list-jump');
    if (!jump) return;
    var header = root.querySelector('.studio-header');
    var headerH = header ? header.getBoundingClientRect().height : 52;
    var narrow = narrowWork();
    jump.style.gridArea = '1 / 1';
    jump.style.alignSelf = 'start';
    jump.style.justifySelf = 'start';
    jump.style.zIndex = '3';
    jump.style.top = narrow ? headerH + 'px' : '';
    var pad = narrow ? jump.offsetHeight : 0;
    projectPanels.forEach(function (panel) { panel.style.paddingTop = pad ? pad + 'px' : ''; });
  }
  function scrollDetailIntoView() {
    if (!detail) return;
    placeListJump();
    var behavior = reducedMotion() ? 'auto' : 'smooth';
    var run = function () {
      var article = projectPanels[committed] || detail;
      if (!article) return;
      var top = article.getBoundingClientRect().top + window.scrollY - headerOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: behavior });
    };
    run();
    window.requestAnimationFrame(run);
  }
  function scrollToSection(id) {
    if (id === 'about' || id === 'hero' || !id) {
      window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' });
      return;
    }
    var el = document.getElementById(id);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.scrollY - headerOffset();
    window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  function writeHash(mode, id) {
    var url = '#project-' + id;
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
    paint(index);
    if (meta.focusDetail) {
      scrollDetailIntoView();
      if (meta.focus) {
        var article = projectPanels[index];
        var focusArticle = function () {
          if (article && article.isConnected) article.focus({ preventScroll: true });
        };
        focusArticle();
        window.requestAnimationFrame(focusArticle);
      }
    } else if (meta.focus) rows[index].focus({ preventScroll: true });
    if (meta.scroll) revealRow(rows[index]);
    if (meta.history) writeHash(meta.history, rows[index].id);
    if (meta.announce && announce && data[current]) announce.textContent = data[current].name + ' selected';
    if (prev !== index) document.dispatchEvent(new CustomEvent('sky:workselect', { detail: { index: index } }));
    placeNav();
  }

  function setPreview(index) {
    if (index === committed) index = -1;
    if (index === preview) return;
    preview = index;
    rows.forEach(function (row, n) { row.classList.toggle('is-preview', n === index); });
    paint(index < 0 ? committed : index);
  }

  rows.forEach(function (row, i) {
    row.addEventListener('pointerenter', function () {
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
    row.addEventListener('focus', function () { setPreview(i); });
    row.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
      event.preventDefault();
      if (narrowWork()) commit(i, { history: 'push', announce: true, focusDetail: true });
      else commit(i, { history: 'push', announce: true, scroll: true });
    });
  });

  function pinPreviewForDetail() {
    if (preview >= 0 && preview !== committed) commit(preview, { history: 'replace', announce: false, scroll: false });
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

  list.addEventListener('keydown', function (event) {
    var focused = rowIndexFrom(event.target);
    if (focused < 0) focused = committed;
    var next = null;
    if (event.key === 'ArrowDown') next = Math.min(rows.length - 1, focused + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, focused - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = rows.length - 1;
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (narrowWork()) commit(focused, { history: 'push', announce: true, focusDetail: true, focus: true });
      else commit(focused, { history: 'push', announce: true, scroll: true, focus: true });
      return;
    } else return;
    event.preventDefault();
    commit(next, { history: 'replace', announce: true, focus: true, scroll: true });
  });

  function applyHash(fromHistory, skipScroll) {
    var raw = readHash();
    if (!raw) {
      if (!booting) commit(0, { history: false, scroll: false, announce: !!fromHistory });
      if (fromHistory) scrollToSection('about');
      placeNav();
      return;
    }
    if (raw === 'hero' || raw === 'about' || raw === 'work-list' || raw === 'studio-projects') {
      setPreview(-1);
      current = dataIndexForProject(committed);
      if (!skipScroll && !(booting && (raw === 'hero' || raw === 'about'))) scrollToSection(raw === 'about' || raw === 'hero' ? 'about' : raw);
      placeNav();
      return;
    }
    if (raw === 'contact') {
      setPreview(-1);
      current = data.length - 1;
      if (!skipScroll) scrollToSection('contact');
      placeNav();
      return;
    }
    var slug = raw.replace(/^project-/, '');
    var index = rows.findIndex(function (row) { return row.id === slug; });
    if (index >= 0) {
      var jump = !skipScroll && (fromHistory || !booting || index !== 0);
      if (booting && index === 0) jump = false;
      commit(index, { history: false, announce: !!fromHistory, scroll: jump });
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
    applyHash(false, true);
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
    if (reducedMotion()) projectPanels.forEach(clearLeaving);
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
      placeListJump();
      placeGear(null);
      placeNav();
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
  var sectionRatios = { about: 0, 'work-list': 0, contact: 0 };
  function activeSection() {
    var raw = readHash();
    if (raw === 'contact') return 'contact';
    if (raw === 'work-list' || raw.indexOf('project-') === 0) {
      if (sectionRatios.contact > sectionRatios['work-list'] && sectionRatios.contact > 0.45) return 'contact';
      return 'work-list';
    }
    var best = 'about';
    var bestRatio = -1;
    Object.keys(sectionRatios).forEach(function (key) {
      if (sectionRatios[key] > bestRatio) {
        bestRatio = sectionRatios[key];
        best = key;
      }
    });
    return best;
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
    if (typeof IntersectionObserver === 'function') {
      [['hero', 'about'], ['work-list', 'work-list'], ['contact', 'contact']].forEach(function (pair) {
        var section = document.getElementById(pair[0]);
        if (!section) return;
        new IntersectionObserver(function (records) {
          var record = records[records.length - 1];
          sectionRatios[pair[1]] = record.isIntersecting ? record.intersectionRatio : 0;
          placeNav();
        }, { threshold: [0, 0.15, 0.35, 0.6, 0.9], rootMargin: '-' + Math.round(headerOffset()) + 'px 0px -35% 0px' }).observe(section);
      });
    }
  }

  syncMotionClass();
  detail.classList.add('is-instant');
  commit(0, { history: false, scroll: false });
  applyHash(false);
  if (!readHash()) window.scrollTo(0, 0);
  booting = false;
  placeGear(null);
  placeNav();
  window.requestAnimationFrame(function () {
    detail.classList.remove('is-instant');
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
    if (row >= 0) commit(row, { history: 'push', announce: true, scroll: true });
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
    slug: function () {
      var i = routeIndex();
      return data[i] ? data[i].slug : rows[committed].id;
    },
    playing: function () {
      var index = shown >= 0 ? shown : committed;
      var lab = labs[index];
      if (!lab || !lab.snapshot) return false;
      if (!enabled || document.hidden || reducedMotion()) return false;
      if (!labRunning[index] || index !== shown || !labOpen(index) || !labSeen[index]) return false;
      var snap = lab.snapshot();
      return !!(snap && snap.playing);
    },
    snapshot: function () {
      var lab = labs[shown >= 0 ? shown : committed];
      return { selected: current, slug: data[current] ? data[current].slug : '', scene: lab && lab.snapshot ? lab.snapshot() : null };
    },
    wheel: null
  };
})();
