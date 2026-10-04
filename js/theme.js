/* Light switch: a saved light/dark choice that follows the OS until set, syncs across tabs,
   and reads as "lights off" while Gear Two is on. The switch's aria-pressed means "lights on". */
(function (global) {
  "use strict";

  var KEY = "sky-theme";
  var COLORS = { light: "#ffffff", dark: "#0b0b0c", gear: "#080707" };

  function init(doc, win, storage) {
    var root = doc.documentElement;
    var darkMq = win.matchMedia("(prefers-color-scheme: dark)");

    function saved() {
      try {
        var value = storage.getItem(KEY);
        if (value === "dark" || value === "light") return value;
      } catch (e) {}
      return null;
    }

    function current() {
      var theme = root.getAttribute("data-theme");
      if (theme === "dark" || theme === "light") return theme;
      return darkMq.matches ? "dark" : "light";
    }

    function paint() {
      var gear = root.getAttribute("data-gear") === "two";
      var on = !gear && current() === "light";
      var lamps = doc.querySelectorAll("[data-lamp]");
      for (var i = 0; i < lamps.length; i++) lamps[i].setAttribute("aria-pressed", on ? "true" : "false");
      var meta = doc.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", gear ? COLORS.gear : on ? COLORS.light : COLORS.dark);
    }

    function set(theme) {
      root.setAttribute("data-theme", theme);
      try { storage.setItem(KEY, theme); } catch (e) {}
      paint();
    }

    var initial = saved();
    if (initial) root.setAttribute("data-theme", initial);

    doc.addEventListener("click", function (event) {
      var lamp = event.target && event.target.closest ? event.target.closest("[data-lamp]") : null;
      if (!lamp) return;
      var was = current();
      var apply = function (theme) { set(theme || (was === "dark" ? "light" : "dark")); };
      if (typeof win.skyThemeTransition === "function") win.skyThemeTransition(apply, was, lamp);
      else apply();
    });

    var onScheme = function () { paint(); };
    if (typeof darkMq.addEventListener === "function") darkMq.addEventListener("change", onScheme);
    else if (typeof darkMq.addListener === "function") darkMq.addListener(onScheme);

    // Only another tab's change fires a storage event; a choice made here stays valid without storage.
    win.addEventListener("storage", function (event) {
      if (event.key !== KEY && event.key !== null) return;
      var theme = saved();
      if (theme) root.setAttribute("data-theme", theme);
      else root.removeAttribute("data-theme");
      paint();
    });

    var api = { paint: paint, current: current, set: set };
    win.skyTheme = api;
    paint();
    return api;
  }

  if (typeof module !== "undefined" && module.exports) module.exports = { init: init, COLORS: COLORS };
  else init(document, global, global.localStorage);
})(typeof window !== "undefined" ? window : globalThis);
