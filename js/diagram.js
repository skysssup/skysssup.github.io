/* Diagrams: each <figure data-diagram> carries a JSON spec ({nodes, edges, groups}) and an ordered
   list of steps for screen readers. This draws the spec as an SVG in the site's type and colors,
   left to right when there is room and top to bottom otherwise. Layout is exported for tests. */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";

  // Positions for nodes laid out in spec order. Returns boxes plus the overall size.
  function layout(spec, width) {
    var n = spec.nodes.length;
    var horizontal = width >= 560 && n > 0;
    var gap = horizontal ? Math.max(28, Math.min(56, width * 0.05)) : 28;
    var boxes = {};
    var w, h = 56, total;
    if (horizontal) {
      w = (width - gap * (n - 1)) / n;
      spec.nodes.forEach(function (node, i) { boxes[node.id] = { x: i * (w + gap), y: 20, w: w, h: h }; });
      total = { w: width, h: h + 40 };
    } else {
      w = width;
      spec.nodes.forEach(function (node, i) { boxes[node.id] = { x: 0, y: 4 + i * (h + gap), w: w, h: h }; });
      total = { w: width, h: n * h + (n - 1) * gap + 8 };
    }
    return { horizontal: horizontal, boxes: boxes, size: total };
  }

  // Connector between two boxes: from the facing edge of `a` to the facing edge of `b`.
  function connector(a, b, horizontal) {
    if (horizontal) {
      var y = a.y + a.h / 2;
      return a.x < b.x ? [a.x + a.w, y, b.x, y] : [a.x, y, b.x + b.w, y];
    }
    var x = a.x + a.w / 2;
    return a.y < b.y ? [x, a.y + a.h, x, b.y] : [x, a.y, x, b.y + b.h];
  }

  function el(name, attrs, text) {
    var node = document.createElementNS(NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (text != null) node.textContent = text;
    return node;
  }

  function draw(figure) {
    var source = figure.querySelector('script[type="application/json"]');
    if (!source) return;
    var spec = JSON.parse(source.textContent);
    var width = Math.floor(figure.getBoundingClientRect().width);
    if (!width) return;
    var plan = layout(spec, width);
    var old = figure.querySelector("svg");
    if (old) old.remove();
    var svg = el("svg", { viewBox: "0 0 " + plan.size.w + " " + plan.size.h, width: plan.size.w, height: plan.size.h, "aria-hidden": "true", focusable: "false" });
    (spec.edges || []).forEach(function (e) {
      var a = plan.boxes[e.from], b = plan.boxes[e.to];
      if (!a || !b) return;
      var c = connector(a, b, plan.horizontal);
      svg.appendChild(el("line", { "class": "edge", x1: c[0], y1: c[1], x2: c[2] - (plan.horizontal ? 4 : 0), y2: c[3] - (plan.horizontal ? 0 : 4) }));
      var ax = c[2], ay = c[3];
      var tip = plan.horizontal ? [ax, ay, ax - 6, ay - 3.5, ax - 6, ay + 3.5] : [ax, ay, ax - 3.5, ay - 6, ax + 3.5, ay - 6];
      svg.appendChild(el("polygon", { "class": "arrow", points: tip.join(" ") }));
      if (e.label) {
        var lx = (c[0] + c[2]) / 2, ly = plan.horizontal ? c[1] - 8 : (c[1] + c[3]) / 2 + 3;
        svg.appendChild(el("text", { "class": "edge-label", x: plan.horizontal ? lx : lx + 10, y: ly, "text-anchor": plan.horizontal ? "middle" : "start" }, e.label));
      }
    });
    spec.nodes.forEach(function (node) {
      var b = plan.boxes[node.id];
      var g = el("g", { "class": "node" });
      g.appendChild(el("rect", { x: b.x + 0.5, y: b.y + 0.5, width: b.w - 1, height: b.h - 1 }));
      g.appendChild(el("text", { "class": "label", x: b.x + 12, y: b.y + 24 }, node.label));
      if (node.sub) g.appendChild(el("text", { "class": "sub", x: b.x + 12, y: b.y + 42 }, node.sub));
      svg.appendChild(g);
    });
    figure.insertBefore(svg, figure.querySelector("figcaption"));
    figure.classList.add("is-drawn");
  }

  function boot() {
    var figures = document.querySelectorAll("[data-diagram]");
    Array.prototype.forEach.call(figures, function (figure) {
      var last = 0;
      new ResizeObserver(function () {
        var w = Math.floor(figure.getBoundingClientRect().width);
        if (w !== last) { last = w; draw(figure); }
      }).observe(figure);
    });
  }

  var api = { layout: layout, connector: connector };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { global.SkyDiagram = api; boot(); }
})(typeof window !== "undefined" ? window : globalThis);
