/* Page behavior: local time, copy-to-clipboard, the /work theme filter, the case-study section index,
   video play/pause, and the hero. Filter and scrollspy logic are exported for tests. */
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

  /* Kathmandu, for the contact dial: UTC+5:45 all year, so its minute of the day is plain arithmetic. */
  var KATHMANDU = 345;
  function kathmanduMinute(date) { return ((date.getUTCHours() * 60 + date.getUTCMinutes() + KATHMANDU) % 1440 + 1440) % 1440; }
  function clock(minute) { return pad(Math.floor(minute / 60) % 24) + ":" + pad(Math.floor(minute % 60)); }

  // What I am probably doing at a minute of the Kathmandu day.
  var DAY = [[0, "asleep"], [330, "up early, with tea"], [420, "reading last night’s email"], [570, "eating dal bhat"], [630, "writing tests"], [780, "at my desk, building"], [1050, "fixing what the tests caught"], [1170, "eating dal bhat again"], [1230, "debugging something"]];
  function kathmanduStatus(minute) {
    var status = DAY[0][1];
    for (var i = 0; i < DAY.length; i++) if (minute >= DAY[i][0]) status = DAY[i][1];
    return status;
  }

  // How far Kathmandu is ahead of a visitor whose clock is `offset` minutes east of UTC.
  function timeGap(offset) {
    var gap = KATHMANDU - offset, h = Math.floor(Math.abs(gap) / 60), m = Math.abs(gap) % 60;
    if (!gap) return "the same time as you";
    return (h ? h + " h" : "") + (h && m ? " " : "") + (m ? m + " min" : "") + (gap > 0 ? " ahead of you" : " behind you");
  }

  // Sunrise and sunset in Kathmandu, in minutes after its midnight, from the NOAA approximation of the sun's path.
  // `date` carries Kathmandu's calendar day in its UTC fields.
  function sunTimes(date) {
    var lat = 27.7172 * Math.PI / 180, lon = 85.324, rad = Math.PI / 180;
    var day = Math.floor((date - Date.UTC(date.getUTCFullYear(), 0, 0)) / 864e5);
    var g = 2 * Math.PI / 365 * (day - 1);
    var eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var ha = Math.acos(Math.cos(90.833 * rad) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl)) / rad;
    return { rise: 720 - 4 * (lon + ha) - eq + KATHMANDU, set: 720 - 4 * (lon - ha) - eq + KATHMANDU };
  }

  // 0 in full day, 1 in full night, 0.5 at sunrise and sunset, with 40 minutes of twilight either side.
  function darkness(minute, sun) {
    var ramp = Math.min(Math.min(Math.abs(minute - sun.rise), Math.abs(minute - sun.set)) / 40, 1);
    return minute > sun.rise && minute < sun.set ? 0.5 - 0.5 * ramp : 0.5 + 0.5 * ramp;
  }

  // The type role a computed style belongs to, named as in docs/design-spec.md §4.
  function typeRole(size, line, mono) {
    var key = (mono ? "mono " : "") + size + "/" + line;
    return { "24/32": "Title L", "18/24": "Title S", "15/24": "Body", "13/20": "Small", "mono 13/20": "Small, mono", "mono 11/16": "UI", "mono 10/16": "Label" }[key] || key;
  }

  function noise(x, y) { var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); }

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
      var counters = doc.querySelectorAll("[data-dot-count]");
      var telemetry = doc.querySelector("[data-hero-telemetry]");
      var degrees = function (rad) { var d = rad * 180 / Math.PI; return (d < 0 ? "−" : "+") + Math.abs(d).toFixed(1) + "°"; };
      // The opening (js/hero.js INTRO) plays when the page is opened: once a tab, again on a reload, never under
      // reduced motion. It takes the page into Gear Two and back without saving it, and any press, key, or scroll
      // ends it; a press on a gear or the lights then acts on the page as it is.
      var opening = false;
      if (!motion.reduced()) {
        try {
          var arrival = win.performance && win.performance.getEntriesByType ? win.performance.getEntriesByType("navigation")[0] : null;
          opening = !win.sessionStorage.getItem("sky-intro") || !!(arrival && arrival.type === "reload");
          win.sessionStorage.setItem("sky-intro", "seen");
        } catch (e) { opening = true; }
      }
      var interrupts = ["pointerdown", "keydown", "wheel"];
      var interrupt = function (event) {
        var target = event.target;
        if (hero) hero.skipIntro(!!(target && target.closest && target.closest("[data-gear-toggle], [data-gear-blue], [data-lamp]")));
      };
      hero = win.SkyHero.mount(figure, {
        base: "/assets/hero/",
        line: figure.getAttribute("data-ring") || "",
        motion: motion,
        intro: opening,
        onIntro: function (step) {
          if ((step === "red" || step === "back") && win.skyGear) win.skyGear.switchGear(step === "red", figure, true);
          if (step === "done") interrupts.forEach(function (type) { doc.removeEventListener(type, interrupt, true); });
        },
        onCount: function (n) {
          var text = n.toLocaleString("en-US");
          for (var i = 0; i < counters.length; i++) { counters[i].textContent = text; counters[i].setAttribute("data-final", text); }
        },
        onTelemetry: function (state) {
          if (!telemetry) return;
          var parts = ["yaw " + degrees(state.yaw), "pitch " + degrees(state.pitch)];
          if (state.live) parts.push((state.ms < 0.05 ? "<0.1" : state.ms.toFixed(1)) + " ms/frame");
          if (state.gear) parts.push(Math.round(60 / win.skyGear.BEAT) + " bpm");
          telemetry.textContent = "";
          parts.forEach(function (text) { var span = doc.createElement("span"); span.textContent = text; telemetry.appendChild(span); });
          telemetry.hidden = false;
        }
      });
      if (opening) interrupts.forEach(function (type) { doc.addEventListener(type, interrupt, { capture: true, passive: true }); });
      // hovering or focusing a piece of work brightens the ring for a moment
      Array.prototype.forEach.call(doc.querySelectorAll("[data-work-link]"), function (link) {
        link.addEventListener("mouseenter", function () { hero.highlight(); });
        link.addEventListener("focus", function () { hero.highlight(); });
      });
    }

    /* Gear Two: a soft ember glow follows the pointer across the page, beating with the heart, and sheds a short trail
       of embers that drift up and fade. The gear's tokens switch it on (--trail: 1) and colour it (--trail-hot,
       -ember, -cool, -glow), so another gear could take its own. Nothing runs under reduced motion or without a fine
       pointer that hovers, and nothing is drawn once the pointer rests and the last ember has faded. */
    var finePointer = win.matchMedia ? win.matchMedia("(hover: hover) and (pointer: fine)") : null;
    if (finePointer && win.requestAnimationFrame) {
      var EMBERS = 56, SPACING = 9;
      var trail = null, embers = [], spark = { x: 0, y: 0, gx: 0, gy: 0, at: 0, carry: 0, shown: false }, sparkRaf = 0, sparkLast = 0, dirty = null;
      var rgbOf = function (ctx, css) {
        ctx.fillStyle = "#000";
        ctx.fillStyle = css;
        var v = ctx.fillStyle;
        return v.charAt(0) === "#" ? [1, 3, 5].map(function (i) { return parseInt(v.slice(i, i + 2), 16); }) : (v.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
      };
      var sizeTrail = function () {
        var dpr = Math.min(2, win.devicePixelRatio || 1);
        trail.canvas.width = Math.round(win.innerWidth * dpr);
        trail.canvas.height = Math.round(win.innerHeight * dpr);
        trail.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        dirty = null;
      };
      var drift = function (now) {
        sparkRaf = 0;
        var dt = Math.min(0.1, Math.max(0.001, (now - sparkLast) / 1000));
        sparkLast = now;
        var ctx = trail.ctx, c = trail.colors, follow = 1 - Math.exp(-dt * 18), drag = Math.exp(-dt * 1.6), kept = 0, box = null;
        spark.gx += (spark.x - spark.gx) * follow;
        spark.gy += (spark.y - spark.gy) * follow;
        trail.glow.style.transform = "translate3d(" + spark.gx.toFixed(1) + "px, " + spark.gy.toFixed(1) + "px, 0)";
        if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2] - dirty[0], dirty[3] - dirty[1]);
        ctx.globalCompositeOperation = "lighter";
        for (var i = 0; i < embers.length; i++) {
          var e = embers[i];
          e.age += dt;
          if (e.age >= e.life) continue;
          embers[kept++] = e;
          // embers rise as they cool, swaying, and slow: white-hot, then ember, then the gear's red, then gone
          e.vx *= drag;
          e.vy = e.vy * drag - 46 * dt;
          e.x += (e.vx + Math.sin(e.age * e.sway + e.seed) * 18) * dt;
          e.y += e.vy * dt;
          var t = e.age / e.life, hot = t < 0.3, f = hot ? t / 0.3 : (t - 0.3) / 0.7, from = c[hot ? 0 : 1], to = c[hot ? 1 : 2];
          var rgb = [0, 1, 2].map(function (k) { return Math.round(from[k] + (to[k] - from[k]) * f); }).join(",");
          var alpha = Math.pow(1 - t, 1.5), r = e.size * (1 - 0.55 * t), reach = r * 3 + 1;
          ctx.fillStyle = "rgba(" + rgb + "," + (alpha * 0.2).toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(e.x, e.y, r * 3, 0, 6.2832);
          ctx.fill();
          ctx.fillStyle = "rgba(" + rgb + "," + alpha.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(e.x, e.y, r, 0, 6.2832);
          ctx.fill();
          box = box ? [Math.min(box[0], e.x - reach), Math.min(box[1], e.y - reach), Math.max(box[2], e.x + reach), Math.max(box[3], e.y + reach)] : [e.x - reach, e.y - reach, e.x + reach, e.y + reach];
        }
        embers.length = kept;
        dirty = box;
        if (kept || Math.abs(spark.x - spark.gx) + Math.abs(spark.y - spark.gy) > 0.5) sparkRaf = win.requestAnimationFrame(drift);
      };
      var syncTrail = function () {
        var on = !!doc.body && finePointer.matches && !motion.reduced() && win.getComputedStyle(doc.documentElement).getPropertyValue("--trail").trim() === "1";
        if (!on) {
          if (!trail || trail.canvas.hidden) return;
          win.cancelAnimationFrame(sparkRaf);
          sparkRaf = 0;
          embers = [];
          dirty = null;
          spark.shown = false;
          trail.ctx.clearRect(0, 0, win.innerWidth, win.innerHeight);
          trail.glow.classList.remove("is-on");
          trail.canvas.hidden = trail.glow.hidden = true;
          return;
        }
        if (!trail) {
          var canvas = doc.createElement("canvas"), glow = doc.createElement("div");
          canvas.className = "fx-embers";
          glow.className = "fx-ember";
          canvas.setAttribute("aria-hidden", "true");
          glow.setAttribute("aria-hidden", "true");
          doc.body.appendChild(glow);
          doc.body.appendChild(canvas);
          trail = { canvas: canvas, glow: glow, ctx: canvas.getContext("2d") };
          sizeTrail();
        }
        var styles = win.getComputedStyle(doc.documentElement);
        trail.colors = ["--trail-hot", "--trail-ember", "--trail-cool"].map(function (name) { return rgbOf(trail.ctx, styles.getPropertyValue(name).trim()); });
        trail.canvas.hidden = trail.glow.hidden = false;
      };
      doc.addEventListener("pointermove", function (event) {
        if (!trail || trail.canvas.hidden || event.pointerType === "touch") return;
        var now = win.performance.now(), x = event.clientX, y = event.clientY;
        if (!spark.shown) { spark.x = spark.gx = x; spark.y = spark.gy = y; spark.at = now; spark.carry = 0; spark.shown = true; trail.glow.classList.add("is-on"); }
        var dx = x - spark.x, dy = y - spark.y, d = Math.sqrt(dx * dx + dy * dy), dt = Math.max(8, now - spark.at) / 1000;
        // an ember every 5-13 px along the pointer's path, scattered a little and carried a little along with it,
        // mostly small, a few larger; a jump sheds none
        var s = SPACING - spark.carry;
        if (d < 320) {
          for (; s <= d; s += SPACING * (0.55 + Math.random() * 0.9)) {
            if (embers.length >= EMBERS) embers.shift();
            var scatter = (Math.random() - 0.5) * 10;
            embers.push({
              x: spark.x + dx * s / d - dy / d * scatter, y: spark.y + dy * s / d + dx / d * scatter,
              vx: Math.max(-50, Math.min(50, dx / dt * 0.08)) + (Math.random() - 0.5) * 70,
              vy: Math.max(-50, Math.min(50, dy / dt * 0.08)) - 18 - Math.random() * 42,
              age: 0, life: 0.45 + Math.random() * 0.6, size: 0.5 + Math.pow(Math.random(), 2.2) * 1.6,
              sway: 3 + Math.random() * 5, seed: Math.random() * 6.2832
            });
          }
          spark.carry = SPACING - (s - d);
        }
        spark.x = x;
        spark.y = y;
        spark.at = now;
        if (!sparkRaf) { sparkLast = now; sparkRaf = win.requestAnimationFrame(drift); }
      }, { passive: true });
      doc.addEventListener("pointerout", function (event) { if (trail && !event.relatedTarget) { trail.glow.classList.remove("is-on"); spark.shown = false; } });
      win.addEventListener("resize", function () { if (trail && !trail.canvas.hidden) sizeTrail(); });
      new win.MutationObserver(syncTrail).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-gear", "data-motion"] });
      if (typeof finePointer.addEventListener === "function") finePointer.addEventListener("change", syncTrail);
      motion.subscribe(syncTrail);
      syncTrail();
    }

    /* contact: Kathmandu's day on a 24-hour dial, the night stippled in, a hand for now, and a readout that follows
       the pointer round the face */
    var note = doc.querySelector("[data-contact-note]");
    var dialFigure = doc.querySelector("[data-dial]");
    if (note || dialFigure) {
      var offset = -new Date().getTimezoneOffset();
      var svg = dialFigure && dialFigure.querySelector("svg");
      var NS = "http://www.w3.org/2000/svg";
      var at = function (minute, r) { var a = minute / 1440 * 2 * Math.PI; return [200 - r * Math.sin(a), 200 + r * Math.cos(a)]; };
      var line = function (minute, r0, r1, cls) {
        var p0 = at(minute, r0), p1 = at(minute, r1), el = doc.createElementNS(NS, "line");
        el.setAttribute("x1", p0[0].toFixed(1)); el.setAttribute("y1", p0[1].toFixed(1)); el.setAttribute("x2", p1[0].toFixed(1)); el.setAttribute("y2", p1[1].toFixed(1));
        el.setAttribute("class", cls);
        return el;
      };
      var dot = function (minute, r, size, cls) {
        var p = at(minute, r), el = doc.createElementNS(NS, "circle");
        el.setAttribute("cx", p[0].toFixed(1)); el.setAttribute("cy", p[1].toFixed(1)); el.setAttribute("r", size); el.setAttribute("class", cls);
        return el;
      };
      var readTime = dialFigure && dialFigure.querySelector("[data-dial-time]");
      var readStatus = dialFigure && dialFigure.querySelector("[data-dial-status]");
      var readPlace = dialFigure && dialFigure.querySelector("[data-dial-place]");
      var you = dialFigure && dialFigure.querySelector("[data-dial-you]");
      var hands = svg && svg.querySelector("[data-dial-hands]");
      var nightDay = null, pointing = null;
      var drawNight = function (now) {
        var night = svg.querySelector("[data-dial-night]"), sun = sunTimes(new Date(now.getTime() + KATHMANDU * 6e4)), dots = [];
        for (var r = 72, ring = 0; r <= 152; r += 4.8, ring++) {
          var count = Math.round(2 * Math.PI * r / 4.8);
          for (var k = 0; k < count; k++) {
            var minute = (k + noise(ring, k) * 0.8) / count * 1440, d = darkness(minute, sun);
            if (0.006 + 0.86 * d * d > noise(k, ring)) { var p = at(minute, r + (noise(ring + 7, k) - 0.5) * 3); dots.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="1"/>'); }
          }
        }
        night.innerHTML = dots.join("");
      };
      var render = function () {
        var now = new Date(), minute = kathmanduMinute(now), shown = pointing === null ? minute : pointing;
        if (note) note.textContent = "It’s " + clock(minute) + " for me, so I’m probably " + kathmanduStatus(minute) + ". Email reaches me fastest.";
        if (!svg) return;
        var day = now.getUTCFullYear() * 400 + Math.floor((now.getTime() + KATHMANDU * 6e4) / 864e5);
        if (day !== nightDay) { drawNight(now); nightDay = day; }
        hands.textContent = "";
        hands.appendChild(line(minute, 58, 186, "hand"));
        hands.appendChild(dot(minute, 186, 3.5, "hand-tip"));
        var mine = ((minute - (KATHMANDU - offset)) % 1440 + 1440) % 1440;
        if (pointing !== null) hands.appendChild(line(pointing, 58, 186, "hand ghost"));
        readTime.textContent = clock(shown);
        readPlace.textContent = pointing === null ? "My time, now" : "My time";
        readStatus.textContent = "Probably " + kathmanduStatus(shown);
        if (you) {
          var yours = ((shown - (KATHMANDU - offset)) % 1440 + 1440) % 1440;
          you.hidden = offset === KATHMANDU;
          you.textContent = (pointing === null ? "You " : "Yours ") + clock(yours);
          if (!you.hidden && pointing === null) {
            var p = at(minute - (KATHMANDU - offset), 214);
            you.style.left = (p[0] + 24) / 448 * 100 + "%";
            you.style.top = (p[1] + 24) / 448 * 100 + "%";
            // where the dial fills a narrow screen, a label beside its edge slides back over the face instead of off the page
            var face = you.parentNode.getBoundingClientRect(), r = you.getBoundingClientRect(), room = doc.documentElement.clientWidth;
            var nudge = r.right > room ? Math.min(0, face.right - r.right) : r.left < 0 ? Math.max(0, face.left - r.left) : 0;
            if (nudge) you.style.left = "calc(" + you.style.left + " + " + nudge.toFixed(1) + "px)";
            hands.appendChild(dot(mine, 180, 2.5, "you-tip"));
          }
          you.classList.toggle("is-pointing", pointing !== null);
        }
      };
      if (svg) {
        var aim = function (event) {
          var box = svg.getBoundingClientRect(), x = (event.clientX - box.left) / box.width * 448 - 24 - 200, y = (event.clientY - box.top) / box.height * 448 - 24 - 200;
          if (Math.sqrt(x * x + y * y) < 40) { pointing = null; render(); return; }
          var minute = Math.atan2(-x, y) / (2 * Math.PI) * 1440;
          pointing = Math.round(((minute % 1440) + 1440) % 1440 / 15) * 15 % 1440;
          render();
        };
        svg.addEventListener("pointermove", aim);
        svg.addEventListener("pointerdown", aim);
        svg.addEventListener("pointerleave", function () { pointing = null; render(); });
        dialFigure.classList.add("is-live");
      }
      render();
      win.setInterval(render, 15000);
      win.addEventListener("resize", render);
    }

    /* plates: a screenshot first appears as a stipple drawing in the figure's own ink, then develops into the image
       the first time it is seen; in Gear Two, hovering a plate shows the drawing again, in red */
    var stippled = Array.prototype.slice.call(doc.querySelectorAll(".plate-media > img, .thumb > img"));
    if (stippled.length && win.IntersectionObserver && win.ResizeObserver && !motion.reduced()) {
      var drawStipple = function (img, canvas) {
        var w = canvas.clientWidth, h = canvas.clientHeight;
        if (!w || !h || !img.complete || !img.naturalWidth) return false;
        var dpr = Math.min(win.devicePixelRatio || 1, 2), step = 3, cols = Math.ceil(w / step), rows = Math.ceil(h / step);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        var probe = doc.createElement("canvas");
        probe.width = cols;
        probe.height = rows;
        var pctx = probe.getContext("2d", { willReadFrequently: true });
        pctx.drawImage(img, 0, 0, cols, rows);
        var px = pctx.getImageData(0, 0, cols, rows).data;
        var styles = win.getComputedStyle(doc.documentElement);
        var paper = styles.getPropertyValue("--paper").trim(), darkPaper = parseInt(paper.slice(1, 3), 16) < 128;
        // drawn in software: tens of thousands of arcs on an accelerated canvas queue ahead of the hero's shaders on
        // the GPU, which held its first frame back by seconds on a software renderer
        var ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = styles.getPropertyValue("--figure-ink").trim();
        ctx.beginPath();
        for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) {
          var i = (y * cols + x) * 4, lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255, ink = darkPaper ? lum : 1 - lum;
          if (0.72 * Math.pow(ink, 1.4) > noise(x, y)) {
            var cx = (x + 0.5 + (noise(y, x) - 0.5) * 0.7) * step, cy = (y + 0.5 + (noise(x + 31, y) - 0.5) * 0.7) * step;
            ctx.moveTo(cx + 1.05, cy);
            ctx.arc(cx, cy, 1.05, 0, 2 * Math.PI);
          }
        }
        ctx.fill();
        return true;
      };
      var plates = stippled.map(function (img) {
        var frame = img.parentNode, canvas = doc.createElement("canvas");
        canvas.className = "stipple";
        canvas.setAttribute("aria-hidden", "true");
        frame.appendChild(canvas);
        // the frame holds its drawing from the start (so the canvas never lays out against the page and jumps in),
        // but the photograph gives way to it only once it has actually been drawn
        frame.classList.add("is-stippled");
        var plate = { img: img, frame: frame, canvas: canvas, drawn: false, seen: false };
        plate.draw = function () {
          plate.drawn = drawStipple(img, canvas) || plate.drawn;
          if (plate.drawn) frame.classList.add("is-drawn");
          if (plate.drawn && plate.seen) frame.classList.add("is-developed");
        };
        if (!img.complete) img.addEventListener("load", plate.draw, { once: true });
        return plate;
      });
      var sight = new win.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var plate = plates.filter(function (p) { return p.frame === entry.target; })[0];
          plate.seen = true;
          sight.unobserve(entry.target);
          if (!plate.drawn) plate.draw();
          // A failed or late draw must not leave the photograph wiped. The stipple only hides the image
          // after it has actually been drawn.
          if (plate.drawn) win.setTimeout(function () { plate.frame.classList.add("is-developed"); }, motion.reduced() ? 0 : 120);
          else plate.frame.classList.add("is-developed");
        });
      }, { threshold: 0.35 });
      var sizes = new win.ResizeObserver(function (entries) { entries.forEach(function (entry) { plates.forEach(function (p) { if (p.frame === entry.target) p.draw(); }); }); });
      plates.forEach(function (p) { sight.observe(p.frame); sizes.observe(p.frame); });
      new win.MutationObserver(function () { plates.forEach(function (p) { if (p.seen || p.drawn) p.draw(); }); }).observe(doc.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-gear"] });
      motion.subscribe(function () {
        if (!motion.reduced()) return;
        plates.forEach(function (p) { p.frame.classList.add("is-developed"); });
      });
    }

    /* the construction grid: minor columns and insets drawn over the sheet, and the role, size, and alignment of
       whatever text the pointer rests on; G or either Grid control turns it on for the session */
    var gridToggles = Array.prototype.slice.call(doc.querySelectorAll("[data-grid-toggle]"));
    if (gridToggles.length) {
      var inspect = null;
      var gridOn = function () { return doc.documentElement.getAttribute("data-grid") === "on"; };
      var syncGrid = function () {
        gridToggles.forEach(function (button) {
          button.setAttribute("aria-pressed", gridOn() ? "true" : "false");
          var state = button.querySelector("[data-grid-state]");
          if (state) state.textContent = gridOn() ? "On" : "Off";
        });
        if (!gridOn() && inspect) inspect.hidden = true;
      };
      var setGrid = function (on) {
        if (on) doc.documentElement.setAttribute("data-grid", "on"); else doc.documentElement.removeAttribute("data-grid");
        try { if (on) win.sessionStorage.setItem("sky-grid", "on"); else win.sessionStorage.removeItem("sky-grid"); } catch (e) {}
        syncGrid();
        say(on ? "Construction grid on" : "Construction grid off");
      };
      gridToggles.forEach(function (button) { button.addEventListener("click", function () { setGrid(!gridOn()); }); });
      doc.addEventListener("keydown", function (event) {
        if (event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.metaKey || event.ctrlKey || event.key.toLowerCase() !== "g") return;
        if (event.target.closest && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable=false]), dialog")) return;
        setGrid(!gridOn());
      });
      syncGrid();
      if (win.matchMedia && win.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        inspect = doc.createElement("div");
        inspect.className = "inspect";
        inspect.setAttribute("aria-hidden", "true");
        inspect.hidden = true;
        inspect.innerHTML = '<span class="inspect-tag"></span>';
        doc.body.appendChild(inspect);
        var tag = inspect.firstChild;
        var lines = function () {
          var spans = Array.prototype.filter.call(doc.querySelectorAll("body > .lines > span"), function (el) { return win.getComputedStyle(el).display !== "none"; });
          var majors = spans.map(function (el) { return el.getBoundingClientRect().left; }).concat(spans[spans.length - 1].getBoundingClientRect().right);
          return majors.slice(0, -1).reduce(function (list, x, i) { var w = (majors[i + 1] - x) / 3; return list.concat([[x, "column " + (i + 1)], [x + w, "minor " + (i * 3 + 2)], [x + 2 * w, "minor " + (i * 3 + 3)]]); }, []).concat([[majors[majors.length - 1], "frame"]]);
        };
        var place = function (x) {
          var p = parseFloat(win.getComputedStyle(doc.documentElement).getPropertyValue("--p")), best = null;
          lines().forEach(function (l) { [[l[0], ""], [l[0] + p, " + " + p]].forEach(function (c) { var d = Math.abs(c[0] - x); if (!best || d < best[0]) best = [d, l[1] + c[1]]; }); });
          return best[0] <= 0.5 ? best[1] : Math.round(x) + " px";
        };
        doc.addEventListener("pointerover", function (event) {
          if (!gridOn()) return;
          var el = event.target.closest && event.target.closest("main h1, main h2, main h3, main p, main li > span, main dt, main dd, main figcaption > span, footer p, footer button, main .plate-line");
          if (!el) { inspect.hidden = true; return; }
          var box = el.getBoundingClientRect(), cs = win.getComputedStyle(el);
          var size = Math.round(parseFloat(cs.fontSize)), lh = Math.round(parseFloat(cs.lineHeight)) || size, mono = /Fragment/.test(cs.fontFamily);
          tag.textContent = typeRole(size, lh, mono) + " · " + size + "/" + lh + " · " + (mono ? "Fragment Mono" : "Instrument Sans " + cs.fontWeight) + " · " + place(box.left + parseFloat(cs.paddingLeft));
          inspect.style.transform = "translate(" + box.left + "px, " + box.top + "px)";
          inspect.style.width = box.width + "px";
          inspect.style.height = box.height + "px";
          inspect.hidden = false;
        });
        win.addEventListener("scroll", function () { if (inspect) inspect.hidden = true; }, { passive: true });
      }
    }

    /* reveals: graphics that draw in the first time they come into view (text is never hidden) */
    var reveals = Array.prototype.slice.call(doc.querySelectorAll("[data-reveal]"));
    if (reveals.length && win.IntersectionObserver) {
      var seen = new win.IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-seen");
          seen.unobserve(entry.target);
        });
      }, { threshold: 0.2 });
      reveals.forEach(function (el) { seen.observe(el); });
      motion.subscribe(function () {
        if (motion.reduced()) reveals.forEach(function (el) { el.classList.add("is-seen"); });
      });
    } else reveals.forEach(function (el) { el.classList.add("is-seen"); });

    return { hero: hero };
  }

  var api = { filterRows: filterRows, themeFromSearch: themeFromSearch, queryFromSearch: queryFromSearch, searchFor: searchFor, matchesQuery: matchesQuery, activeSection: activeSection, kathmanduTime: kathmanduTime, kathmanduMinute: kathmanduMinute, kathmanduStatus: kathmanduStatus, timeGap: timeGap, sunTimes: sunTimes, darkness: darkness, typeRole: typeRole, THEMES: THEMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    global.SkyPage = api;
    boot(document, global);
  }
})(typeof window !== "undefined" ? window : globalThis);
