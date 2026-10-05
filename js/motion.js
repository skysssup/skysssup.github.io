/* Motion: the site-wide reduced-motion preference, Gear Two, the circle theme reveal,
   smooth scrolling, and cross-page transitions. */
(function (global) {
  "use strict";

  // Gear Two timing (ms): flash, then the palette switches and glitches, then it settles.
  var GEAR = { flash: 90, settle: 650, done: 1050, exit: 300 };
  // Gear Two heartbeat period (s); the same constant lives in the hero's heartbeat() and in the CSS keyframes.
  var BEAT = 0.9;

  function init(env) {
    var doc = env.document, win = env.window, storage = env.storage, session = env.session;
    var later = env.setTimeout, cancel = env.clearTimeout;
    var root = doc.documentElement;
    var osReduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    var subscribers = [];
    var timers = [];
    var gearOn = root.getAttribute("data-gear") === "two";
    var smoother = null;
    var scrollLocked = false;

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
        toggles[i].setAttribute("aria-label", "Reduce motion " + (r ? "On" : "Off"));
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
      set: setMotion,
      setScrollLocked: function (locked) {
        scrollLocked = locked;
        if (smoother) smoother[locked ? "stop" : "start"]();
      }
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
        if (scrollLocked) smoother.stop();
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
    // Gear Two's heartbeat beats every 0.9 s on the hero's clock (performance.now). CSS animations that
    // pulse with it start from the same phase through --beat-delay, so the glow, the button, and the dots agree.
    function syncBeat() {
      if (!root.style || typeof root.style.setProperty !== "function" || !win.performance) return;
      root.style.setProperty("--beat-delay", (-((win.performance.now() / 1000) % BEAT)).toFixed(3) + "s");
    }
    // `transient` keeps Gear Two out of the session: the hero's opening switches it on and back off by itself, so a
    // visitor who leaves in the middle does not carry it to the next page.
    function setGear(on, transient) {
      gearOn = on;
      if (on) { root.setAttribute("data-gear", "two"); syncBeat(); }
      else root.removeAttribute("data-gear");
      try {
        if (!on) session.removeItem("sky-gear");
        else if (!transient) session.setItem("sky-gear", "two");
      } catch (e) {}
      var buttons = doc.querySelectorAll("[data-gear-toggle]");
      for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      if (win.skyTheme) win.skyTheme.paint();
    }
    function at(ms, fn) { timers.push(later(fn, ms)); }
    // A red ring expands from the control that switched Gear Two on and fades as it leaves the viewport.
    function shockwave(origin) {
      if (!origin || !doc.body || typeof doc.createElement !== "function" || typeof origin.getBoundingClientRect !== "function") return;
      var rect = origin.getBoundingClientRect();
      var x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      var reach = Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y)) * 2 + 48;
      var ring = doc.createElement("span");
      ring.className = "fx-ring";
      ring.setAttribute("aria-hidden", "true");
      ring.style.left = x + "px";
      ring.style.top = y + "px";
      ring.style.setProperty("--reach", Math.round(reach) + "px");
      var done = function () { if (ring.parentNode) ring.parentNode.removeChild(ring); };
      ring.addEventListener("animationend", done);
      later(done, 1400);
      doc.body.appendChild(ring);
    }
    // Runs the sequence towards `on` from `origin` (the ring leaves it); a sequence still running is cancelled first,
    // and nothing more happens when Gear Two is already where it is asked to be.
    function switchGear(on, origin, transient) {
      clearPhases();
      if (on === gearOn) return;
      if (reduced()) { setGear(on, transient); return; }
      if (on) {
        shockwave(origin);
        root.setAttribute("data-phase", "flash");
        at(GEAR.flash, function () { setGear(true, transient); root.setAttribute("data-phase", "glitch"); });
        at(GEAR.settle, function () { root.setAttribute("data-phase", "settle"); });
        at(GEAR.done, clearPhases);
      } else {
        root.setAttribute("data-phase", "glitch");
        at(GEAR.exit, function () { setGear(false); clearPhases(); });
      }
    }
    function toggleGear(origin) { switchGear(!gearOn, origin); }

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
      var gearButton = t.closest("[data-gear-toggle]");
      if (gearButton) toggleGear(gearButton);
      else if (t.closest("[data-motion-toggle]")) setMotion(reduced() ? "full" : "reduced");
    });

    if (typeof osReduced.addEventListener === "function") osReduced.addEventListener("change", applyMotion);

    // Cross-document transitions are declared in CSS; skip them when motion is reduced on the site.
    var skip = function (event) { if (event.viewTransition && reduced()) event.viewTransition.skipTransition(); };
    win.addEventListener("pageswap", skip);
    win.addEventListener("pagereveal", skip);

    setGear(gearOn);
    applyMotion();

    var api = { motion: motion, setGear: setGear, toggleGear: toggleGear, switchGear: switchGear, isGear: function () { return gearOn; }, GEAR: GEAR, BEAT: BEAT };
    win.SkyMotion = motion;
    win.skyGear = api;
    return api;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { init: init, GEAR: GEAR, BEAT: BEAT };
  else init({ document: document, window: global, storage: global.localStorage, session: global.sessionStorage, setTimeout: global.setTimeout.bind(global), clearTimeout: global.clearTimeout.bind(global) });
})(typeof window !== "undefined" ? window : globalThis);
