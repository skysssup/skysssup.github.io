// The opening's hold frame (the first drawn figure, in plain ink, facing the viewer) under virtual time: reads the hero
// canvas right after its draw and prints a hash of its pixels, so a change that must not touch the first paint can be
// checked against the commit before it (ROOT=<a worktree of that commit>), bit for bit.
//   CHROME_PATH=/usr/bin/google-chrome-stable SCHEME=light node tools/qa/holdframe.mjs
// SCHEME=light|dark, W, H, DPR; OUT=path writes the raw RGBA pixels. ORIGIN or ROOT as in fps.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
let origin = process.env.ORIGIN, site = null;
if (!origin) { site = await serve(path.resolve(process.env.ROOT || REPO)); origin = site.origin; }
const W = +(process.env.W || 1440), H = +(process.env.H || 900), DPR = +(process.env.DPR || 1), scheme = process.env.SCHEME || 'light';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, colorScheme: scheme });
await context.addInitScript(() => {
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
  window.__grab = null;
  const proto = WebGL2RenderingContext.prototype, draw = proto.drawArrays;
  proto.drawArrays = function (...args) {
    const r = draw.apply(this, args);
    if (window.__want && this.canvas.classList.contains('hero-dots')) {
      const w = this.drawingBufferWidth, h = this.drawingBufferHeight, px = new Uint8Array(w * h * 4);
      this.readPixels(0, 0, w, h, this.RGBA, this.UNSIGNED_BYTE, px);
      window.__grab = { w, h, px: Array.from(px) };
      window.__want = false;
    }
    return r;
  };
});
const page = await context.newPage();
await page.goto(origin + '/', { waitUntil: 'networkidle' });
let state = { live: false };
for (let i = 0; i < 900 && !state.live; i++) { state = await page.evaluate(() => window.__step(16)); await page.waitForTimeout(15); }
for (let i = 0; i < 10; i++) state = await page.evaluate(() => window.__step(16));
await page.evaluate(() => { window.__want = true; window.__step(16); });
const grab = await page.evaluate(() => window.__grab && { w: window.__grab.w, h: window.__grab.h, px: window.__grab.px });
const stage = await page.evaluate(() => document.getElementById('figure').getAttribute('data-intro'));
let hash = 0, visible = 0;
for (let i = 0; i < grab.px.length; i++) { hash = (Math.imul(hash, 31) + grab.px[i]) >>> 0; if (i % 4 === 3 && grab.px[i]) visible++; }
console.log(JSON.stringify({ stage, w: grab.w, h: grab.h, hash, visible }));
if (process.env.OUT) fs.writeFileSync(process.env.OUT, Buffer.from(grab.px));
await browser.close();
site?.server.close();
