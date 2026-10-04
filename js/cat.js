(function (global) {
  "use strict";

  // Original 16×16 pixel cat, drawn as silhouettes: # body, e eye, l detail line, p accent.
  // Outlines are derived from the silhouette so every frame shares the same line weight.
  var SHAPES = {
    sit: [
      "................",
      "...#........#...",
      "...##......##...",
      "...#p#....#p#...",
      "...##########...",
      "..############..",
      "..###e####e###..",
      "..###e####e###..",
      "..#####pp#####..",
      "...##########...",
      "....########..#.",
      "...##########.##",
      "..############.#",
      "..####l##l####.#",
      "..####l##l######",
      "...###########.."
    ],
    blink: [
      "................",
      "...#........#...",
      "...##......##...",
      "...#p#....#p#...",
      "...##########...",
      "..############..",
      "..############..",
      "..##ee####ee##..",
      "..#####pp#####..",
      "...##########...",
      "....########..#.",
      "...##########.##",
      "..############.#",
      "..####l##l####.#",
      "..####l##l######",
      "...###########.."
    ],
    runR1: [
      "................",
      "................",
      "..........#..#..",
      "..........####..",
      ".#.......######.",
      ".#.......###e##.",
      ".##......######p",
      "..##.....#####..",
      "...##########...",
      "...##########...",
      "...##########...",
      "...#########....",
      "..##.......##...",
      ".##.........##..",
      "##...........##.",
      "................"
    ],
    runR2: [
      "................",
      "................",
      "................",
      "..........#..#..",
      "..........####..",
      ".........######.",
      "#........###e##.",
      "##.......######p",
      ".###########....",
      "..##########....",
      "..##########....",
      "...#########....",
      "....##...##.....",
      "....##...##.....",
      "...##...##......",
      "................"
    ],
    runU1: [
      "................",
      "...#........#...",
      "...##......##...",
      "...###....###...",
      "...##########...",
      "..############..",
      "..############..",
      "...##########...",
      "....########....",
      "...##########...",
      "..############..",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...##.....###...",
      "...##..........."
    ],
    runU2: [
      "................",
      "................",
      "...#........#...",
      "...##......##...",
      "...###....###...",
      "...##########...",
      "..############..",
      "..############..",
      "...##########...",
      "....########....",
      "...##########...",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...###.....##...",
      "...........##..."
    ],
    runD1: [
      "................",
      "...#........#...",
      "...##......##...",
      "...#p#....#p#...",
      "...##########...",
      "..############..",
      "..###e####e###..",
      "..###e####e###..",
      "..#####pp#####..",
      "...##########...",
      "...##########...",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...##.....###...",
      "...##..........."
    ],
    runD2: [
      "................",
      "................",
      "...#........#...",
      "...##......##...",
      "...#p#....#p#...",
      "...##########...",
      "..############..",
      "..###e####e###..",
      "..###e####e###..",
      "..#####pp#####..",
      "...##########...",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...###.....##...",
      "...........##..."
    ],
    scratchR1: [
      "..............##",
      "..............##",
      "..........#..##.",
      "..........####..",
      ".........######.",
      ".........###e##.",
      ".........######p",
      "..........####..",
      ".........#####..",
      "........######..",
      "........######..",
      "#.......######..",
      "##......######..",
      ".##.....######..",
      "..##########....",
      "...##....##....."
    ],
    scratchR2: [
      "................",
      "..............##",
      "..........#..###",
      "..........####..",
      ".........######.",
      ".........###e##.",
      ".........######p",
      "..........####..",
      ".........######.",
      "........######.#",
      "........######..",
      "#.......######..",
      "##......######..",
      ".##.....######..",
      "..##########....",
      "...##....##....."
    ],
    scratchU1: [
      "..##........##..",
      "..##........##..",
      "..##.#....#.##..",
      "..####....####..",
      "...##########...",
      "...##########...",
      "..############..",
      "...##########...",
      "....########....",
      "...##########...",
      "..############..",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...###....###...",
      ".......##......."
    ],
    scratchU2: [
      "................",
      "..##........##..",
      "..##.#....#.##..",
      "..####....####..",
      "...##########...",
      "...##########...",
      "..############..",
      "...##########...",
      "....########....",
      "...##########...",
      "..############..",
      "..############..",
      "..############..",
      "...###l##l###...",
      "...###....###...",
      "........##......"
    ],
    sleep1: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "...#........#...",
      "...##......##...",
      "..############..",
      ".##############.",
      ".###ee####ee###.",
      ".##############.",
      ".######pp######.",
      "..############..",
      "................"
    ],
    sleep2: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "...#........#...",
      "...##......##...",
      ".##############.",
      ".###ee####ee###.",
      ".##############.",
      ".######pp######.",
      "..############..",
      "................"
    ]
  };

  function outline(rows) {
    var body = "#elp";
    return rows.map(function (row, y) {
      return row.split("").map(function (c, x) {
        if (c === ".") return ".";
        if (c === "e" || c === "l") return "k";
        var edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(function (d) {
          var nx = x + d[0], ny = y + d[1];
          return nx < 0 || ny < 0 || nx > 15 || ny > 15 || body.indexOf(rows[ny][nx]) < 0;
        });
        if (c === "p") return edge ? "k" : "p";
        return edge ? "k" : "w";
      }).join("");
    });
  }

  var SPRITES = {};
  Object.keys(SHAPES).forEach(function (name) { SPRITES[name] = outline(SHAPES[name]); });

  function mirror(rows) {
    return rows.map(function (row) { return row.split("").reverse().join(""); });
  }
  SPRITES.runL1 = mirror(SPRITES.runR1);
  SPRITES.runL2 = mirror(SPRITES.runR2);
  SPRITES.scratchL1 = mirror(SPRITES.scratchR1);
  SPRITES.scratchL2 = mirror(SPRITES.scratchR2);
  SPRITES.scratchD1 = SPRITES.runD1;
  SPRITES.scratchD2 = SPRITES.runD2;

  var SPEED = 10;
  var STOP = 44;
  var EDGE = 26;

  function heading(dx, dy) {
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (ay > ax * 1.6) return dy < 0 ? "U" : "D";
    return dx < 0 ? "L" : "R";
  }

  // The cat walks the band between `top` and `bottom` (below the header, above the footer when it shows).
  function wallOf(x, y, w, h, top, bottom) {
    top = top || 0;
    bottom = bottom == null ? h : bottom;
    if (x <= EDGE) return "L";
    if (x >= w - EDGE) return "R";
    if (y <= top + EDGE) return "U";
    if (y >= bottom - EDGE) return "D";
    return null;
  }

  // Pure state step so the behavior can be tested without a DOM.
  function step(cat, target, view, speed) {
    var top = (view.top || 0) + 16, bottom = (view.bottom == null ? view.h : view.bottom) - 16;
    target = { x: target.x, y: Math.max(top, Math.min(bottom, target.y)), edge: target.edge };
    var dx = target.x - cat.x, dy = target.y - cat.y;
    var distance = Math.hypot(dx, dy);
    cat.frame++;
    if (distance > STOP || (target.edge && distance > 2)) {
      if (cat.idle > 10 && cat.state !== "alert") {
        cat.state = "alert";
        cat.alertLeft = 4;
        cat.idle = 0;
        return "sit";
      }
      if (cat.state === "alert" && cat.alertLeft-- > 0) return "sit";
      cat.state = "run";
      cat.idle = 0;
      var move = Math.min(distance, speed);
      cat.x += (dx / distance) * move;
      cat.y += (dy / distance) * move;
      cat.x = Math.max(16, Math.min(view.w - 16, cat.x));
      cat.y = Math.max(top, Math.min(bottom, cat.y));
      return "run" + heading(dx, dy) + (cat.frame % 2 ? "1" : "2");
    }
    cat.idle++;
    var wall = wallOf(cat.x, cat.y, view.w, view.h, view.top, view.bottom);
    if (wall && target.edge) {
      cat.state = "scratch";
      return "scratch" + wall + (((cat.frame / 2) | 0) % 2 ? "1" : "2");
    }
    if (cat.idle > 90) {
      cat.state = "sleep";
      return ((cat.frame / 8) | 0) % 2 ? "sleep1" : "sleep2";
    }
    cat.state = "sit";
    return cat.idle % 37 === 0 || cat.idle % 37 === 1 ? "blink" : "sit";
  }

  function paint(ctx, rows, colors) {
    ctx.clearRect(0, 0, 16, 16);
    for (var y = 0; y < 16; y++) {
      for (var x = 0; x < 16; x++) {
        var c = rows[y][x];
        if (c === ".") continue;
        ctx.fillStyle = c === "k" ? colors.k : c === "p" ? colors.p : colors.w;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  function mount(options) {
    var reduced = options.reduced;
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    canvas.className = "cat";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    var cat = { x: innerWidth / 2, y: innerHeight - 28, frame: 0, idle: 0, state: "sit", alertLeft: 0 };
    var target = { x: cat.x, y: cat.y, edge: false };
    var timer = 0;
    var bubble = 0;

    function colors() {
      var styles = getComputedStyle(document.documentElement);
      return { k: styles.getPropertyValue("--ink").trim(), w: styles.getPropertyValue("--paper").trim(), p: styles.getPropertyValue("--accent").trim() };
    }

    function aim(x, y) {
      target.x = x;
      target.y = y;
      target.edge = x <= 1 || y <= 1 || x >= innerWidth - 1 || y >= innerHeight - 1;
      if (target.edge) {
        target.x = Math.max(16, Math.min(innerWidth - 16, x));
        target.y = Math.max(16, Math.min(innerHeight - 16, y));
      }
    }

    var header = document.querySelector(".site-header");
    var footer = document.querySelector(".site-footer");

    function tick() {
      var gear = document.documentElement.getAttribute("data-gear") === "two";
      var view = {
        w: innerWidth,
        h: innerHeight,
        top: header ? Math.max(0, header.getBoundingClientRect().bottom) : 0,
        bottom: footer ? Math.min(innerHeight, footer.getBoundingClientRect().top) : innerHeight
      };
      var sprite = step(cat, target, view, gear ? SPEED * 1.8 : SPEED);
      paint(ctx, SPRITES[sprite] || SPRITES.sit, colors());
      canvas.style.transform = "translate(" + Math.round(cat.x - 16) + "px," + Math.round(cat.y - 16) + "px)";
      canvas.classList.toggle("is-alert", cat.state === "alert");
      bubble = cat.state;
    }

    function sync() {
      clearInterval(timer);
      timer = 0;
      canvas.hidden = reduced.matches;
      if (!reduced.matches) {
        tick();
        timer = setInterval(tick, 100);
      }
    }

    document.addEventListener("pointermove", function (e) { aim(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener("pointerdown", function (e) { aim(e.clientX, e.clientY); }, { passive: true });
    document.documentElement.addEventListener("mouseleave", function (e) { aim(e.clientX, e.clientY); });
    window.addEventListener("blur", function () { target.edge = false; });
    reduced.addEventListener("change", sync);
    sync();
    return { state: function () { return bubble; } };
  }

  var api = { mount: mount, step: step, heading: heading, wallOf: wallOf, sprites: SPRITES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SkyCat = api;
})(typeof window !== "undefined" ? window : globalThis);
