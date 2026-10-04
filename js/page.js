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
    var m = /[?&]theme=([^&]+)/.exec(search || "");
    var value = m ? decodeURIComponent(m[1]) : "all";
    return THEMES.indexOf(value) >= 0 ? value : "all";
  }

  function searchFor(theme) { return theme === "all" ? "" : "?theme=" + encodeURIComponent(theme); }

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
      if (!button || !win.navigator.clipboard) return;
      win.navigator.clipboard.writeText(button.getAttribute("data-copy")).then(function () {
        button.textContent = "Copied";
        say("Email address copied");
        win.setTimeout(function () { button.textContent = "Copy"; }, 1600);
      }, function () {});
    });

    /* /work filter */
    var filters = doc.querySelector("[data-filters]");
    if (filters) {
      var rows = Array.prototype.slice.call(doc.querySelectorAll(".project"));
      var buttons = Array.prototype.slice.call(filters.querySelectorAll("[data-filter]"));
      var count = doc.querySelector("[data-count]");
      var apply = function (theme, push) {
        var result = filterRows(rows.map(function (r) { return (r.getAttribute("data-themes") || "").split(" "); }), theme);
        rows.forEach(function (row, i) { row.hidden = !result.shown[i]; });
        buttons.forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-filter") === result.theme ? "true" : "false"); });
        var n = result.shown.filter(Boolean).length;
        if (count) count.textContent = pad(n);
        if (push) {
          win.history.replaceState(null, "", win.location.pathname + searchFor(result.theme));
          var label = result.theme === "all" ? "all themes" : buttons.filter(function (b) { return b.getAttribute("data-filter") === result.theme; })[0].firstChild.textContent.trim();
          say(n + " projects shown for " + label);
        }
      };
      buttons.forEach(function (b) { b.addEventListener("click", function () { apply(b.getAttribute("data-filter"), true); }); });
      apply(themeFromSearch(win.location.search), false);
      doc.documentElement.removeAttribute("data-filter");
    }

    /* case-study section index */
    var toc = doc.querySelector(".toc");
    if (toc) {
      var links = Array.prototype.slice.call(toc.querySelectorAll("a"));
      var sections = links.map(function (a) { return doc.getElementById(a.getAttribute("href").slice(1)); });
      var queued = false;
      var spy = function () {
        queued = false;
        var tops = sections.map(function (s) { return s ? s.getBoundingClientRect().top : Infinity; });
        var current = activeSection(tops, win.innerHeight * 0.35);
        links.forEach(function (a, i) { if (i === current) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
      };
      win.addEventListener("scroll", function () { if (!queued) { queued = true; win.requestAnimationFrame(spy); } }, { passive: true });
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

  var api = { filterRows: filterRows, themeFromSearch: themeFromSearch, searchFor: searchFor, activeSection: activeSection, kathmanduTime: kathmanduTime, THEMES: THEMES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    global.SkyPage = api;
    boot(document, global);
  }
})(typeof window !== "undefined" ? window : globalThis);
