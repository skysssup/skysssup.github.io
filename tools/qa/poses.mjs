// Poses of the hero under virtual time, for before/after crops (tools/qa/crops.py): the opening's hold frame, the figure
// at rest as the opening's shine ends (yaw 0, colours in), four frames of the opening's fast turn, the last frame
// before each sheen at both extremes of the idle sway (about +-15 degrees), and a crossing of the middle.
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/poses.mjs <out-dir> <light|dark|gear> [dpr]
// ROOT serves another checkout (a git worktree of an older commit). Writes <out>/<pose>.png (the figure's box and a
// margin) and <out>/poses.json (the clip, the figure's frame on the page, and each pose's yaw and pitch). W and H set
// the viewport (default 1440 x 900).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
const site = await serve(path.resolve(process.env.ROOT || REPO));
const [out, scheme = 'light', dprArg = '1'] = process.argv.slice(2);
const DPR = +dprArg, W = +(process.env.W || 1440), H = +(process.env.H || 900);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function openPage(intro) {
  const context = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: scheme === 'light' ? 'light' : 'dark', deviceScaleFactor: DPR });
  await context.addInitScript(({ scheme, intro }) => {
    try {
      if (!sessionStorage.getItem('qa-seeded')) {
        sessionStorage.setItem('qa-seeded', '1');
        if (!intro) sessionStorage.setItem('sky-intro', 'seen');
        localStorage.setItem('sky-theme', scheme === 'light' ? 'light' : 'dark');
        if (scheme === 'gear') sessionStorage.setItem('sky-gear', 'two');
        if (scheme === 'blue') sessionStorage.setItem('sky-gear', 'blue');
      }
    } catch (e) {}
    let now = performance.now(), frames = [], timers = [], id = 0;
    performance.now = () => now;
    window.requestAnimationFrame = fn => { frames.push([++id, fn]); return id; };
    window.cancelAnimationFrame = n => { frames = frames.filter(([k]) => k !== n); };
    window.setTimeout = (fn, ms = 0, ...rest) => { timers.push({ n: ++id, at: now + (+ms || 0), fn: () => typeof fn === 'function' && fn(...rest) }); return id; };
    window.clearTimeout = n => { timers = timers.filter(t => t.n !== n); };
    window.__u = {};
    const proto = WebGL2RenderingContext.prototype, names = new WeakMap(), loc = proto.getUniformLocation;
    proto.getUniformLocation = function (p, n) { const r = loc.call(this, p, n); if (r) names.set(r, n); return r; };
    for (const m of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f']) { const o = proto[m]; proto[m] = function (l, ...v) { const n = names.get(l); if (n && this.canvas.classList.contains('hero-dots')) window.__u[n] = v; return o.call(this, l, ...v); }; }
    window.__step = ms => {
      const end = now + ms;
      for (let t; (t = timers.sort((a, b) => a.at - b.at)[0]) && t.at <= end;) { timers.shift(); now = Math.max(now, t.at); t.fn(); }
      now = end;
      const due = frames; frames = [];
      due.forEach(([, fn]) => fn(now));
      const f = document.getElementById('figure');
      return { live: f.classList.contains('is-live'), intro: f.getAttribute('data-intro'), rot: window.__u.u_rot || [0, 0], sheen: (window.__u.u_sheen || [0, 0])[1] };
    };
  }, { scheme, intro });
  const page = await context.newPage();
  await page.goto(site.origin + '/', { waitUntil: 'networkidle' });
  let s = { live: false };
  for (let i = 0; i < 900 && !s.live; i++) { s = await page.evaluate(() => window.__step(16)); await page.waitForTimeout(10); }
  const frame = await page.evaluate(async () => {
    const r = document.getElementById('figure').getBoundingClientRect();
    const meta = await (await fetch('/assets/hero/hero.json')).json();
    const s = Math.min(r.width, r.height), b = meta.bounds, w = b[2] - b[0], h = b[3] - b[1];
    const scale = (s - 2 * s * 0.02) / Math.max(w, h);
    return { left: r.left + (r.width - s) / 2 + (s - w * scale) / 2 - b[0] * scale, top: r.top + (r.height - s) / 2 + (s - h * scale) / 2 - b[1] * scale, scale, rect: [r.left, r.top, r.width, r.height] };
  });
  const box = await page.locator('#figure').boundingBox();
  const clip = { x: Math.max(0, Math.round(box.x - 60)), y: Math.max(0, Math.round(box.y - 40)), width: Math.round(Math.min(W, box.width + 120)), height: Math.round(Math.min(H, box.height + 80)) };
  return { context, page, frame, clip };
}

const poses = {};
const shoot = async (page, clip, name, s) => { await page.screenshot({ path: `${out}/${name}.png`, clip }); poses[name] = { yaw: +(s.rot[0] * 180 / Math.PI).toFixed(2), pitch: +(s.rot[1] * 180 / Math.PI).toFixed(2), sheen: s.sheen, intro: s.intro }; };
const FPS = 25;
let meta;
if (scheme !== 'gear' && scheme !== 'blue') {
  // the opening: the hold frame, the end of its shine (at rest, colours in), and its fast turn
  const { context, page, frame, clip } = await openPage(true);
  meta = { frame, clip };
  let s = await page.evaluate(() => window.__step(16));
  await shoot(page, clip, 'hold', s);
  let turnAt = -1;
  for (let i = 0; i < 25 * 12 && s.intro !== 'red'; i++) {
    const prev = s.intro;
    s = await page.evaluate(ms => window.__step(ms), 1000 / FPS);
    if (prev === 'shine' && s.intro === 'turn') { turnAt = i; }
    if (s.intro === 'shine' && prev === 'hold') await shoot(page, clip, 'shine-start', s);
    if (s.intro === 'turn') {
      const k = i - turnAt;
      if (k === 0) await shoot(page, clip, 'rest', s);
      if (k === 20 || k === 35 || k === 50 || k === 62) await shoot(page, clip, `turn-${k}`, s);
    }
  }
  await context.close();
}
{
  // the idle sway: the clock advances by at most 50 ms a frame; poses near +16° (before the turn's sheen), the crossing,
  // and near -16°
  const { context, page, frame, clip } = await openPage(false);
  meta = meta || { frame, clip };
  // step 50 ms a frame; keep the last frame before each sheen starts once the yaw is past 11 degrees (the sway's
  // extremes; its sheen starts at the turn), and the first frame after the yaw crosses zero
  let s = await page.evaluate(() => window.__step(50)), prev = s, extremes = 0, crossed = 0;
  for (let i = 0; i < 1400 && (extremes < 3 || crossed < 2); i++) {
    s = await page.evaluate(() => window.__step(50));
    const yaw = s.rot[0] * 180 / Math.PI, was = prev.rot[0] * 180 / Math.PI;
    if (s.sheen === 0 && Math.abs(yaw) > 11) await shoot(page, clip, `sway-${yaw > 0 ? 'plus' : 'minus'}`, s);
    if (prev.sheen === 0 && s.sheen !== 0 && Math.abs(was) > 11) extremes++;
    if (Math.sign(yaw) !== Math.sign(was) && i > 20) { crossed++; if (crossed === 2) await shoot(page, clip, 'sway-cross', s); }
    prev = s;
  }
  await context.close();
}
fs.writeFileSync(`${out}/poses.json`, JSON.stringify({ ...meta, poses, dpr: DPR }, null, 1));
console.log(JSON.stringify(poses));
await browser.close();
site.server.close();
