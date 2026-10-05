// Visual QA helper, used while designing: screenshots, full-page captures after every reveal has fired,
// and a recording of the Gear Two switch. Needs the dev dependencies (`npm ci`) and Chrome for Playwright.
//
//   node tools/qa/shots.mjs shot  <url> <width> <height> <light|dark|gear> <out.png> [scrollY] [reduced=0|1]
//   node tools/qa/shots.mjs full  <url> <width> <height> <light|dark|gear> <out.png>
//   node tools/qa/shots.mjs video <out-dir> [light|dark|gear] [width] [height] [url]
//   node tools/qa/shots.mjs film  <out-dir> [light|dark|gear] [seconds] [width] [height] [fps]
//
// `film` plays the home page's opening under virtual time: performance.now, requestAnimationFrame, and setTimeout
// advance one frame per screenshot, so software rendering cannot drop frames (CSS animations still run in real
// time). It writes numbered PNGs of the figure; ffmpeg -framerate <fps> -i f%04d.png -pix_fmt yuv420p out.mp4.
//
// Environment: ORIGIN (default http://127.0.0.1:8080; set it to https://skysssup.github.io for the live site),
// DPR (device scale factor, default 1), CLIP=x,y,width,height (crop a `shot`).
import fs from 'node:fs';
import { chromium } from 'playwright';

const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const [mode, ...args] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(url, { width = 1440, height = 900, theme = 'light', reduced = false, touch = false, video, intro = false, setup } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: touch, isMobile: touch, deviceScaleFactor: Number(process.env.DPR || 1),
    recordVideo: video ? { dir: video, size: { width, height } } : undefined,
  });
  await context.addInitScript(({ m, intro }) => {
    try {
      if (!sessionStorage.getItem('qa-seeded')) {
        sessionStorage.setItem('qa-seeded', '1');
        if (!intro) sessionStorage.setItem('sky-intro', 'seen');
        localStorage.setItem('sky-theme', m === 'light' ? 'light' : 'dark');
        if (m === 'gear') sessionStorage.setItem('sky-gear', 'two');
      }
    } catch (e) {}
  }, { m: theme, intro });
  if (setup) await context.addInitScript(setup);
  const page = await context.newPage();
  const problems = [];
  page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => problems.push(`pageerror: ${err.message}`));
  await page.goto(ORIGIN + url, { waitUntil: 'networkidle' });
  return { page, context, problems };
}

if (mode === 'shot') {
  const [url, w, h, theme, out, scrollY = '0', reduced = '0'] = args;
  const { page, problems } = await open(url, { width: +w, height: +h, theme, reduced: reduced === '1', touch: +w < 768 });
  await page.waitForTimeout(url === '/' ? 2600 : 500);
  if (+scrollY) { await page.evaluate(y => scrollTo(0, y), +scrollY); await page.waitForTimeout(900); }
  const clip = process.env.CLIP ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, Number(process.env.CLIP.split(',')[i])])) : undefined;
  await page.screenshot({ path: out, clip });
  console.log('problems', JSON.stringify(problems));
} else if (mode === 'full') {
  const [url, w, h, theme, out] = args;
  const { page, problems } = await open(url, { width: +w, height: +h, theme, touch: +w < 768 });
  await page.waitForTimeout(url === '/' ? 2600 : 500);
  const total = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < total; y += Math.round(+h * 0.6)) { await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(250); }
  await page.waitForTimeout(1200);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(600);
  await page.screenshot({ path: out, fullPage: true });
  console.log('problems', JSON.stringify(problems), 'height', total);
} else if (mode === 'video') {
  const [out, theme = 'light', w = '1440', h = '900', url = '/'] = args;
  const { page, context, problems } = await open(url, { width: +w, height: +h, theme, video: out });
  await page.waitForTimeout(2600);
  await page.mouse.move(700, 450);
  await page.click('[data-gear-toggle]');
  await page.waitForTimeout(2600);
  await page.click('[data-gear-toggle]');
  await page.waitForTimeout(1200);
  const video = page.video();
  await context.close();
  console.log('video', await video.path(), 'problems', JSON.stringify(problems));
  console.log('frames: ffmpeg -i <video> -vf fps=25 frame-%03d.png');
} else if (mode === 'film') {
  const [out, theme = 'light', secs = '11', w = '1440', h = '900', fps = '25'] = args;
  fs.mkdirSync(out, { recursive: true });
  const { page, problems } = await open('/', { width: +w, height: +h, theme, touch: +w < 768, intro: true, setup: () => {
    let now = performance.now(), frames = [], timers = [], id = 0;
    performance.now = () => now;
    window.requestAnimationFrame = fn => { frames.push([++id, fn]); return id; };
    window.cancelAnimationFrame = n => { frames = frames.filter(([k]) => k !== n); };
    window.setTimeout = (fn, ms = 0, ...rest) => { timers.push({ n: ++id, at: now + (+ms || 0), fn: () => typeof fn === 'function' && fn(...rest) }); return id; };
    window.clearTimeout = n => { timers = timers.filter(t => t.n !== n); };
    window.__step = ms => {
      const end = now + ms;
      for (let t; (t = timers.sort((a, b) => a.at - b.at)[0]) && t.at <= end;) { timers.shift(); now = Math.max(now, t.at); t.fn(); }
      now = end;
      const due = frames; frames = [];
      due.forEach(([, fn]) => fn(now));
      const figure = document.getElementById('figure');
      return { live: figure.classList.contains('is-live'), intro: figure.getAttribute('data-intro') };
    };
  } });
  let state = { live: false };
  for (let i = 0; i < 600 && !state.live; i++) { state = await page.evaluate(() => window.__step(16)); await page.waitForTimeout(20); }
  const box = await page.locator('#figure').boundingBox();
  const clip = { x: Math.max(0, box.x - 64), y: Math.max(0, box.y - 64), width: Math.min(+w, box.width + 128), height: Math.min(+h, box.height + 128) };
  for (let i = 0; i < +secs * +fps; i++) {
    state = await page.evaluate(ms => window.__step(ms), 1000 / +fps);
    await page.screenshot({ path: `${out}/f${String(i).padStart(4, '0')}.png`, clip });
    if (i % +fps === 0) console.log(`${(i / +fps).toFixed(0)} s: ${state.intro}`);
  }
  console.log('problems', JSON.stringify(problems));
} else {
  console.log('usage: node tools/qa/shots.mjs shot|full|video|film ...');
}
await browser.close();
