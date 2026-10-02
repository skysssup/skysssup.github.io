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

  try {
    var saved = localStorage.getItem("sky-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
  } catch (e) {}

  btn.addEventListener("click", function () {
    var next = now() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("sky-theme", next); } catch (e) {}
    paint();
  });

  // Keep button label / aria-pressed / theme-color in sync when OS preference
  // changes. Explicit localStorage override (data-theme) still wins via now().
  function onSchemeChange() {
    if (!savedTheme()) {
      root.removeAttribute("data-theme");
    }
    paint();
  }
  if (typeof darkMq.addEventListener === "function") {
    darkMq.addEventListener("change", onSchemeChange);
  } else if (typeof darkMq.addListener === "function") {
    darkMq.addListener(onSchemeChange);
  }

  paint();
})();
