/* Diagrams: each <figure data-diagram> carries a JSON spec ({nodes, edges}) and an ordered
   list of steps. Layout is left to right when every box is wide enough for its label, and top to
   bottom otherwise. A reader can choose a stage; the matching node, incoming connector, and
   existing step sentence are marked. layout and connector stay exported for tests. */
(function (global) {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var MIN_BOX = 120;

  function estimate(text, kind) {
    if (!text) return 0;
    if (kind === "sub") return text.length * 10 + Math.max(0, text.length - 1) * 0.6;
    return text.length * 9;
  }

  function wrapText(text, maxWidth, widthOf) {
    var raw = String(text || "").trim();
    if (!raw) return [];
    if (!(maxWidth > 0)) return [raw];
    var words = raw.split(/\s+/);
    var lines = [];
    var line = "";
    words.forEach(function (word) {
      var trial = line ? line + " " + word : word;
      if (line && widthOf(trial) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = trial;
    });
    if (line) lines.push(line);
    var fitted = [];
    lines.forEach(function (part) {
      if (widthOf(part) <= maxWidth) { fitted.push(part); return; }
      var chunk = "";
      for (var i = 0; i < part.length; i++) {
        var next = chunk + part.charAt(i);
        if (chunk && widthOf(next) > maxWidth) { fitted.push(chunk); chunk = part.charAt(i); }
        else chunk = next;
      }
      if (chunk) fitted.push(chunk);
    });
    return fitted;
  }

  function nodeHeight(node, boxW) {
    var inner = Math.max(8, boxW - 24);
    var label = wrapText(node && node.label, inner, function (t) { return estimate(t, "label"); });
    var sub = wrapText(node && node.sub, inner, function (t) { return estimate(t, "sub"); });
    if (!label.length && !sub.length) return 56;
    return Math.max(56, 14 + label.length * 16 + (sub.length ? 6 + sub.length * 14 : 0) + 12);
  }

  // Positions for nodes laid out in spec order. Returns boxes plus the overall size.
  function layout(spec, width) {
    var n = spec.nodes.length;
    var gapH = Math.max(28, Math.min(56, width * 0.05));
    var share = n > 1 ? (width - gapH * (n - 1)) / n : width;
    var horizontal = width >= 560 && n > 0 && share >= MIN_BOX;
    var gap = horizontal ? gapH : 28;
    var boxes = {};
    var total;
    if (horizontal) {
      var w = n > 1 ? (width - gap * (n - 1)) / n : width;
      var h = 56;
      spec.nodes.forEach(function (node) { h = Math.max(h, nodeHeight(node, w)); });
      spec.nodes.forEach(function (node, i) { boxes[node.id] = { x: i * (w + gap), y: 20, w: w, h: h }; });
      total = { w: width, h: h + 40 };
    } else {
      var y = 4;
      spec.nodes.forEach(function (node) {
        var bh = nodeHeight(node, width);
        boxes[node.id] = { x: 0, y: y, w: width, h: bh };
        y += bh + gap;
      });
      total = { w: width, h: n ? y - gap + 4 : 8 - gap };
    }
    return { horizontal: horizontal, boxes: boxes, size: total, gap: gap };
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

  function canvasMeasure() {
    if (typeof document === "undefined") return estimate;
    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");
    if (!ctx) return estimate;
    return function (text, kind) {
      if (kind === "sub") {
        ctx.font = "400 10px \"Fragment Mono\", ui-monospace, monospace";
        return ctx.measureText(text).width + Math.max(0, text.length - 1) * 0.6;
      }
      ctx.font = "500 13px \"Instrument Sans\", ui-sans-serif, sans-serif";
      return ctx.measureText(text).width;
    };
  }

  function fitNode(node, boxW, measure) {
    var inner = Math.max(8, boxW - 24);
    var label = wrapText(node && node.label, inner, function (t) { return measure(t, "label"); });
    var sub = wrapText(node && node.sub, inner, function (t) { return measure(t, "sub"); });
    var h = !label.length && !sub.length ? 56 : Math.max(56, 14 + label.length * 16 + (sub.length ? 6 + sub.length * 14 : 0) + 12);
    return { label: label, sub: sub, h: h };
  }

  function stepsOf(figure) {
    return Array.prototype.slice.call(figure.querySelectorAll(".diagram-steps li"));
  }

  function stepText(steps, index) {
    if (!steps[index]) return "";
    return steps[index].textContent.replace(/\s+/g, " ").trim();
  }

  function revealSteps(figure) {
    var steps = figure.querySelector(".diagram-steps");
    if (!steps) return;
    steps.style.setProperty("position", "relative", "important");
    steps.style.setProperty("width", "auto", "important");
    steps.style.setProperty("height", "auto", "important");
    steps.style.setProperty("overflow", "visible", "important");
    steps.style.setProperty("clip", "unset", "important");
  }

  function stageCount(spec, steps) {
    return Math.max(spec.nodes.length, steps.length);
  }

  function readStage(figure, count) {
    var i = Number(figure.getAttribute("data-stage"));
    if (!count) return 0;
    if (!Number.isFinite(i) || i < 0 || i >= count) return 0;
    return i;
  }

  function applyStage(figure) {
    var nodes = figure._diagramNodes || [];
    var selected = readStage(figure, Math.max(nodes.length, stepsOf(figure).length));
    Array.prototype.forEach.call(figure.querySelectorAll("[data-stage-index]"), function (item) {
      var i = Number(item.getAttribute("data-stage-index"));
      var on = i === selected;
      item.classList.toggle("is-selected", on);
      item.setAttribute("tabindex", on ? "0" : "-1");
      if (item.tagName.toLowerCase() === "g" || item.getAttribute("role") === "button") item.setAttribute("aria-pressed", on ? "true" : "false");
      if (item.tagName.toLowerCase() === "li") {
        if (on) item.setAttribute("aria-current", "step");
        else item.removeAttribute("aria-current");
      }
    });
    Array.prototype.forEach.call(figure.querySelectorAll(".node"), function (g) {
      var i = Number(g.getAttribute("data-stage-index"));
      g.classList.toggle("is-route", i <= selected);
    });
    Array.prototype.forEach.call(figure.querySelectorAll(".edge, .arrow"), function (shape) {
      var from = Number(shape.getAttribute("data-from"));
      var to = Number(shape.getAttribute("data-to"));
      var incoming = to === selected && from < to;
      var route = incoming || (to < selected && to === from + 1);
      shape.classList.toggle("is-route", route);
      shape.classList.toggle("is-selected", incoming);
      shape.classList.remove("is-play");
    });
    var playing = figure.querySelectorAll(".edge.is-selected, .arrow.is-selected");
    if (playing.length) {
      void figure.getBoundingClientRect();
      Array.prototype.forEach.call(playing, function (shape) { shape.classList.add("is-play"); });
    }
  }

  function syncPause(figure) {
    var rect = figure.getBoundingClientRect();
    var visible = Math.min(rect.bottom, global.innerHeight) - Math.max(rect.top, 0);
    var shown = rect.height > 0 && visible / rect.height >= 0.2;
    figure.classList.toggle("is-paused", document.hidden || !shown);
  }

  function focusStage(figure, index, fromList) {
    var sel = (fromList ? ".diagram-steps " : ".node") + "[data-stage-index=\"" + index + "\"]";
    var target = figure.querySelector(sel);
    if (target && target.focus) target.focus();
  }

  function choose(figure, index, fromList) {
    var count = Math.max((figure._diagramNodes || []).length, stepsOf(figure).length);
    if (!count) return;
    var next = Math.max(0, Math.min(count - 1, index));
    figure.setAttribute("data-stage", String(next));
    applyStage(figure);
    if (fromList != null) focusStage(figure, next, fromList);
  }

  function onClick(event) {
    var item = event.target.closest && event.target.closest("[data-stage-index]");
    if (!item || !event.currentTarget.contains(item)) return;
    choose(event.currentTarget, Number(item.getAttribute("data-stage-index")), !!item.closest(".diagram-steps"));
  }

  function onKey(event) {
    var figure = event.currentTarget;
    var item = event.target.closest && event.target.closest("[data-stage-index]");
    if (!item || !figure.contains(item)) return;
    var count = Math.max((figure._diagramNodes || []).length, stepsOf(figure).length);
    var i = Number(item.getAttribute("data-stage-index"));
    var next = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = Math.min(count - 1, i + 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "Enter" || event.key === " ") next = i;
    else return;
    event.preventDefault();
    choose(figure, next, !!item.closest(".diagram-steps"));
  }

  function draw(figure) {
    var source = figure.querySelector('script[type="application/json"]');
    if (!source) return;
    var spec = JSON.parse(source.textContent);
    var width = Math.floor(figure.getBoundingClientRect().width);
    if (!width) return;
    var active = document.activeElement;
    var restore = active && figure.contains(active) ? active : null;
    var restoreList = !!(restore && restore.closest && restore.closest(".diagram-steps"));
    var restoreIndex = restore ? restore.getAttribute("data-stage-index") : null;
    var steps = stepsOf(figure);
    var count = stageCount(spec, steps);
    if (!figure.hasAttribute("data-stage")) figure.setAttribute("data-stage", "0");
    var selected = readStage(figure, count);
    figure.setAttribute("data-stage", String(selected));
    var plan = layout(spec, width);
    var measure = canvasMeasure();
    var fits = spec.nodes.map(function (node) { return fitNode(node, plan.boxes[node.id].w, measure); });
    if (plan.horizontal) {
      var h = 56;
      fits.forEach(function (fit) { h = Math.max(h, fit.h); });
      spec.nodes.forEach(function (node) { plan.boxes[node.id].h = h; });
      plan.size.h = h + 40;
    } else {
      var y = 4;
      spec.nodes.forEach(function (node, i) {
        var b = plan.boxes[node.id];
        b.y = y;
        b.h = fits[i].h;
        y += b.h + plan.gap;
      });
      plan.size.h = spec.nodes.length ? y - plan.gap + 4 : plan.size.h;
    }
    var old = figure.querySelector("svg");
    if (old) old.remove();
    var uid = figure.getAttribute("data-diagram-id");
    if (!uid) {
      uid = "d" + Math.random().toString(36).slice(2, 8);
      figure.setAttribute("data-diagram-id", uid);
    }
    var caption = figure.querySelector("figcaption");
    var captionText = caption ? caption.textContent.replace(/\s+/g, " ").trim() : "";
    var svg = el("svg", {
      viewBox: "0 0 " + plan.size.w + " " + plan.size.h,
      width: plan.size.w,
      height: plan.size.h,
      role: "group",
      "aria-label": captionText || "Diagram stages"
    });
    if (captionText) svg.appendChild(el("title", {}, captionText));
    var order = {};
    spec.nodes.forEach(function (node, i) { order[node.id] = i; });
    var defs = el("defs", {});
    svg.appendChild(defs);
    (spec.edges || []).forEach(function (e) {
      var a = plan.boxes[e.from], b = plan.boxes[e.to];
      if (!a || !b) return;
      var from = order[e.from], to = order[e.to];
      var c = connector(a, b, plan.horizontal);
      svg.appendChild(el("line", {
        "class": "edge",
        "data-from": String(from),
        "data-to": String(to),
        x1: c[0], y1: c[1],
        x2: c[2] - (plan.horizontal ? 4 : 0),
        y2: c[3] - (plan.horizontal ? 0 : 4)
      }));
      var ax = c[2], ay = c[3];
      var tip = plan.horizontal ? [ax, ay, ax - 6, ay - 3.5, ax - 6, ay + 3.5] : [ax, ay, ax - 3.5, ay - 6, ax + 3.5, ay - 6];
      svg.appendChild(el("polygon", {
        "class": "arrow",
        "data-from": String(from),
        "data-to": String(to),
        points: tip.join(" ")
      }));
      if (e.label) {
        var lx = (c[0] + c[2]) / 2, ly = plan.horizontal ? c[1] - 8 : (c[1] + c[3]) / 2 + 3;
        svg.appendChild(el("text", {
          "class": "edge-label",
          x: plan.horizontal ? lx : lx + 10,
          y: ly,
          "text-anchor": plan.horizontal ? "middle" : "start"
        }, e.label));
      }
    });
    spec.nodes.forEach(function (node, i) {
      var b = plan.boxes[node.id];
      var fit = fits[i];
      var clipId = uid + "-" + node.id;
      var clip = el("clipPath", { id: clipId });
      clip.appendChild(el("rect", { x: b.x + 6, y: b.y + 4, width: Math.max(0, b.w - 12), height: Math.max(0, b.h - 8) }));
      defs.appendChild(clip);
      var name = stepText(steps, i) || [node.label, node.sub].filter(Boolean).join(", ");
      var g = el("g", {
        "class": "node",
        role: "button",
        tabindex: "-1",
        "data-stage-index": String(i),
        "aria-label": name
      });
      if (node.label) g.appendChild(el("title", {}, node.label));
      if (name) g.appendChild(el("desc", {}, name));
      g.appendChild(el("rect", { x: b.x + 0.5, y: b.y + 0.5, width: Math.max(0, b.w - 1), height: Math.max(0, b.h - 1) }));
      var text = el("g", { "clip-path": "url(#" + clipId + ")" });
      var block = fit.label.length * 16 + (fit.sub.length ? 6 + fit.sub.length * 14 : 0);
      var top = b.y + Math.max(12, (b.h - block) / 2);
      fit.label.forEach(function (line, lineIndex) {
        text.appendChild(el("text", { "class": "label", x: b.x + 12, y: top + 13 + lineIndex * 16 }, line));
      });
      var subTop = top + fit.label.length * 16 + (fit.label.length ? 16 : 13);
      fit.sub.forEach(function (line, lineIndex) {
        text.appendChild(el("text", { "class": "sub", x: b.x + 12, y: subTop + lineIndex * 14 }, line));
      });
      g.appendChild(text);
      svg.appendChild(g);
    });
    var list = figure.querySelector(".diagram-steps");
    if (list) figure.insertBefore(svg, list);
    else figure.insertBefore(svg, caption);
    steps.forEach(function (item, i) {
      item.setAttribute("data-stage-index", String(i));
      if (!item.hasAttribute("tabindex")) item.setAttribute("tabindex", "-1");
    });
    figure._diagramNodes = spec.nodes;
    revealSteps(figure);
    figure.classList.add("is-drawn");
    applyStage(figure);
    if (restoreIndex != null) focusStage(figure, Number(restoreIndex), restoreList);
    syncPause(figure);
  }

  function boot() {
    var figures = document.querySelectorAll("[data-diagram]");
    Array.prototype.forEach.call(figures, function (figure) {
      var last = 0;
      figure.addEventListener("click", onClick);
      figure.addEventListener("keydown", onKey);
      var redraw = function () {
        var w = Math.floor(figure.getBoundingClientRect().width);
        if (w !== last) { last = w; draw(figure); }
        else syncPause(figure);
      };
      new ResizeObserver(redraw).observe(figure);
      if (global.IntersectionObserver) new IntersectionObserver(function () { syncPause(figure); }).observe(figure);
      global.addEventListener("scroll", function () { syncPause(figure); }, { passive: true });
      document.addEventListener("visibilitychange", function () { syncPause(figure); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { last = -1; redraw(); });
    });
  }

  var api = { layout: layout, connector: connector };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else { global.SkyDiagram = api; boot(); }
})(typeof window !== "undefined" ? window : globalThis);
