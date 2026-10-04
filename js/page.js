/* Page behavior: local time, copy-to-clipboard, the /work theme filter, the case-study section index,
   video play/pause, the hero, and the cat. Filter and scrollspy logic are exported for tests. */
(function (global) {
  "use strict";

  var THEMES = ["ai-systems", "developer-tools", "physics-software"];

  // Which rows a theme shows; unknown or missing themes show everything.
  function filterRows(rows, theme) {
    var valid = THEMES.indexOf(theme) >= 0 ? theme : "all";
    return {
      theme: valid,
      shown: rows.map(function (themes) { return valid === "all" || themes.indexOf(valid) >= 0; })
    };
  }

  function themeFromSearch(search) {
    var value = new URLSearchParams(search || "").get("theme");
    return THEMES.indexOf(value) >= 0 ? value : "all";
  }

  function queryFromSearch(search) { return (new URLSearchParams(search || "").get("q") || "").trim(); }

  function searchFor(theme, query) {
    var params = new URLSearchParams();
    if (THEMES.indexOf(theme) >= 0) params.set("theme", theme);
    if (query && query.trim()) params.set("q", query.trim());
    return params.size ? "?" + params.toString() : "";
  }

  function matchesQuery(text, query) {
    var normalize = function (value) { return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
    var haystack = normalize(text);
    return normalize(query).trim().split(/\s+/).every(function (word) { return haystack.indexOf(word) >= 0; });
  }

  // The active section is the last one whose top has passed the reading line.
  function activeSection(tops, line) {
    var active = 0;
    for (var i = 0; i < tops.length; i++) if (tops[i] <= line) active = i;
    return active;
  }

  function kathmanduTime(date) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  }

  function pad(n) { return String(n).padStart(2, "0"); }

  function boot(doc, win) {
    var motion = win.SkyMotion || { reduced: function () { return false; }, subscribe: function () {} };
    var announce = doc.querySelector("[data-announce]");
    var say = function (text) { if (announce) { announce.textContent = ""; win.setTimeout(function () { announce.textContent = text; }, 30); } };

    /* local time */
    var times = doc.querySelectorAll("[data-time]");
    var tick = function () { var now = kathmanduTime(new Date()); for (var i = 0; i < times.length; i++) times[i].textContent = now; };
    if (times.length) { tick(); win.setInterval(tick, 15000); }

    /* copy */
    doc.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-copy]") : null;
      if (!button) return;
      var unavailable = function () {
        var address = button.parentNode.querySelector('a[href^="mailto:"]');
        if (address && win.getSelection) {
          var range = doc.createRange();
          range.selectNodeContents(address);
          var selection = win.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        say("Automatic copying is unavailable. Select and copy the email address, or open the email link.");
        button.textContent = "Select";
        win.setTimeout(function () { button.textContent = "Copy"; }, 2400);
      };
      if (!win.navigator.clipboard) { unavailable(); return; }
      win.navigator.clipboard.writeText(button.getAttribute("data-copy")).then(function () {
        button.textContent = "Copied";
        say("Email address copied");
        win.setTimeout(function () { button.textContent = "Copy"; }, 1600);
      }, unavailable);
    });

    var index = doc.getElementById("site-index");
    if (index && typeof index.showModal === "function") {
      var indexInput = index.querySelector("[data-index-search]");
      var indexItems = Array.prototype.slice.call(index.querySelectorAll("[data-index-item]"));
      var indexEmpty = index.querySelector("[data-index-empty]");
      var indexStatus = index.querySelector("[data-index-status]");
      var indexMotion = index.querySelector("[data-index-motion]");
      var indexOpener = doc.querySelector("[data-index-open]");
      var returnFocus = null;
      var searchIndex = function () {
        var count = 0;
        indexItems.forEach(function (item) {
          item.hidden = !matchesQuery(item.getAttribute("data-search"), indexInput.value);
          if (!item.hidden) count++;
        });
        indexEmpty.hidden = count > 0;
        indexStatus.textContent = count + (count === 1 ? " result" : " results");
        index.querySelector(".index-pages").hidden = !indexItems.some(function (item) { return item.tagName === "A" && !item.hidden; });
        index.querySelector(".index-label").hidden = !indexItems.some(function (item) { return item.tagName === "LI" && !item.hidden; });
      };
      var releaseIndex = function () {
        doc.documentElement.classList.remove("index-is-open");
        if (motion.setScrollLocked) motion.setScrollLocked(false);
        if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      };
      var closeIndex = function () { if (index.open) { index.close(); releaseIndex(); } };
      var openIndex = function () {
        if (index.open) { indexInput.focus(); return; }
        returnFocus = doc.activeElement;
        indexInput.value = "";
        searchIndex();
        index.showModal();
        doc.documentElement.classList.add("index-is-open");
        if (motion.setScrollLocked) motion.setScrollLocked(true);
        indexInput.focus({ preventScroll: true });
      };
      indexOpener.addEventListener("click", openIndex);
      index.querySelector("[data-index-close]").addEventListener("click", closeIndex);
      indexInput.addEventListener("input", searchIndex);
      index.addEventListener("close", function () {
        if (doc.documentElement.classList.contains("index-is-open")) releaseIndex();
      });
      index.addEventListener("click", function (event) {
        if (event.target.closest("a[href]")) { closeIndex(); return; }
        if (event.target !== index) return;
        var rect = index.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeIndex();
      });
      index.addEventListener("keydown", function (event) {
        if (event.key === "Tab") {
          var focusable = Array.prototype.filter.call(index.querySelectorAll('button:not(:disabled), input, a[href]'), function (el) { return el.getClientRects().length > 0; });
          var first = focusable[0], last = focusable[focusable.length - 1];
          if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
          return;
        }
        if (event.isComposing || (event.target !== indexInput && !event.target.closest("[data-index-item]"))) return;
        var links = indexItems.filter(function (item) { return !item.hidden; }).map(function (item) { return item.tagName === "A" ? item : item.querySelector("a"); });
        if (!links.length) return;
        if (event.key === "Enter" && event.target === indexInput) { event.preventDefault(); links[0].click(); return; }
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        var current = links.indexOf(doc.activeElement);
        var next = current < 0 ? (event.key === "ArrowDown" ? 0 : links.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + links.length) % links.length;
        links[next].focus({ preventScroll: true });
        links[next].scrollIntoView({ block: "nearest" });
      });
      doc.addEventListener("keydown", function (event) {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey) return;
        var editable = event.target.closest && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false])");
        var shortcut = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
        if (!shortcut && (event.key !== "/" || event.metaKey || event.ctrlKey || editable || index.open)) return;
        event.preventDefault();
        openIndex();
      });
      var syncIndexMotion = function () {
        indexMotion.setAttribute("aria-pressed", motion.reduced() ? "true" : "false");
        indexMotion.setAttribute("aria-label", "Motion " + (motion.reduced() ? "Reduced" : "Full") + ", toggle reduced motion");
        indexMotion.querySelector("[data-index-motion-state]").textContent = motion.reduced() ? "Reduced" : "Full";
      };
      indexMotion.addEventListener("click", function () { if (motion.set) motion.set(motion.reduced() ? "full" : "reduced"); });
      motion.subscribe(syncIndexMotion);
      syncIndexMotion();
    } else {
      var unsupportedIndex = doc.querySelector("[data-index-open]");
      if (unsupportedIndex) unsupportedIndex.hidden = true;
    }

    /* /work filter */
    var filters = doc.querySelector("[data-filters]");
    if (filters) {
      var rows = Array.prototype.slice.call(doc.querySelectorAll(".project"));
      var buttons = Array.prototype.slice.call(filters.querySelectorAll("[data-filter]"));
      var count = doc.querySelector("[data-count]");
      var search = doc.querySelector("[data-work-search]");
      var clearSearch = doc.querySelector("[data-clear-search]");
      var empty = doc.querySelector("[data-work-empty]");
      var activeTheme = "all";
      var projectList = doc.querySelector(".projects"), listAnimation = null;
      var revealList = function () {
        if (listAnimation) listAnimation.cancel();
        if (!motion.reduced() && projectList.animate) listAnimation = projectList.animate([
          { opacity: 0.65, transform: "translateY(4px)" },
          { opacity: 1, transform: "none" }
        ], { duration: 240, easing: "cubic-bezier(.16, 1, .3, 1)" });
      };
      motion.subscribe(function () { if (motion.reduced() && listAnimation) listAnimation.cancel(); });
      var apply = function (theme, query, historyMode) {
        var result = filterRows(rows.map(function (r) { return (r.getAttribute("data-themes") || "").split(" "); }), theme);
        activeTheme = result.theme;
        rows.forEach(function (row, i) { row.hidden = !result.shown[i] || !matchesQuery(row.getAttribute("data-search"), query); });
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filter") === result.theme ? "true" : "false"); });
        var n = rows.filter(function (row) { return !row.hidden; }).length;
        if (count) count.textContent = pad(n);
        if (empty) empty.hidden = n > 0;
        if (clearSearch) clearSearch.hidden = !query;
        if (historyMode) {
          var url = win.location.pathname + searchFor(result.theme, query) + win.location.hash;
          if (url !== win.location.pathname + win.location.search + win.location.hash) win.history[historyMode + "State"](null, "", url);
          var label = result.theme === "all" ? "all themes" : buttons.filter(function (b) { return b.getAttribute("data-filter") === result.theme; })[0].firstChild.textContent.trim();
          say(n + (n === 1 ? " project" : " projects") + " shown for " + label + (query ? ', matching “' + query + '”' : ""));
          if (historyMode === "push") revealList();
        }
      };
      buttons.forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-filter"), search ? search.value : "", "push"); }); });
      if (search) search.addEventListener("input", function () { apply(activeTheme, search.value, "replace"); });
      if (clearSearch) clearSearch.addEventListener("click", function () { search.value = ""; apply(activeTheme, "", "replace"); search.focus(); });
      var reset = doc.querySelector("[data-clear-work]");
      if (reset) reset.addEventListener("click", function () { if (search) search.value = ""; apply("all", "", "push"); if (search) search.focus(); });
      var restoreFilters = function () {
        var query = queryFromSearch(win.location.search);
        if (search) search.value = query;
        apply(themeFromSearch(win.location.search), query, null);
      };
      win.addEventListener("popstate", restoreFilters);
      restoreFilters();
      doc.documentElement.removeAttribute("data-filter");
      var views = Array.prototype.slice.call(doc.querySelectorAll("button[data-work-view]"));
      var setView = function (view, save) {
        var current = view === "grid" ? "grid" : "list";
        doc.documentElement.setAttribute("data-work-view", current);
        views.forEach(function (button) { button.setAttribute("aria-pressed", button.getAttribute("data-work-view") === current ? "true" : "false"); });
        rows.forEach(function (row) {
          var image = row.querySelector(".thumb img");
          if (image) image.sizes = current === "grid" ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 767px) 50vw, 25vw";
        });
        if (save) { try { win.localStorage.setItem("sky-work-view", current); } catch (e) {} }
      };
      views.forEach(function (button) { button.addEventListener("click", function () {
        if (button.getAttribute("aria-pressed") === "true") return;
        setView(button.getAttribute("data-work-view"), true);
        revealList();
      }); });
      setView(doc.documentElement.getAttribute("data-work-view"), false);
    }

    /* case-study section index */
    var toc = doc.querySelector(".toc");
    if (toc) {
      var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
      var sections = links.map(function (a) { return doc.getElementById(a.getAttribute("href").slice(1)); });
      var prose = doc.querySelector(".prose");
      var readingBar = toc.querySelector("[data-reading-bar]");
      var readingLabel = toc.querySelector("[data-reading-progress]");
      var currentSection = -1, lastProgress = -1;
      var queued = false;
      var spy = function () {
        queued = false;
        var tops = sections.map(function (s) { return s ? s.getBoundingClientRect().top : Infinity; });
        var current = activeSection(tops, win.innerHeight * 0.35);
        links.forEach(function (a, i) { if (i === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
        if (current !== currentSection) {
          var list = toc.querySelector("ol");
          if (list.scrollWidth > list.clientWidth && !toc.contains(doc.activeElement)) list.scrollLeft = links[current].offsetLeft - list.offsetLeft - (list.clientWidth - links[current].offsetWidth) / 2;
          currentSection = current;
        }
        if (prose && readingBar) {
          var rect = prose.getBoundingClientRect();
          var line = parseFloat(win.getComputedStyle(doc.documentElement).scrollPaddingTop) || 80;
          var distance = Math.max(1, rect.height - win.innerHeight + line);
          var progress = Math.round(Math.max(0, Math.min(1, (line - rect.top) / distance)) * 100);
          if (progress !== lastProgress) {
            readingBar.style.transform = "scaleX(" + progress / 100 + ")";
            if (readingLabel) readingLabel.textContent = pad(progress) + "%";
            lastProgress = progress;
          }
        }
      };
      var queueSpy = function () { if (!queued) { queued = true; win.requestAnimationFrame(spy); } };
      win.addEventListener("scroll", queueSpy, { passive: true });
      win.addEventListener("resize", queueSpy);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(queueSpy);
      spy();
    }

    /* videos: play while on screen unless paused or motion is reduced */
    var videos = Array.prototype.slice.call(doc.querySelectorAll("video[data-autoplay]"));
    videos.forEach(function (video) {
      video.removeAttribute("controls");
      var paused = false, onScreen = false;
      var button = doc.createElement("button");
      button.type = "button";
      button.className = "fig-ctrl";
      video.parentNode.appendChild(button);
      var sync = function () {
        var play = onScreen && !paused && !motion.reduced();
        if (play) { video.preload = "auto"; var p = video.play(); if (p && p.catch) p.catch(function () {}); }
        else video.pause();
        button.textContent = play ? "Pause" : "Play";
        button.setAttribute("aria-label", (play ? "Pause" : "Play") + " video");
      };
      button.addEventListener("click", function () {
        if (motion.reduced() && !onScreen) return;
        var playing = !video.paused;
        paused = playing;
        if (!playing && motion.reduced()) { var p = video.play(); if (p && p.catch) p.catch(function () {}); button.textContent = "Pause"; button.setAttribute("aria-label", "Pause video"); return; }
        sync();
      });
      new win.IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; sync(); }, { threshold: 0.4 }).observe(video);
      motion.subscribe(sync);
      sync();
    });

    /* hero */
    var figure = doc.getElementById("figure");
    var hero = null;
    if (figure && win.SkyHero) {
      var counter = doc.querySelector("[data-dot-count]");
      hero = win.SkyHero.mount(figure, {
        base: "/assets/hero/",
        words: (figure.getAttribute("data-words") || "").split(",").filter(Boolean),
        motion: motion,
        onCount: function (n) { if (counter) counter.textContent = n.toLocaleString("en-US"); }
      });
      var ripple = doc.querySelector("[data-hero-ripple]");
      if (ripple && hero.ripple) {
        var syncRipple = function () { ripple.hidden = false; ripple.disabled = motion.reduced() || figure.classList.contains("is-fallback") || !figure.classList.contains("is-live"); };
        ripple.addEventListener("click", function () { hero.ripple(); });
        new win.MutationObserver(syncRipple).observe(figure, { attributes: true, attributeFilter: ["class"] });
        motion.subscribe(syncRipple);
        syncRipple();
      }
      var themeLinks = doc.querySelectorAll("[data-theme-link]");
      Array.prototype.forEach.call(themeLinks, function (link) {
        var names = (link.getAttribute("data-names") || "").split(",").filter(Boolean);
        var on = function () { hero.highlight(names); };
        var off = function () { hero.highlight(null); };
        link.addEventListener("mouseenter", on);
        link.addEventListener("focus", on);
        link.addEventListener("mouseleave", off);
        link.addEventListener("blur", off);
      });
    }

    /* cat: only with a mouse */
    if (win.SkyCat && win.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      win.SkyCat.mount({
        reduced: {
          get matches() { return motion.reduced(); },
          addEventListener: function (type, fn) { motion.subscribe(fn); }
        }
      });
    }

    return { hero: hero };
  }

  var api = { filterRows: filterRows, themeFromSearch: themeFromSearch, queryFromSearch: queryFromSearch, searchFor: searchFor, matchesQuery: matchesQuery, activeSection: activeSection, kathmanduTime: kathmanduTime, THEMES: THEMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    global.SkyPage = api;
    boot(document, global);
  }
})(typeof window !== "undefined" ? window : globalThis);
