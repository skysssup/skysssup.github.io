(function () {
  const root = document.documentElement;
  const gear = document.getElementById("gear");
  const motion = document.getElementById("motion");
  const logo = document.getElementById("logo");
  const canvas = document.getElementById("logo-canvas");
  const ctx = canvas.getContext("2d");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const about = document.getElementById("about-panel");
  const open = document.getElementById("about-open");
  const lights = document.getElementById("lights");
  const flip = document.getElementById("flip");
  let paused = reduced.matches;
  let visible = true;
  let ready = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let burst = 0;
  let intense = false;
  let timers = [];
  let smoother = null;
  let transition = null;
  let recoil = [];
  const points = [];
  const words = "AAKASH/AI/BUILD/SHIP/EXPERIMENT/";
  const image = new Image();

  function lightLabel() {
    const dark = intense || flip.getAttribute("aria-pressed") === "true";
    lights.setAttribute("aria-pressed", String(dark));
    lights.setAttribute("aria-label", dark ? "Turn lights on" : "Turn lights off");
    document.getElementById("light-label").textContent = dark ? "LIGHTS OFF" : "LIGHTS ON";
    lights.querySelector(".switch-icon").textContent = dark ? "☾" : "☼";
  }

  function setGear(next) {
    intense = next;
    root.setAttribute("data-gear", intense ? "two" : "one");
    gear.setAttribute("aria-pressed", String(intense));
    gear.textContent = intense ? "[ REALITY ]" : "[ GEAR TWO ]";
    burst = 1;
    lightLabel();
    draw();
  }

  function clearTransition() {
    timers.forEach(clearTimeout);
    timers = [];
    root.removeAttribute("data-phase");
  }

  function clock() {
    const now = new Date();
    const time = document.getElementById("clock");
    time.textContent = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(now);
    time.dateTime = now.toISOString();
    document.getElementById("year").textContent = String(now.getFullYear());
  }

  function draw() {
    if (!ready) return;
    const styles = getComputedStyle(root);
    const blue = styles.getPropertyValue("--blue").trim();
    ctx.clearRect(0, 0, 600, 720);
    const cycle = paused ? 0 : elapsed % 9000;
    const dissolve = cycle > 6200 ? Math.sin((cycle - 6200) / 2800 * Math.PI) : 0;
    const scatter = paused ? 0 : Math.max(dissolve, burst);
    ctx.globalAlpha = 1 - scatter;
    ctx.fillStyle = styles.getPropertyValue("--logo-base").trim();
    ctx.save();
    ctx.scale(600 / 41.7, 720 / 50);
    ctx.fill(new Path2D("M20.85 0 L41.7 50 H30.2 L20.85 24.5 L11.5 50 H0 Z"));
    ctx.restore();
    ctx.fillStyle = blue;
    ctx.font = "bold 13px monospace";
    const shift = Math.floor(elapsed / 240);
    for (const point of points) {
      const wave = Math.sin(point.y * .026 + elapsed * .0018);
      const amount = scatter * (intense ? 120 : 70);
      if (!paused && scatter > .65 && point.seed < scatter * .7) continue;
      ctx.globalAlpha = paused ? .85 : Math.max(.12, .78 + wave * .2 - scatter * .35);
      const x = point.x + Math.sin(point.seed * 70 + elapsed * .001) * amount;
      const y = point.y + Math.cos(point.seed * 80 + elapsed * .001) * amount;
      ctx.fillText(words[(point.index + shift) % words.length], x, y);
      if (intense && scatter > .2 && point.index % 7 === 0) {
        ctx.globalAlpha = .4;
        ctx.fillStyle = "#57cbd6";
        ctx.fillText(words[(point.index + shift) % words.length], x + 5, y - 2);
        ctx.fillStyle = blue;
      }
    }
    if (!paused && scatter > .3) {
      ctx.globalAlpha = .7;
      for (let i = 0; i < 5; i++) {
        const y = (elapsed * .08 + i * 143) % 720;
        ctx.clearRect(0, y, 600, intense ? 18 : 8);
        ctx.fillRect((i * 127 + elapsed * .03) % 560, y, 30, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  function animate(time) {
    frame = 0;
    if (paused || !visible || document.hidden || !ready) return;
    const delta = last ? Math.min(time - last, 100) : 0;
    if (delta >= 40 || !last) {
      elapsed += delta;
      burst = Math.max(0, burst - delta / 1800);
      last = time;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function sync() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
    root.setAttribute("data-motion", paused ? "paused" : "running");
    motion.setAttribute("aria-pressed", String(paused));
    motion.textContent = paused ? "[ RESUME MOTION ]" : "[ PAUSE MOTION ]";
    if (paused) {
      clearTransition();
      transition?.skipTransition();
      recoil.forEach(function (animation) { animation.cancel(); });
      smoother?.destroy();
      smoother = null;
    } else if (!smoother && window.Lenis) {
      smoother = new window.Lenis({ autoRaf: true, duration: 1.15, smoothWheel: true, anchors: true });
    }
    draw();
    if (!paused && visible && !document.hidden && ready) frame = requestAnimationFrame(animate);
  }

  image.onload = function () {
    const mask = document.createElement("canvas");
    mask.width = 600;
    mask.height = 720;
    const sample = mask.getContext("2d");
    if (!sample || !ctx) return;
    sample.drawImage(image, 0, 0, 600, 720);
    const pixels = sample.getImageData(0, 0, 600, 720).data;
    for (let y = 14; y < 720; y += 16) {
      for (let x = 2; x < 600; x += 8) {
        if (pixels[(y * 600 + x) * 4 + 3] < 128) continue;
        const index = points.length;
        points.push({ x, y, index, seed: ((index * 137 + 41) % 997) / 997 });
      }
    }
    ready = true;
    logo.classList.add("is-ready");
    sync();
  };
  image.src = "assets/mark.svg";

  gear.addEventListener("click", function () {
    clearTransition();
    setGear(!intense);
    if (paused) return;
    root.setAttribute("data-phase", intense ? "flash" : "glitch");
    timers.push(setTimeout(function () { root.setAttribute("data-phase", "glitch"); }, 150));
    timers.push(setTimeout(function () { root.setAttribute("data-phase", "settle"); }, 800));
    timers.push(setTimeout(clearTransition, 1400));
  });
  lights.addEventListener("click", async function () {
    if (transition) return;
    const toggle = function () {
      clearTransition();
      if (intense) {
        setGear(false);
        if (flip.getAttribute("aria-pressed") === "true") flip.click();
      } else flip.click();
      lightLabel();
    };
    if (paused || !document.startViewTransition) { toggle(); return; }
    const rect = lights.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    transition = document.startViewTransition(toggle);
    try {
      await transition.ready;
      if (paused) { transition.skipTransition(); return; }
      const animation = root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] }, { duration: 850, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" });
      await animation.finished;
      if (!paused) document.querySelector(".edge-ripple").animate([{ opacity: .4 }, { opacity: 0 }], { duration: 550, easing: "ease-out" });
    } catch (_) {
    } finally {
      transition = null;
    }
  });
  window.addEventListener("wheel", function (event) {
    if (paused || event.ctrlKey || Math.abs(event.deltaY) < 8 || recoil.some(function (animation) { return animation.playState === "running"; })) return;
    const bottom = document.documentElement.scrollHeight - innerHeight;
    const edge = scrollY <= 1 && event.deltaY < 0 ? 1 : scrollY >= bottom - 1 && event.deltaY > 0 ? -1 : 0;
    if (!edge) return;
    recoil = Array.from(document.querySelectorAll("main, footer"), function (element) {
      return element.animate([{ transform: "translateY(0)" }, { transform: `translateY(${edge * 9}px)`, offset: .25 }, { transform: "translateY(0)" }], { duration: 650, easing: "cubic-bezier(.2,.7,.2,1)" });
    });
  }, { passive: true });
  motion.addEventListener("click", function () { paused = !paused; sync(); });
  logo.addEventListener("click", function () { burst = 1; elapsed = 0; draw(); });
  reduced.addEventListener("change", function () { paused = reduced.matches; sync(); });
  document.addEventListener("visibilitychange", sync);
  new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; sync(); }).observe(logo);
  new MutationObserver(draw).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  new MutationObserver(lightLabel).observe(flip, { attributes: true, attributeFilter: ["aria-pressed"] });
  document.getElementById("about-close").addEventListener("click", function () {
    about.hidden = true;
    open.hidden = false;
    open.setAttribute("aria-expanded", "false");
    open.focus();
  });
  open.addEventListener("click", function () {
    about.hidden = false;
    open.hidden = true;
    open.setAttribute("aria-expanded", "true");
    document.getElementById("about-close").focus();
  });
  clock();
  lightLabel();
  setInterval(clock, 1000 * 30);
  sync();
})();
