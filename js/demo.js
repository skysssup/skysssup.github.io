/* Demos: a case-study figure marked data-demo-frame="<page>" holds a short description and a Load button, and
   nothing loads until the visitor presses it. Then the page opens in an iframe inside the figure, without camera
   or microphone access, and focus moves to it. */
(function (global) {
  "use strict";

  // Permissions a framed demo never gets, whatever the framed page asks for.
  var DENY = "camera 'none'; microphone 'none'; geolocation 'none'";

  function boot(doc, win) {
    var announce = doc.querySelector("[data-announce]");
    var say = function (text) { if (announce) { announce.textContent = ""; win.setTimeout(function () { announce.textContent = text; }, 30); } };

    function load(figure) {
      var root = figure.querySelector(".demo-root");
      if (!root || figure.classList.contains("is-loaded")) return;
      var label = figure.getAttribute("data-demo-label") || "Interactive demo";
      var frame = doc.createElement("iframe");
      frame.src = figure.getAttribute("data-demo-frame");
      frame.title = label;
      frame.setAttribute("allow", DENY);
      root.textContent = "";
      root.appendChild(frame);
      figure.classList.add("is-loaded");
      frame.focus({ preventScroll: true });
      say(label + " is loading");
    }

    doc.addEventListener("click", function (event) {
      var button = event.target && event.target.closest ? event.target.closest("[data-demo-load]") : null;
      var figure = button && button.closest("[data-demo-frame]");
      if (figure) load(figure);
    });
  }

  var api = { DENY: DENY };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { global.SkyDemo = api; boot(document, global); }
})(typeof window !== "undefined" ? window : globalThis);
