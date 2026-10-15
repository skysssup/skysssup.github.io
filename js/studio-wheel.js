/* Studio wheel: a cyclic curved rail of project tiles.
   Geometry matches the observed desktop rail (230×579 window, 150×94 tile).
   Motion is an analytic critically damped spring. Frames are scheduled only while
   it is moving; a short timer still samples that solution if rAF never fires.
   Hidden, offscreen, paused, and reduced-motion requests commit immediately. */
(function (factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.SkyStudioWheel = api;
})(function () {
  "use strict";

  var GEOMETRY = {
    windowWidth: 230,
    windowHeight: 579,
    tileWidth: 150,
    tileHeight: 94,
    x: 3,
    radius: 940,
    theta: 0.085,
    scaleDrop: 0.36
  };

  var SPRING = { omega: 17, epsilon: 0.001, velocityEpsilon: 0.005 };
  var SNAP_MS = 140;
  var DRAG_PX = 5;
  var WATCH_MS = 50;

  function mod(value, count) {
    if (!count) return 0;
    return ((value % count) + count) % count;
  }

  function wrapDelta(item, position, count) {
    if (!count) return 0;
    var raw = item - position;
    var turns = Math.floor((raw + count / 2) / count);
    return raw - count * turns;
  }

  function nearestTarget(position, index, count) {
    if (!count) return 0;
    var base = mod(Math.round(index), count);
    var turn = Math.round((position - base) / count);
    return base + turn * count;
  }

  function selectedIndex(position, count) {
    if (!count) return 0;
    return mod(Math.round(position), count);
  }

  function projectPose(delta, height) {
    var theta = GEOMETRY.theta * delta;
    var span = Number(height);
    if (!Number.isFinite(span) || span <= 0) span = GEOMETRY.windowHeight;
    return {
      x: GEOMETRY.x + GEOMETRY.radius * (1 - Math.cos(theta)),
      y: (span - GEOMETRY.tileHeight) / 2 + GEOMETRY.radius * Math.sin(theta),
      rotation: -theta === 0 ? 0 : -theta,
      scale: 1 - GEOMETRY.scaleDrop * Math.min(Math.abs(delta), 1),
      delta: delta
    };
  }

  function project(position, count, height) {
    var poses = [];
    var n = count | 0;
    for (var i = 0; i < n; i++) poses.push(projectPose(wrapDelta(i, position, n), height));
    return {
      position: position,
      selected: selectedIndex(position, n),
      height: Number.isFinite(height) && height > 0 ? height : GEOMETRY.windowHeight,
      poses: poses
    };
  }

  function stepSpring(state, seconds, omega) {
    var w = Number(omega);
    if (!Number.isFinite(w) || w <= 0) w = SPRING.omega;
    var position = state.position;
    var velocity = state.velocity;
    var target = state.target;
    var dt = Number(seconds);
    if (!Number.isFinite(dt) || dt <= 0) {
      return finishSpring(position, velocity, target);
    }
    var offset = position - target;
    var c = velocity + w * offset;
    var decay = Math.exp(-w * dt);
    position = target + (offset + c * dt) * decay;
    velocity = (velocity - w * c * dt) * decay;
    if (!Number.isFinite(position) || !Number.isFinite(velocity)) {
      return { position: target, velocity: 0, target: target, settled: true };
    }
    return finishSpring(position, velocity, target);
  }

  function finishSpring(position, velocity, target) {
    if (Math.abs(position - target) <= SPRING.epsilon && Math.abs(velocity) <= SPRING.velocityEpsilon) {
      return { position: target, velocity: 0, target: target, settled: true };
    }
    return { position: position, velocity: velocity, target: target, settled: false };
  }

  function aim(state, index, count, reduced) {
    var target = nearestTarget(state.position, index, count);
    if (reduced) return { position: target, velocity: 0, target: target, settled: true };
    var next = { position: state.position, velocity: state.velocity, target: target, settled: false };
    return finishSpring(next.position, next.velocity, target);
  }

  function mount(root, options) {
    if (!root || typeof root.querySelectorAll !== "function") {
      throw new TypeError("SkyStudioWheel.mount needs a root element");
    }
    options = options || {};
    var doc = root.ownerDocument || document;
    var view = doc.defaultView || (typeof window !== "undefined" ? window : null);
    var items = [];
    var buttons = [];
    var position = 0;
    var velocity = 0;
    var goal = 0;
    var requested = 0;
    var shown = -1;
    var height = GEOMETRY.windowHeight;
    var motion = null;
    var gesture = "api";
    var announceFlag = false;
    var focusOnChange = false;
    var focusOnce = false;
    var paused = false;
    var visible = true;
    var drag = null;
    var suppressClick = false;
    var snapTimer = 0;
    var rafId = 0;
    var watchId = 0;
    var destroyed = false;
    var wheelWindow = root.querySelector(".studio-wheel-window");
    var list = root.querySelector('ul[role="listbox"]') || root.querySelector("[role='listbox']");

    function pitch() { return GEOMETRY.radius * GEOMETRY.theta; }

    function isReduced() {
      return !!(options.reduced && options.reduced());
    }

    function clock() {
      var perf = view && view.performance;
      return perf && perf.now ? perf.now() : Date.now();
    }

    function readItems() {
      items = Array.prototype.slice.call(root.querySelectorAll("li[data-studio-item]"));
      buttons = items.map(function (item) {
        return item.querySelector("[data-studio-pick]");
      });
    }

    function measure() {
      var el = wheelWindow || root;
      var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      var next = rect && rect.height ? rect.height : (el.clientHeight || 0);
      if (next > 0) height = next;
    }

    function docHidden() {
      return !!(doc.hidden || doc.visibilityState === "hidden");
    }

    function holdStill() {
      if (paused || docHidden()) return true;
      if (!visible) return true;
      if (!geometricallyVisible()) {
        visible = false;
        return true;
      }
      return false;
    }

    function geometricallyVisible() {
      if (docHidden()) return false;
      var el = wheelWindow || root;
      if (!el.getBoundingClientRect || !view) return true;
      var rect = el.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      var vw = view.innerWidth || 0;
      var vh = view.innerHeight || 0;
      if (!vw || !vh) return false;
      return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
    }

    function elementOf(node) {
      if (!node) return null;
      return node.nodeType === 1 ? node : node.parentElement;
    }

    function editable(node) {
      var el = elementOf(node);
      if (!el || !el.closest) return false;
      return !!el.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']");
    }

    function overWheel(event) {
      var el = elementOf(event.target);
      if (el && el.closest && (wheelWindow && wheelWindow.contains(el) || (list && list.contains(el)))) return true;
      if (!wheelWindow || !wheelWindow.getBoundingClientRect || event.clientX == null) return false;
      var rect = wheelWindow.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
    }

    function count() { return items.length; }

    function transformOf(pose) {
      var ox = GEOMETRY.tileWidth / 2;
      var oy = GEOMETRY.tileHeight / 2;
      return "translate(" + (pose.x + ox) + "px, " + (pose.y + oy) + "px) rotate(" + pose.rotation + "rad) scale(" + pose.scale + ") translate(" + (-ox) + "px, " + (-oy) + "px)";
    }

    function syncSelection(index) {
      var n = count();
      for (var i = 0; i < n; i++) {
        var on = i === index;
        var item = items[i];
        item.setAttribute("role", "none");
        if (item.classList) item.classList.toggle("is-active", on);
        var button = buttons[i];
        if (button) {
          button.setAttribute("role", "option");
          button.setAttribute("aria-selected", on ? "true" : "false");
          button.classList.toggle("is-active", on);
          button.tabIndex = on ? 0 : -1;
        }
      }
      root.setAttribute("data-selected", String(index));
      if (list && !list.getAttribute("role")) list.setAttribute("role", "listbox");
    }

    function focusSelected(index) {
      var button = buttons[index];
      if (!button || typeof button.focus !== "function") return;
      try { button.focus({ preventScroll: true }); }
      catch (error) { button.focus(); }
    }

    function paint() {
      if (destroyed) return;
      var n = count();
      var frame = project(position, n, height);
      for (var i = 0; i < n; i++) {
        items[i].style.transform = transformOf(frame.poses[i]);
        items[i].style.transformOrigin = "0 0";
        items[i].style.transition = "none";
      }
      var previous = shown;
      if (frame.selected !== shown && n) {
        shown = frame.selected;
        syncSelection(shown);
        if (options.onSelect) options.onSelect(shown, { input: gesture, announce: !!announceFlag });
      }
      if (focusOnChange && n) {
        var arrived = frame.selected === requested && !motion && !drag && !snapTimer;
        if (frame.selected !== previous || (focusOnce && arrived)) focusSelected(frame.selected);
        focusOnce = false;
        if (arrived) focusOnChange = false;
      }
      if (options.onPose) options.onPose(frame);
    }

    function stopLoops() {
      if (rafId && view && view.cancelAnimationFrame) view.cancelAnimationFrame(rafId);
      rafId = 0;
      if (watchId && view) view.clearTimeout(watchId);
      watchId = 0;
    }

    function clearSnap() {
      if (snapTimer && view) view.clearTimeout(snapTimer);
      snapTimer = 0;
    }

    function schedule() {
      if (!motion || destroyed || !view) return;
      if (!rafId && view.requestAnimationFrame) rafId = view.requestAnimationFrame(onFrame);
      if (!watchId) watchId = view.setTimeout(onWatch, WATCH_MS);
    }

    function sample() {
      if (!motion) return;
      if (isReduced() || holdStill()) {
        land(motion.target, true);
        return;
      }
      var dt = Math.max(0, (clock() - motion.t0) / 1000);
      var next = stepSpring({ position: motion.p0, velocity: motion.v0, target: motion.target }, dt, SPRING.omega);
      position = next.position;
      velocity = next.velocity;
      if (next.settled) {
        position = motion.target;
        velocity = 0;
        goal = motion.target;
        motion = null;
        stopLoops();
      }
      paint();
      if (motion) schedule();
    }

    function onFrame() {
      rafId = 0;
      sample();
    }

    function onWatch() {
      watchId = 0;
      sample();
    }

    function land(target, announceNow) {
      motion = null;
      clearSnap();
      stopLoops();
      position = target;
      velocity = 0;
      goal = target;
      if (count()) requested = mod(Math.round(target), count());
      if (announceNow) announceFlag = true;
      paint();
    }

    function beginSpring(target) {
      goal = target;
      if (!count()) return;
      if (isReduced() || holdStill()) {
        land(target, false);
        return;
      }
      if (Math.abs(position - target) <= SPRING.epsilon && Math.abs(velocity) <= SPRING.velocityEpsilon) {
        land(target, false);
        return;
      }
      motion = { t0: clock(), p0: position, v0: velocity, target: target };
      schedule();
      paint();
    }

    function commitPending() {
      var target = motion ? motion.target : Math.round(Number.isFinite(goal) ? goal : position);
      if (!motion && drag) target = Math.round(position);
      drag = null;
      land(target, false);
    }

    function set(index, opts) {
      opts = opts || {};
      var n = count();
      if (!n || destroyed) return;
      var numeric = Number(index);
      if (!Number.isFinite(numeric)) numeric = 0;
      requested = mod(Math.round(numeric), n);
      gesture = opts.input || "api";
      announceFlag = !!opts.announce;
      focusOnChange = !!(opts.focus || gesture === "keyboard");
      focusOnce = focusOnChange;
      clearSnap();
      drag = null;
      var aimed = aim({ position: position, velocity: velocity, target: goal }, requested, n, !!(opts.instant || isReduced() || holdStill()));
      if (aimed.settled) land(aimed.target, false);
      else beginSpring(aimed.target);
    }

    function step(delta, opts) {
      var n = count();
      if (!n) return;
      var amount = Number(delta);
      if (!Number.isFinite(amount)) amount = 0;
      set(Math.round(goal) + amount, opts);
    }

    function track(next, kind, withVelocity) {
      gesture = kind;
      announceFlag = false;
      focusOnChange = false;
      focusOnce = false;
      motion = null;
      stopLoops();
      position = next;
      goal = next;
      velocity = Number.isFinite(withVelocity) ? withVelocity : 0;
      paint();
    }

    function queueSnap(kind) {
      clearSnap();
      if (!view) return;
      snapTimer = view.setTimeout(function () {
        snapTimer = 0;
        gesture = kind;
        announceFlag = true;
        var target = Math.round(position);
        velocity = velocity || 0;
        beginSpring(target);
      }, SNAP_MS);
    }

    function wheelUnits(event) {
      var dy = event.deltaY || 0;
      var dx = event.deltaX || 0;
      var raw = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
      if (event.deltaMode === 1) raw *= 16;
      else if (event.deltaMode === 2) raw *= height || GEOMETRY.windowHeight;
      return raw / pitch();
    }

    function onWheel(event) {
      if (destroyed || editable(event.target) || !overWheel(event)) return;
      if (event.ctrlKey) return;
      if (event.preventDefault) event.preventDefault();
      var units = wheelUnits(event);
      if (!units || !count()) return;
      var instant = isReduced() || holdStill();
      track(position + units, "wheel", units);
      if (instant) {
        land(Math.round(position), true);
        return;
      }
      queueSnap("wheel");
    }

    function onPointerDown(event) {
      if (destroyed || editable(event.target) || !overWheel(event)) return;
      if (event.button != null && event.button !== 0) return;
      drag = {
        id: event.pointerId,
        y: event.clientY,
        x: event.clientX,
        origin: position,
        last: position,
        time: clock(),
        active: false
      };
    }

    function onPointerMove(event) {
      if (!drag || (event.pointerId != null && drag.id != null && event.pointerId !== drag.id)) return;
      var dy = event.clientY - drag.y;
      var dx = event.clientX - drag.x;
      if (!drag.active && Math.abs(dy) < DRAG_PX && Math.abs(dx) < DRAG_PX) return;
      if (!drag.active && Math.abs(dy) < Math.abs(dx)) return;
      if (!drag.active && wheelWindow && wheelWindow.setPointerCapture && event.pointerId != null) {
        try { wheelWindow.setPointerCapture(event.pointerId); } catch (error) {}
      }
      drag.active = true;
      if (event.preventDefault) event.preventDefault();
      var next = drag.origin - dy / pitch();
      var time = clock();
      var dt = Math.max(0.001, (time - drag.time) / 1000);
      var vel = (next - drag.last) / dt;
      drag.last = next;
      drag.time = time;
      track(next, "pointer", vel);
    }

    function finishDrag(event) {
      if (!drag || (event && event.pointerId != null && drag.id != null && event.pointerId !== drag.id)) return;
      var active = drag.active;
      drag = null;
      if (wheelWindow && wheelWindow.releasePointerCapture && event && event.pointerId != null) {
        try { wheelWindow.releasePointerCapture(event.pointerId); } catch (error) {}
      }
      if (!active) return;
      suppressClick = true;
      gesture = "pointer";
      announceFlag = true;
      if (isReduced() || holdStill()) land(Math.round(position), true);
      else beginSpring(Math.round(position));
    }

    function onClick(event) {
      if (suppressClick) {
        suppressClick = false;
        if (event.preventDefault) event.preventDefault();
        if (event.stopPropagation) event.stopPropagation();
        return;
      }
      var el = elementOf(event.target);
      var pick = el && el.closest ? el.closest("[data-studio-pick]") : null;
      if (!pick || !root.contains(pick)) return;
      var index = parseInt(pick.getAttribute("data-studio-pick"), 10);
      if (!Number.isFinite(index)) return;
      set(index, { input: "pointer", announce: true });
    }

    function onKeyDown(event) {
      if (destroyed || editable(event.target)) return;
      var el = elementOf(event.target);
      var inList = !!(el && list && list.contains(el));
      if (event.key === "Escape") {
        if (event.preventDefault) event.preventDefault();
        if (options.onEscape) options.onEscape();
        return;
      }
      if (!inList) return;
      if (event.key === "Enter") {
        if (event.preventDefault) event.preventDefault();
        if (options.onOpen) options.onOpen(count() ? selectedIndex(position, count()) : 0);
        return;
      }
      var next = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1
        : event.key === "Home" ? "home"
        : event.key === "End" ? "end"
        : null;
      if (next == null) return;
      if (event.preventDefault) event.preventDefault();
      var opts = { input: "keyboard", announce: true, focus: true };
      if (next === "home") set(0, opts);
      else if (next === "end") set(Math.max(0, count() - 1), opts);
      else step(next, opts);
    }

    function onVisibility() {
      visible = !docHidden() && geometricallyVisible();
      if (!visible) commitPending();
    }

    function refresh() {
      if (destroyed) return;
      readItems();
      measure();
      if (count()) {
        requested = mod(requested, count());
        shown = selectedIndex(position, count());
        syncSelection(shown);
      }
      paint();
    }

    function pause() {
      paused = true;
      commitPending();
    }

    function resume() {
      paused = false;
      visible = !docHidden() && geometricallyVisible();
    }

    function destroy() {
      if (destroyed) return;
      destroyed = true;
      motion = null;
      drag = null;
      stopLoops();
      clearSnap();
      root.removeEventListener("wheel", onWheel, true);
      root.removeEventListener("pointerdown", onPointerDown, true);
      root.removeEventListener("pointermove", onPointerMove, true);
      root.removeEventListener("pointerup", finishDrag, true);
      root.removeEventListener("pointercancel", finishDrag, true);
      root.removeEventListener("click", onClick, true);
      root.removeEventListener("keydown", onKeyDown);
      doc.removeEventListener("visibilitychange", onVisibility);
      if (view) view.removeEventListener("resize", refresh);
      if (resizeObserver) resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
    }

    readItems();
    measure();
    var n0 = count();
    var initial = Number(options.initial);
    if (!Number.isFinite(initial)) initial = 0;
    requested = n0 ? mod(Math.round(initial), n0) : 0;
    position = n0 ? nearestTarget(requested, requested, n0) : 0;
    goal = position;
    shown = n0 ? selectedIndex(position, n0) : 0;
    if (n0) syncSelection(shown);
    visible = geometricallyVisible();
    if (wheelWindow) wheelWindow.style.touchAction = "none";
    paint();

    root.addEventListener("wheel", onWheel, { passive: false, capture: true });
    root.addEventListener("pointerdown", onPointerDown, true);
    root.addEventListener("pointermove", onPointerMove, true);
    root.addEventListener("pointerup", finishDrag, true);
    root.addEventListener("pointercancel", finishDrag, true);
    root.addEventListener("click", onClick, true);
    root.addEventListener("keydown", onKeyDown);
    doc.addEventListener("visibilitychange", onVisibility);
    if (view) view.addEventListener("resize", refresh);

    var resizeObserver = null;
    var intersectionObserver = null;
    if (view && view.ResizeObserver) {
      resizeObserver = new view.ResizeObserver(function () { refresh(); });
      resizeObserver.observe(wheelWindow || root);
    }
    if (view && view.IntersectionObserver) {
      intersectionObserver = new view.IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        var on = !!(entry && entry.isIntersecting) && !docHidden();
        if (on === visible) return;
        visible = on;
        if (!on) commitPending();
      });
      intersectionObserver.observe(wheelWindow || root);
    }
    if (!visible) commitPending();

    return {
      set: set,
      step: step,
      selected: function () { return count() ? selectedIndex(position, count()) : 0; },
      position: function () { return position; },
      settled: function () {
        // A settled spring can still have a queued resize observation.
        var measured = (wheelWindow || root).getBoundingClientRect().height;
        if (visible && geometricallyVisible() && measured > 0 && Math.abs(measured - height) >= 1) return false;
        return !motion && !snapTimer && !drag && Math.abs(position - goal) <= SPRING.epsilon && Math.abs(velocity) <= SPRING.velocityEpsilon;
      },
      refresh: refresh,
      pause: pause,
      resume: resume,
      destroy: destroy
    };
  }

  return {
    GEOMETRY: GEOMETRY,
    SPRING: SPRING,
    wrapDelta: wrapDelta,
    nearestTarget: nearestTarget,
    selectedIndex: selectedIndex,
    project: project,
    stepSpring: stepSpring,
    aim: aim,
    mount: mount
  };
});
