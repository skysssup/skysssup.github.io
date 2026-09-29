(function () {
  var stations = Array.prototype.slice.call(document.querySelectorAll(".station"));
  var status = document.getElementById("courier-status");
  var root = document.documentElement;
  var themeBtn = document.getElementById("theme-toggle");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(pointer: fine)");
  var darkScheme = window.matchMedia("(prefers-color-scheme: dark)");

  function themeNow() {
    if (root.getAttribute("data-theme") === "dark" || root.getAttribute("data-theme") === "light") {
      return root.getAttribute("data-theme");
    }
    return darkScheme.matches ? "dark" : "light";
  }

  function paintTheme() {
    var dark = themeNow() === "dark";
    themeBtn.setAttribute("aria-pressed", dark ? "true" : "false");
    themeBtn.textContent = dark ? "night" : "day";
    themeBtn.setAttribute("aria-label", dark ? "switch to day" : "switch to night");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#141210" : "#f3eee4");
  }

  themeBtn.addEventListener("click", function () {
    var next = themeNow() === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("bench-theme", next);
    } catch (err) {}
    paintTheme();
  });

  paintTheme();
  darkScheme.addEventListener("change", function () {
    if (!root.getAttribute("data-theme")) paintTheme();
  });

  var index = 0;
  stations.forEach(function (station, i) {
    if (station.getAttribute("aria-current") === "true") index = i;
  });

  function park(next, moveFocus) {
    index = (next + stations.length) % stations.length;
    stations.forEach(function (station, i) {
      var on = i === index;
      if (on) station.setAttribute("aria-current", "true");
      else station.removeAttribute("aria-current");
      station.tabIndex = on ? 0 : -1;
    });
    var current = stations[index];
    status.textContent = current.getAttribute("data-note") || current.getAttribute("data-name");
    if (moveFocus) current.focus();
  }

  document.getElementById("prev-station").addEventListener("click", function () {
    park(index - 1, false);
  });
  document.getElementById("next-station").addEventListener("click", function () {
    park(index + 1, false);
  });

  stations.forEach(function (station, i) {
    station.addEventListener("click", function (event) {
      if (event.target.closest("a")) return;
      park(i, false);
    });
    station.addEventListener("keydown", function (event) {
      var key = event.key;
      if (key === "ArrowRight" || key === "ArrowDown") {
        event.preventDefault();
        park(index + 1, true);
      } else if (key === "ArrowLeft" || key === "ArrowUp") {
        event.preventDefault();
        park(index - 1, true);
      } else if (key === "Home") {
        event.preventDefault();
        park(0, true);
      } else if (key === "End") {
        event.preventDefault();
        park(stations.length - 1, true);
      }
    });
  });

  var face = document.getElementById("courier-face");
  var pupils = face ? Array.prototype.slice.call(face.querySelectorAll(".pupil")) : [];

  function eyesAllowed() {
    return finePointer.matches && !reduceMotion.matches;
  }

  if (face) {
    face.addEventListener("pointermove", function (event) {
      if (!eyesAllowed()) return;
      var rect = face.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      var dx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
      var dy = Math.max(-1, Math.min(1, ((event.clientY - rect.top) / rect.height - 0.5) * 2));
      var shift = "translate(" + (dx * 2.4).toFixed(2) + " " + (dy * 2.4).toFixed(2) + ")";
      pupils.forEach(function (pupil) {
        pupil.setAttribute("transform", shift);
      });
    });
    face.addEventListener("pointerleave", function () {
      pupils.forEach(function (pupil) {
        pupil.removeAttribute("transform");
      });
    });
  }

  park(index, false);
})();
