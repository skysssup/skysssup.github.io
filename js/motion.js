/* Motion: the site-wide reduced-motion preference, Gear Two, the circle theme reveal,
   smooth scrolling, and cross-page transitions. */
(function (global) {
  "use strict";

  // Gear Two timing (ms): flash, then the palette switches and glitches, then it settles.
  var GEAR = { flash: 90, settle: 650, done: 1050, exit: 300 };

  function init(env) {
    var doc = env.document, win = env.window, storage = env.storage, session = env.session;
    var later = env.setTimeout, cancel = env.clearTimeout;
    var root = doc.documentElement;
    var osReduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    var subscribers = [];
    var timers = [];
    var gearOn = root.getAttribute("data-gear") === "two";
    var smoother = null;

    /* motion preference: an explicit choice on the site wins over the OS setting */
    function choice() {
      try {
        var value = storage.getItem("sky-motion");
        if (value === "reduced" || value === "full") return value;
      } catch (e) {}
      return memo;
    }
    var memo = null;
    function reduced() {
      var c = choice();
      return c ? c === "reduced" : !!osReduced.matches;
    }
    function applyMotion() {
      var r = reduced();
      if (r) root.setAttribute("data-motion", "reduced");
      else root.removeAttribute("data-motion");
      var toggles = doc.querySelectorAll("[data-motion-toggle]");
      for (var i = 0; i < toggles.length; i++) {
        toggles[i].setAttribute("aria-pressed", r ? "true" : "false");
        var state = toggles[i].querySelector("[data-motion-state]");
        if (state) state.textContent = r ? "On" : "Off";
      }
      syncSmoother();
      for (var j = 0; j < subscribers.length; j++) subscribers[j]();
    }
    function setMotion(mode) {
      memo = mode;
      try { storage.setItem("sky-motion", mode); } catch (e) {}
      applyMotion();
    }
    var motion = {
      reduced: reduced,
      subscribe: function (fn) { subscribers.push(fn); },
      set: setMotion
    };

    /* smooth scrolling */
    function syncSmoother() {
      if (!reduced() && !smoother && win.Lenis) {
        // Anchor links land where the native jump would: Lenis reads the root's scroll-padding-top.
        smoother = new win.Lenis({
          autoRaf: true,
          lerp: 0.1,
          anchors: true,
          prevent: function (node) { return !!(node && node.closest && node.closest("[data-lenis-prevent]")); }
        });
      } else if (reduced() && smoother) {
        smoother.destroy();
        smoother = null;
      }
    }

    /* Gear Two */
    function clearPhases() {
      timers.forEach(cancel);
      timers = [];
      root.removeAttribute("data-phase");
    }
    function setGear(on) {
      gearOn = on;
      if (on) root.setAttribute("data-gear", "two");
      else root.removeAttribute("data-gear");
      try {
        if (on) session.setItem("sky-gear", "two");
        else session.removeItem("sky-gear");
      } catch (e) {}
      var buttons = doc.querySelectorAll("[data-gear-toggle]");
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      if (win.skyTheme) win.skyTheme.paint();
    }
    function at(ms, fn) { timers.push(later(fn, ms)); }
    function toggleGear() {
      clearPhases();
      var next = !gearOn;
      if (reduced()) { setGear(next); return; }
      if (next) {
        root.setAttribute("data-phase", "flash");
        at(GEAR.flash, function () { setGear(true); root.setAttribute("data-phase", "glitch"); });
        at(GEAR.settle, function () { root.setAttribute("data-phase", "settle"); });
        at(GEAR.done, clearPhases);
      } else {
        root.setAttribute("data-phase", "glitch");
        at(GEAR.exit, function () { setGear(false); clearPhases(); });
      }
    }

    /* light switch: a soft circle grows from the switch (View Transitions where available) */
    win.skyThemeTransition = function (apply, current, origin) {
      var target = gearOn ? "light" : current === "dark" ? "light" : "dark";
      var run = function () {
        clearPhases();
        if (gearOn) setGear(false);
        apply(target);
      };
      if (reduced() || typeof doc.startViewTransition !== "function" || !origin) { run(); return; }
      var rect = origin.getBoundingClientRect();
      var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      var w = win.innerWidth, h = win.innerHeight;
      var reach = Math.hypot(Math.max(x, w - x), Math.max(y, h - y)) * 2.6;
      root.classList.add("theme-reveal");
      var transition = doc.startViewTransition(run);
      transition.ready.then(function () {
        root.animate({
          maskSize: ["0px 0px", reach + "px " + reach + "px"],
          maskPosition: [x + "px " + y + "px", (x - reach / 2) + "px " + (y - reach / 2) + "px"]
        }, { duration: 850, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "forwards", pseudoElement: "::view-transition-new(root)" });
      }).catch(function () {});
      var done = function () { root.classList.remove("theme-reveal"); };
      if (transition.finished && transition.finished.then) transition.finished.then(done, done);
      else done();
    };

    doc.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      if (t.closest("[data-gear-toggle]")) toggleGear();
      else if (t.closest("[data-motion-toggle]")) setMotion(reduced() ? "full" : "reduced");
    });

    if (typeof osReduced.addEventListener === "function") osReduced.addEventListener("change", applyMotion);

    // Cross-document transitions are declared in CSS; skip them when motion is reduced on the site.
    var skip = function (event) { if (event.viewTransition && reduced()) event.viewTransition.skipTransition(); };
    win.addEventListener("pageswap", skip);
    win.addEventListener("pagereveal", skip);

    setGear(gearOn);
    applyMotion();

    var api = { motion: motion, setGear: setGear, toggleGear: toggleGear, isGear: function () { return gearOn; }, GEAR: GEAR };
    win.SkyMotion = motion;
    win.skyGear = api;
    return api;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { init: init, GEAR: GEAR };
  else init({ document: document, window: global, storage: global.localStorage, session: global.sessionStorage, setTimeout: global.setTimeout.bind(global), clearTimeout: global.clearTimeout.bind(global) });
})(typeof window !== "undefined" ? window : globalThis);
