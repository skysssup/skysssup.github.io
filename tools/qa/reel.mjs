// A short reel of the hero for the owner, under virtual time (performance.now, requestAnimationFrame, and setTimeout are
// stepped by hand, so software rendering drops no frame), as numbered PNG frames of the figure:
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/reel.mjs <out-dir>
//   ffmpeg -framerate 25 -i <out-dir>/f%04d.png -vf "scale=672:-2,format=yuv420p" -c:v libx264 -crf 25 reel.mp4
// The segments are at the bottom: the light opening, dark paper through a turn and its sheen, the cursor stirring.
// Edit them to show what changed. ORIGIN uses a running server; otherwise the repository is served.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
const site = process.env.ORIGIN ? null : await serve(REPO);
const ORIGIN = process.env.ORIGIN || site.origin;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const FPS = 25, W = 1440, H = 900;
let frame = 0;
async function segment({ theme, intro, seconds, skip = 0, mouse = null, label }) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme === 'light' ? 'light' : 'dark', deviceScaleFactor: 1 });
  await context.addInitScript(({ theme, intro }) => {
    try {
      if (!sessionStorage.getItem('qa-seeded')) {
        sessionStorage.setItem('qa-seeded', '1');
        if (!intro) sessionStorage.setItem('sky-intro', 'seen');
        localStorage.setItem('sky-theme', theme === 'light' ? 'light' : 'dark');
      }
    } catch (e) {}
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
      return document.getElementById('figure').classList.contains('is-live');
    };
  }, { theme, intro });
  const page = await context.newPage();
  await page.goto(ORIGIN + '/', { waitUntil: 'networkidle' });
  let live = false;
  for (let i = 0; i < 900 && !live; i++) { live = await page.evaluate(() => window.__step(16)); await page.waitForTimeout(15); }
  for (let i = 0; i < skip * FPS; i++) await page.evaluate(ms => window.__step(ms), 1000 / FPS);
  const box = await page.locator('#figure').boundingBox();
  const clip = { x: Math.max(0, box.x - 70), y: Math.max(0, box.y - 50), width: Math.min(W, box.width + 140), height: Math.min(H, box.height + 100) };
  for (let i = 0; i < seconds * FPS; i++) {
    if (mouse) { const [mx, my] = mouse(i / FPS, box); await page.mouse.move(mx, my); }
    await page.evaluate(ms => window.__step(ms), 1000 / FPS);
    await page.screenshot({ path: `${out}/f${String(frame++).padStart(4, '0')}.png`, clip });
  }
  console.log(label, 'done at frame', frame, 'clip', JSON.stringify(clip));
  await context.close();
}
await segment({ theme: 'light', intro: true, seconds: 12.5, label: 'light opening' });
await segment({ theme: 'dark', intro: false, seconds: 8, skip: 1.2, label: 'dark, a turn and its sheen' });
await segment({ theme: 'light', intro: false, seconds: 5, skip: 3.5, label: 'the cursor stirs, a quick sweep puffs', mouse: (t, b) => {
  const cx = b.x + b.width * 0.5, cy = b.y + b.height * 0.55;
  if (t < 2.5) return [cx + Math.cos(t * 1.6) * b.width * 0.12, cy + Math.sin(t * 1.6) * b.height * 0.08];
  const q = (t - 2.5) / 1.2;
  return q < 1 ? [b.x + b.width * (0.2 + 0.55 * q), b.y + b.height * (0.45 + 0.15 * q)] : [b.x + b.width * 0.75, b.y + b.height * 0.6];
} });
await browser.close();
site?.server.close();
