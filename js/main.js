(function () {
  "use strict";

  var root = document.documentElement;
  var body = document.body;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var narrow = window.matchMedia("(max-width: 760px)");
  var base = body.getAttribute("data-base") || "";
  var timers = [];
  var gearTwo = false;
  var smoother = null;

  function motion() {
    return !reduced.matches;
  }

  function later(fn, ms) {
    timers.push(setTimeout(fn, ms));
  }

  function clearPhases() {
    timers.forEach(clearTimeout);
    timers = [];
    root.removeAttribute("data-phase");
  }

  /* blueprint markers */
  var blueprint = document.querySelector(".blueprint");
  if (blueprint) {
    [0, 25, 50, 75, 100].forEach(function (x) {
      [0, 33.3333, 66.6667, 100].forEach(function (y) {
        var plus = document.createElement("span");
        plus.textContent = "+";
        plus.style.left = x + "%";
        plus.style.top = y + "%";
        blueprint.appendChild(plus);
      });
    });
  }

  /* clock: Aakash's local time zone */
  var clock = document.getElementById("clock");
  var format = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit", hour12: true });
  function tick() {
    if (!clock) return;
    var now = new Date();
    clock.textContent = format.format(now);
    clock.dateTime = now.toISOString();
  }
  tick();
  setInterval(tick, 15000);
  document.querySelectorAll(".year").forEach(function (el) { el.textContent = String(new Date().getFullYear()); });

  /* smooth scroll */
  function syncSmoother() {
    if (motion() && !smoother && window.Lenis) {
      smoother = new window.Lenis({
        autoRaf: true,
        anchors: true,
        duration: 1.2,
        easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }
      });
    } else if (!motion() && smoother) {
      smoother.destroy();
      smoother = null;
    }
  }
  syncSmoother();

  /* reveal on view */
  var revealer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      revealer.unobserve(entry.target);
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".editorial .reveal-up, .work .reveal-up, .site-footer .reveal-up, .work-list, .portfolio-index .reveal-up").forEach(function (el) { revealer.observe(el); });

  /* hero entrance */
  function enter() {
    body.classList.remove("is-loading");
    var heroBits = document.querySelectorAll(".hero .reveal-right, .hero .reveal-left");
    heroBits.forEach(function (el, i) {
      setTimeout(function () { el.classList.add("is-in"); }, motion() ? 900 + i * 120 : 0);
    });
  }
  var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  Promise.race([fontsReady, new Promise(function (r) { setTimeout(r, 900); })]).then(function () {
    requestAnimationFrame(enter);
  });

  var figure = document.querySelector(".hero-figure, .mark-figure");

  /* scroll parallax */
  var parallax = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var queued = false;
  function applyParallax() {
    queued = false;
    var y = Math.min(800, Math.max(0, window.scrollY));
    parallax.forEach(function (el) {
      var amount = motion() && !narrow.matches ? parseFloat(el.getAttribute("data-parallax")) * (y / 800) : 0;
      el.style.translate = "0 " + amount.toFixed(1) + "px";
    });
  }
  window.addEventListener("scroll", function () {
    if (queued) return;
    queued = true;
    requestAnimationFrame(applyParallax);
  }, { passive: true });

  /* about panel */
  var about = document.getElementById("about");
  var aboutClose = document.getElementById("about-close");
  var aboutOpen = document.getElementById("about-open");
  if (about && aboutClose && aboutOpen) {
    aboutClose.addEventListener("click", function () {
      about.hidden = true;
      aboutOpen.hidden = false;
      aboutOpen.setAttribute("aria-expanded", "false");
      aboutOpen.focus();
    });
    aboutOpen.addEventListener("click", function () {
      about.hidden = false;
      aboutOpen.hidden = true;
      aboutOpen.setAttribute("aria-expanded", "true");
      aboutClose.focus();
    });
  }

  /* gear two particles: embers rising off the figure */
  var particles = (function () {
    var canvas = document.querySelector(".fx-particles");
    if (!canvas) return { sync: function () {} };
    var ctx = canvas.getContext("2d");
    var reds = ["#ff2d20", "#ff4a3d", "#ff6b5a", "#e0251a", "#ff8c7a"];
    var list = [];
    var frame = 0, raf = 0, mouse = { x: -999, y: -999 };
    function fit() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(innerWidth * dpr);
      canvas.height = Math.round(innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn() {
      var rect = figure ? figure.getBoundingClientRect() : null;
      var fromFigure = rect && rect.bottom > 0 && rect.top < innerHeight && Math.random() < 0.7;
      var x, y;
      if (fromFigure) {
        var angle = Math.PI + Math.random() * Math.PI;
        x = rect.left + rect.width / 2 + Math.cos(angle) * rect.width * 0.42;
        y = rect.top + rect.height / 2 + Math.sin(angle) * rect.height * 0.42;
      } else {
        x = Math.random() * innerWidth;
        y = innerHeight + Math.random() * 20;
      }
      var life = 70 + Math.random() * 120;
      list.push({ x: x, y: y, vx: (Math.random() - 0.5) * 0.4, vy: -(0.5 + Math.random() * 1.2), size: 1.5 + Math.random() * 2.5, life: life, max: life, alpha: 0.5 + Math.random() * 0.45, color: reds[(Math.random() * reds.length) | 0], seed: Math.random() * 10 });
    }
    function loop() {
      raf = 0;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      frame++;
      if (gearTwo && frame % 2 === 0 && list.length < 110) spawn();
      list = list.filter(function (p) {
        p.life -= 1;
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0.01) {
          var push = (110 - d) / 110 * 0.5;
          p.vx += dx / d * push;
          p.vy += dy / d * push;
        }
        p.x += p.vx + 0.35 * Math.sin((p.max - p.life) * 0.06 + p.seed);
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.997;
        if (p.life <= 0 || p.y < -20) return false;
        var flicker = 0.65 + 0.35 * Math.sin(frame * 0.4 + p.seed * 7);
        ctx.globalAlpha = (p.life / p.max) * p.alpha * flicker;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
        return true;
      });
      ctx.globalAlpha = 1;
      if (gearTwo || list.length) raf = requestAnimationFrame(loop);
    }
    window.addEventListener("resize", fit);
    window.addEventListener("pointermove", function (e) { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    fit();
    return {
      sync: function () {
        if (!motion()) {
          cancelAnimationFrame(raf);
          raf = 0;
          list = [];
          ctx.clearRect(0, 0, innerWidth, innerHeight);
          return;
        }
        if (!raf && (gearTwo || list.length)) raf = requestAnimationFrame(loop);
      }
    };
  })();

  /* gear two */
  var gear = document.getElementById("gear");
  var gearLabel = document.getElementById("gear-label");

  function setGear(on) {
    gearTwo = on;
    if (on) root.setAttribute("data-gear", "two");
    else root.removeAttribute("data-gear");
    if (gear) gear.setAttribute("aria-pressed", String(on));
    if (gearLabel) gearLabel.textContent = on ? "REALITY" : "GEAR TWO";
    if (window.skyTheme) window.skyTheme.paint();
    particles.sync();
  }

  if (gear) {
    gear.addEventListener("click", function () {
      clearPhases();
      var next = !gearTwo;
      if (!motion()) {
        setGear(next);
        return;
      }
      if (next) {
        root.setAttribute("data-phase", "flash");
        later(function () { setGear(true); root.setAttribute("data-phase", "glitch"); }, 150);
        later(function () { root.setAttribute("data-phase", "settle"); }, 800);
        later(clearPhases, 1400);
      } else {
        root.setAttribute("data-phase", "glitch");
        later(function () { setGear(false); clearPhases(); }, 400);
      }
    });
  }

  /* light switch: blurred circle reveal from the switch */
  var flip = document.getElementById("flip");
  window.skyThemeTransition = function (apply, current) {
    var target = gearTwo ? "light" : current === "dark" ? "light" : "dark";
    var run = function () {
      clearPhases();
      if (gearTwo) setGear(false);
      apply(target);
    };
    if (!motion() || typeof document.startViewTransition !== "function" || !flip) {
      run();
      return;
    }
    var rect = flip.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    var reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 2.5;
    var transition = document.startViewTransition(run);
    transition.ready.then(function () {
      root.animate({
        maskSize: ["0px 0px", reach + "px " + reach + "px"],
        maskPosition: [x + "px " + y + "px", (x - reach / 2) + "px " + (y - reach / 2) + "px"]
      }, { duration: 900, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "forwards", pseudoElement: "::view-transition-new(root)" });
    }).catch(function () {});
  };

  /* work list */
  var projects = [
    { name: "AIRFORGE", thread: "physics", type: "PHYSICS PLAYGROUND", color: "#3049d3", desc: "Browser-based 2.5D sketch-to-physics playground with mouse drawing, optional webcam gestures, and JSON scene import/export.", chips: ["TYPESCRIPT", "REACT", "THREE.JS", "RAPIER", "MEDIAPIPE"], url: "https://github.com/skysssup/airforge" },
    { name: "AGENTCRUCIBLE", thread: "ai", type: "AGENT FAULT HARNESS", color: "#e4572e", desc: "Offline fault-testing harness for tool-using agents, using scripted mock worlds to score unsafe actions and false success claims.", chips: ["TYPESCRIPT", "AGENTS", "EVALS"], url: "https://github.com/skysssup/agentcrucible" },
    { name: "SHIPGATE", thread: "tools", type: "GIT CLI", color: "#0a9b72", desc: "CLI for scanning staged Git changes and applying local policies to commit and push workflows.", chips: ["TYPESCRIPT", "GIT", "CLI"], url: "https://github.com/skysssup/shipgate" },
    { name: "RECALL-AI", thread: "tools", type: "SPACED REPETITION", color: "#9b3fd6", desc: "Local-first spaced repetition for algorithm practice, with SQLite scheduling and optional LeetCode result capture.", chips: ["PYTHON", "FASTAPI", "SQLITE", "REACT"], url: "https://github.com/skysssup/recall-ai" },
    { name: "GHOST-NOTETAKER", thread: "tools", type: "STICKY NOTES", color: "#c99700", desc: "Sticky notes that screen share can't see.", chips: ["DESKTOP"], url: null },
    { name: "SPANFORGE", thread: "ai", type: "AGENT TRACING", color: "#0a8fc4", desc: "Agent call spans and waterfalls.", chips: ["OBSERVABILITY"], url: null },
    { name: "LOCALPULSE", thread: "ai", type: "LLM METRICS", color: "#e0457b", desc: "LLM cost and latency, kept on disk.", chips: ["OBSERVABILITY"], url: null },
    { name: "MOLTDAO", thread: "ai", type: "AGENT DAO", color: "#5f7a00", desc: "Agents vote USDC.", chips: ["GOVERNANCE"], url: null }
  ];
  window.skyProjects = projects;

  var list = document.getElementById("work-list");
  var detail = document.getElementById("work-detail");
  if (list && detail) {
    var items = [];
    var active = null;
    var pad = function (n) { return String(n).padStart(2, "0"); };

    projects.forEach(function (project, i) {
      var li = document.createElement("li");
      li.style.transitionDelay = (i * 0.08) + "s";
      var button = document.createElement("button");
      button.type = "button";
      button.className = "work-item";
      button.setAttribute("aria-controls", "work-detail");
      button.style.setProperty("--accent-item", project.color);
      button.innerHTML = '<span class="work-num">' + pad(i + 1) + '.</span><span class="work-name"></span><span class="work-type"></span>';
      button.querySelector(".work-name").textContent = project.name;
      button.querySelector(".work-type").textContent = project.type;
      button.addEventListener("mouseenter", function () { if (!narrow.matches) setActive(i); });
      button.addEventListener("focus", function () { if (!narrow.matches) setActive(i); });
      button.addEventListener("click", function () { setActive(narrow.matches && active === i ? null : i); });
      li.appendChild(button);
      list.appendChild(li);
      items.push(button);
    });

    list.addEventListener("mouseleave", function () { if (!narrow.matches) setActive(null); });
    list.addEventListener("pointerdown", function () { highlight(null); });
    list.addEventListener("mouseenter", function () { highlight(null); });

    function highlight(thread) {
      items.forEach(function (item, j) { item.classList.toggle("is-muted", !!thread && projects[j].thread !== thread); });
      document.querySelectorAll("[data-thread]").forEach(function (el) { el.setAttribute("aria-pressed", String(el.getAttribute("data-thread") === thread)); });
    }

    document.querySelectorAll("[data-thread]").forEach(function (button) {
      var thread = button.getAttribute("data-thread");
      var count = button.querySelector(".thread-count");
      if (count) count.textContent = String(projects.filter(function (p) { return p.thread === thread; }).length).padStart(2, "0");
      button.addEventListener("click", function () {
        var first = projects.findIndex(function (p) { return p.thread === thread; });
        var target = document.getElementById("work");
        if (smoother) smoother.scrollTo(target, { offset: -40 });
        else target.scrollIntoView({ behavior: motion() ? "smooth" : "auto" });
        highlight(thread);
        setActive(first);
      });
    });
    if (!narrow.matches) {
      renderDetail(0);
      detail.classList.add("visible");
    }
    list.addEventListener("focusout", function (event) {
      if (!list.contains(event.relatedTarget) && !detail.contains(event.relatedTarget)) setActive(null);
    });

    function renderDetail(i) {
      var project = projects[i];
      detail.style.setProperty("--accent-item", project.color);
      detail.innerHTML =
        '<p class="detail-counter">' + pad(i + 1) + " / " + pad(projects.length) + '</p>' +
        '<div class="detail-accent"></div>' +
        '<h3 class="detail-name"></h3><p class="detail-type"></p><p class="detail-desc"></p>' +
        '<div class="detail-chips"></div>' +
        (project.url ? '<a class="detail-link" href="' + project.url + '">VIEW ON GITHUB ↗</a>' : '<span class="detail-link" aria-disabled="true">PRIVATE REPO</span>');
      detail.querySelector(".detail-name").textContent = project.name;
      detail.querySelector(".detail-type").textContent = project.type;
      detail.querySelector(".detail-desc").textContent = project.desc;
      var chips = detail.querySelector(".detail-chips");
      project.chips.forEach(function (chip) {
        var span = document.createElement("span");
        span.className = "chip";
        span.textContent = chip;
        chips.appendChild(span);
      });
    }

    function setActive(i) {
      active = i;
      items.forEach(function (item, j) {
        var offset = i === null ? 0 : j - i;
        var distance = Math.abs(offset);
        item.classList.toggle("is-active", i === j);
        item.setAttribute("aria-expanded", String(i === j));
        if (i === null || narrow.matches || !motion()) {
          item.style.transform = "";
          item.style.opacity = "";
        } else {
          item.style.transform = "rotateX(" + (6 * offset) + "deg) translateZ(" + (i === j ? 18 : -6 * distance) + "px)";
          item.style.opacity = i === j ? 1 : Math.max(0.18, 1 - 0.2 * distance);
        }
      });
      if (i === null) {
        if (narrow.matches) detail.classList.remove("visible");
        return;
      }
      renderDetail(i);
      if (narrow.matches) items[i].parentElement.appendChild(detail);
      else if (detail.parentElement !== list.parentElement) list.parentElement.appendChild(detail);
      detail.classList.add("visible");
    }
  }

  /* figures */
  if (window.Dotfield) {
    var heroFigure = document.getElementById("figure");
    if (heroFigure) window.Dotfield.mountHero(heroFigure, { src: base + "assets/avatar.jpg", reduced: reduced, words: ["AI", "AGENTS", "RESEARCH", "SYSTEMS", "ROBOTICS", "ENGINEERING"] });
    var dither = document.getElementById("dither");
    if (dither) window.Dotfield.mountDither(dither, { src: base + "assets/avatar.jpg", crop: [20, 0, 360, 300], reduced: reduced });
  }
  var mark = document.getElementById("mark");
  if (mark && window.SkyMark) window.SkyMark.mountMark(mark, { reduced: reduced });

  var cards = document.getElementById("cards");
  if (cards) {
    projects.forEach(function (project, i) {
      var card = document.createElement("li");
      card.className = "card reveal-up";
      card.id = project.name.toLowerCase();
      card.style.setProperty("--accent-item", project.color);
      card.style.transitionDelay = ((i % 2) * 0.1) + "s";
      card.innerHTML =
        '<div class="card-head"><span class="stripes" aria-hidden="true"></span><span>/' + String(i + 1).padStart(2, "0") + '</span></div>' +
        '<div class="card-body"><h3 class="card-name"></h3><p class="card-type"></p><p class="card-desc"></p><div class="detail-chips"></div></div>' +
        '<div class="card-foot"><span class="card-status"></span>' +
        (project.url ? '<a class="detail-link" href="' + project.url + '">VIEW ON GITHUB ↗</a>' : '<span class="detail-link" aria-disabled="true">PRIVATE REPO</span>') +
        '</div>';
      card.querySelector(".card-name").textContent = project.name;
      card.querySelector(".card-type").textContent = project.type;
      card.querySelector(".card-desc").textContent = project.desc;
      card.querySelector(".card-status").textContent = project.url ? "PUBLIC" : "PRIVATE";
      var chipBox = card.querySelector(".detail-chips");
      project.chips.forEach(function (chip) {
        var span = document.createElement("span");
        span.className = "chip";
        span.textContent = chip;
        chipBox.appendChild(span);
      });
      cards.appendChild(card);
      revealer.observe(card);
    });
    var index = document.getElementById("index-list");
    if (index) {
      projects.forEach(function (project, i) {
        var item = document.createElement("li");
        item.innerHTML = '<a href="#' + project.name.toLowerCase() + '"><span class="index-num">' + String(i + 1).padStart(2, "0") + '</span><span class="index-name"></span><span class="index-status"></span></a>';
        item.querySelector(".index-name").textContent = project.name;
        item.querySelector(".index-status").textContent = project.url ? "PUBLIC" : "PRIVATE";
        index.appendChild(item);
      });
    }
  }

  if (window.SkyCat) window.SkyCat.mount({ reduced: reduced });

  reduced.addEventListener("change", function () {
    syncSmoother();
    particles.sync();
    applyParallax();
  });

  window.skyGear = { set: setGear, isOn: function () { return gearTwo; } };
})();
