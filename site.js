(function () {
  var root = document.documentElement;
  var btn = document.getElementById("flip");
  var darkMq = window.matchMedia("(prefers-color-scheme: dark)");

  function now() {
    var t = root.getAttribute("data-theme");
    if (t === "dark" || t === "light") return t;
    return darkMq.matches ? "dark" : "light";
  }

  function paint() {
    var dark = now() === "dark";
    btn.textContent = dark ? "make it lighter" : "make it darker";
    btn.setAttribute("aria-pressed", dark ? "true" : "false");
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

  paint();
})();
