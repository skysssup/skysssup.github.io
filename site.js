(function () {
  var root = document.documentElement;
  var btn = document.getElementById("flip");
  var label = btn.querySelector("[data-theme-label]");
  var darkMq = window.matchMedia("(prefers-color-scheme: dark)");
  var colors = { light: "#ffffff", dark: "#0b0b0c", gear: "#090909" };

  function savedTheme() {
    try {
      var saved = localStorage.getItem("sky-theme");
      if (saved === "dark" || saved === "light") return saved;
    } catch (e) {}
    return null;
  }

  function now() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return darkMq.matches ? "dark" : "light";
  }

  function paint() {
    var gear = root.getAttribute("data-gear") === "two";
    var dark = gear || now() === "dark";
    if (label) label.textContent = dark ? "LIGHTS OFF" : "LIGHTS ON";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    if (!btn.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", "Toggle color theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", gear ? colors.gear : dark ? colors.dark : colors.light);
  }

  function setTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("sky-theme", theme); } catch (e) {}
    paint();
  }

  var saved = savedTheme();
  if (saved) root.setAttribute("data-theme", saved);

  btn.addEventListener("click", function () {
    var current = now();
    var apply = function (theme) {
      setTheme(theme || (current === "dark" ? "light" : "dark"));
    };
    if (typeof window.skyThemeTransition === "function") window.skyThemeTransition(apply, current);
    else apply();
  });

  // Keep the switch label, aria-pressed, and theme-color in sync when the OS
  // preference changes. An explicit selection (data-theme) still wins via now().
  function onSchemeChange() {
    paint();
  }
  if (typeof darkMq.addEventListener === "function") {
    darkMq.addEventListener("change", onSchemeChange);
  } else if (typeof darkMq.addListener === "function") {
    darkMq.addListener(onSchemeChange);
  }

  // A selection in this tab remains valid even when storage is unavailable.
  // Storage events only reflect changes made by another tab.
  window.addEventListener("storage", function (event) {
    if (event.key !== "sky-theme" && event.key !== null) return;
    var theme = savedTheme();
    if (theme) root.setAttribute("data-theme", theme);
    else root.removeAttribute("data-theme");
    paint();
  });

  window.skyTheme = { paint: paint, current: now, set: setTheme };
  paint();
})();
