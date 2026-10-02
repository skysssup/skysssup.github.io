(function () {
  var root = document.documentElement;
  var btn = document.getElementById("flip");
  var darkMq = window.matchMedia("(prefers-color-scheme: dark)");

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
    var dark = now() === "dark";
    btn.textContent = dark ? "make it lighter" : "make it darker";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
    // Stable accessible name; visible label may change with theme.
    if (!btn.getAttribute("aria-label")) {
      btn.setAttribute("aria-label", "Toggle color theme");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#11100e" : "#faf7f0");
  }

  var saved = savedTheme();
  if (saved) root.setAttribute("data-theme", saved);

  btn.addEventListener("click", function () {
    var next = now() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("sky-theme", next); } catch (e) {}
    paint();
  });

  // Keep button label / aria-pressed / theme-color in sync when OS preference
  // changes. Explicit localStorage override (data-theme) still wins via now().
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

  paint();
})();
