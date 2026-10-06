/* Motion: the site-wide reduced-motion preference, the gears (Gear Two and Tide), the circle theme reveal,
   smooth scrolling, and cross-page transitions. */
(function (global) {
  "use strict";

  // Gear Two timing (ms): flash, then the palette switches and glitches, then it settles.
  var GEAR = { flash: 90, settle: 420, done: 720, exit: 220 };
  // Tide timing (ms): the surge, in which the palette turns at `palette` and a non-hit-testing ring floods out
  // from the control for `flood`. The live page changes underneath. There is no root snapshot.
  var BLUE = { palette: 120, flood: 640, ease: "cubic-bezier(.22, .61, .36, 1)", done: 760, exit: 220 };
  // Gear Two heartbeat period (s); the same constant lives in the hero's heartbeat() and in the CSS keyframes.
  var BEAT = 0.9;
  // Tide's period (s): the slow tide that takes the heartbeat's place in the blue gear, in CSS and in the hero.
  var TIDE = 4.5;

  // A gear is "two" (Gear Two, red), "blue" (Tide), or null; true and false still mean Gear Two and none.
  function modeOf(value) { return value === true || value === "two" ? "two" : value === "blue" ? "blue" : null; }

  function init(env) {
    var doc = env.document, win = env.window, storage = env.storage, session = env.session;
    var later = env.setTimeout, cancel = env.clearTimeout;
    var root = doc.documentElement;
    var osReduced = win.matchMedia("(prefers-reduced-motion: reduce)");
    var subscribers = [];
    var timers = [];
    // the gear the page is in, the one a running switch is heading for, and which switch that is (a view
    // transition's callback runs late, and does nothing once another switch has started)
    var mode = modeOf(root.getAttribute("data-gear")), heading = mode, seq = 0;
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
      if (r) {
        root.setAttribute("data-motion", "reduced");
        // An already-running reveal must end. CSS duration 0 does not cancel a view-transition snapshot.
        finishNow();
      } else root.removeAttribute("data-motion");
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

    /* the gears: Gear Two (red) and Tide (blue) */
    function clearPhases() {
      timers.forEach(cancel);
      timers = [];
      root.removeAttribute("data-phase");
    }
    function dropOverlays() {
      if (!doc.querySelectorAll) return;
      var nodes = doc.querySelectorAll(".fx-flood, .fx-tide, .fx-ring");
      for (var i = 0; i < nodes.length; i++) if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
    }
    // Commit the gear the visitor already asked for and throw away the ceremony.
    function finishNow() {
      clearPhases();
      seq++;
      dropOverlays();
      root.classList.remove("theme-reveal");
      root.classList.remove("tide-reveal");
      root.classList.remove("tide-ebb");
      if (heading !== mode) setGear(heading);
    }
    // Gear Two's heartbeat (0.9 s) and Tide's tide (4.5 s) run on the hero's clock (performance.now). CSS animations
    // that pulse with them start from the same phase through --beat-delay and --tide-delay, so the page and the dots agree.
    function syncClock(name, period) {
      if (!root.style || typeof root.style.setProperty !== "function" || !win.performance) return;
      root.style.setProperty(name, (-((win.performance.now() / 1000) % period)).toFixed(3) + "s");
    }
    // The positions in the header show the gear a switch is heading for at once, so the knob moves as it is pressed.
    function press(gear) {
      [["[data-gear-toggle]", "two"], ["[data-gear-blue]", "blue"]].forEach(function (position) {
        var buttons = doc.querySelectorAll(position[0]);
        for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute("aria-pressed", gear === position[1] ? "true" : "false");
      });
    }
    // `transient` keeps the switch out of the session: the hero's opening switches Gear Two on and back off by itself,
    // so a visitor who leaves in the middle does not carry it to the next page, and a gear chosen by hand stays saved.
    function setGear(gear, transient) {
      mode = heading = modeOf(gear);
      if (mode) root.setAttribute("data-gear", mode);
      else root.removeAttribute("data-gear");
      if (mode === "two") syncClock("--beat-delay", BEAT);
      if (mode === "blue") syncClock("--tide-delay", TIDE);
      if (!transient) {
        try {
          if (mode) session.setItem("sky-gear", mode);
          else session.removeItem("sky-gear");
        } catch (e) {}
      }
      press(mode);
      if (win.skyTheme) win.skyTheme.paint();
    }
    function at(ms, fn) { timers.push(later(fn, ms)); }
    function canDraw() { return !!doc.body && typeof doc.createElement === "function"; }
    function centre(origin) {
      if (!origin || typeof origin.getBoundingClientRect !== "function") return null;
      var rect = origin.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return { x: x, y: y, far: Math.hypot(Math.max(x, win.innerWidth - x), Math.max(y, win.innerHeight - y)) };
    }
    // A ring `reach` across, centred on the control: Gear Two's red shockwave, or Tide's light.
    function ring(c, reach, name) {
      var el = doc.createElement("span");
      el.className = name;
      el.setAttribute("aria-hidden", "true");
      el.style.pointerEvents = "none";
      el.style.left = c.x + "px";
      el.style.top = c.y + "px";
      el.style.setProperty("--reach", Math.round(reach) + "px");
      var done = function () { if (el.parentNode) el.parentNode.removeChild(el); };
      el.addEventListener("animationend", done);
      later(done, 1400);
      doc.body.appendChild(el);
    }
    // A red ring expands from the control that switched Gear Two on and fades as it leaves the viewport.
    function shockwave(origin) {
      var c = centre(origin);
      if (c && canDraw()) ring(c, c.far * 2 + 48, "fx-ring");
    }
    // The live page changes immediately. A circle of light grows from the control and does not hit-test,
    // so a second press still reaches the real button. A root view-transition snapshot used to cover the
    // hero and swallow that press; navigation transitions are left alone.
    function reveal(origin, apply, ms, tide, then) {
      apply();
      var c = centre(origin);
      if (reduced() || !c || !canDraw()) return false;
      var reach = c.far * 2.6;
      ring(c, tide ? reach * 0.96 : reach, tide ? "fx-tide" : "fx-flood");
      if (then) then(c, reach);
      return true;
    }
    function flood(origin, apply, run) {
      if (run !== seq) return;
      reveal(origin, apply, BLUE.flood, true);
    }
    function fade(apply) {
      apply();
    }
    // Runs the sequence towards `gear` from `origin` (the control pressed; its rings leave it): Gear Two's flash and
    // glitch, Tide's surge, or the way out of the gear that is on (the glitch, or Tide's ebb). Switching straight
    // between the gears runs the new gear's entrance. A sequence still running is cancelled first, and nothing more
    // happens when the page is already in the gear it is asked for.
    function switchGear(gear, origin, transient) {
      var next = modeOf(gear), run = ++seq;
      clearPhases();
      heading = next;
      press(next);
      if (next === mode) return;
      if (reduced()) { setGear(next, transient); return; }
      if (next === "two") {
        shockwave(origin);
        root.setAttribute("data-phase", "flash");
        at(GEAR.flash, function () { setGear("two", transient); root.setAttribute("data-phase", "glitch"); });
        at(GEAR.settle, function () { root.setAttribute("data-phase", "settle"); });
        at(GEAR.done, clearPhases);
      } else if (next === "blue") {
        root.setAttribute("data-phase", "surge");
        at(BLUE.palette, function () { flood(origin, function () { if (run === seq) setGear("blue", transient); }, run); });
        at(BLUE.done, clearPhases);
      } else if (mode === "blue") {
        root.setAttribute("data-phase", "ebb");
        at(BLUE.exit, function () { fade(function () { if (run === seq) { setGear(null, transient); clearPhases(); } }); });
      } else {
        root.setAttribute("data-phase", "glitch");
        at(GEAR.exit, function () { setGear(null, transient); clearPhases(); });
      }
    }
    // A press on a gear's position engages that gear, and a press on the engaged one (or on the one a switch is
    // heading for) returns to neutral. Without a gear named, it is Gear Two's.
    function toggleGear(origin, which) {
      var gear = which ? modeOf(which) : "two";
      switchGear(heading === gear ? null : gear, origin);
    }

    /* light switch: a soft circle grows from the switch (View Transitions where available); it leaves either gear */
    win.skyThemeTransition = function (apply, current, origin) {
      var target = mode || heading ? "light" : current === "dark" ? "light" : "dark";
      reveal(origin, function () {
        clearPhases();
        seq++;
        if (mode || heading) setGear(null);
        apply(target);
      }, 850);
    };

    doc.addEventListener("click", function (event) {
      var t = event.target;
      if (!t || !t.closest) return;
      var two = t.closest("[data-gear-toggle]"), blue = !two && t.closest("[data-gear-blue]");
      if (two) toggleGear(two, "two");
      else if (blue) toggleGear(blue, "blue");
      else if (t.closest("[data-motion-toggle]")) setMotion(reduced() ? "full" : "reduced");
    });

    if (typeof osReduced.addEventListener === "function") osReduced.addEventListener("change", applyMotion);

    // Cross-document transitions are declared in CSS; skip them when motion is reduced on the site.
    var skip = function (event) { if (event.viewTransition && reduced()) event.viewTransition.skipTransition(); };
    win.addEventListener("pageswap", skip);
    win.addEventListener("pagereveal", skip);

    setGear(mode);
    applyMotion();

    var api = {
      motion: motion, setGear: setGear, toggleGear: toggleGear, switchGear: switchGear,
      isGear: function () { return !!mode; }, mode: function () { return mode; },
      GEAR: GEAR, BLUE: BLUE, BEAT: BEAT, TIDE: TIDE
    };
    win.SkyMotion = motion;
    win.skyGear = api;
    return api;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { init: init, GEAR: GEAR, BLUE: BLUE, BEAT: BEAT, TIDE: TIDE };
  else init({ document: document, window: global, storage: global.localStorage, session: global.sessionStorage, setTimeout: global.setTimeout.bind(global), clearTimeout: global.clearTimeout.bind(global) });
})(typeof window !== "undefined" ? window : globalThis);
