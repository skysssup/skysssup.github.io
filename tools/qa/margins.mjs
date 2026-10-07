// Margins of the two e2e tests that frame rate decides: the touch drag's yaw change (the test needs > 0.06) and the
// ring's brightening on a theme hover (peak over rest needs > 1.3, measured from the in-page mouseenter). Run it on two
// cores to see what CI's slower runner sees:
//   CHROME_PATH=/usr/bin/google-chrome-stable taskset -c 0,1 node tools/qa/margins.mjs
// ROOT or ORIGIN as in fps.mjs; RUNS (default 3).
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
let origin = process.env.ORIGIN, site = null;
if (!origin) { site = await serve(path.resolve(process.env.ROOT || REPO)); origin = site.origin; }
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const probe = () => {
  try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {}
  const p = window.__p = { uniforms: {}, draws: [] };
  const proto = WebGL2RenderingContext.prototype, names = new WeakMap(), loc = proto.getUniformLocation;
  proto.getUniformLocation = function (pr, n) { const r = loc.call(this, pr, n); if (r) names.set(r, n); return r; };
  for (const m of ['uniform1f', 'uniform2f', 'uniform4f']) { const o = proto[m]; proto[m] = function (l, ...v) { const n = names.get(l); if (n) p.uniforms[n] = v; return o.call(this, l, ...v); }; }
  const draw = proto.drawArrays;
  proto.drawArrays = function (...a) { if (this.canvas.classList.contains('hero-dots')) p.draws.push(performance.now()); return draw.apply(this, a); };
};
const RUNS = +(process.env.RUNS || 3), out = { touch: [], ring: [], touchFps: [] };
for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await context.addInitScript(probe);
  const page = await context.newPage();
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'), null, { timeout: 60000 });
  const box = await page.locator('#figure').boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2, cdp = await context.newCDPSession(page);
  const send = (type, px = x, py = y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: px, y: py, id: 1 }] });
  const t0 = await page.evaluate(() => performance.now());
  await send('touchStart');
  await send('touchMove', x + 140, y + 10);
  await page.waitForTimeout(650);
  const right = (await page.evaluate(() => window.__p.uniforms.u_rot))[0];
  for (const dx of [70, 14, 0, -14, -70, -140]) await send('touchMove', x + dx, y + 10);
  await page.waitForTimeout(850);
  const left = (await page.evaluate(() => window.__p.uniforms.u_rot))[0];
  const fps = await page.evaluate(t0 => window.__p.draws.filter(t => t > t0).length / ((performance.now() - t0) / 1000), t0);
  out.touch.push(+(right - left).toFixed(3));
  out.touchFps.push(+fps.toFixed(1));
  await send('touchCancel');
  await context.close();
}
for (let run = 0; run < RUNS; run++) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(probe);
  const page = await context.newPage();
  await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'), null, { timeout: 60000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const proto = CanvasRenderingContext2D.prototype, fill = proto.fillText, clear = proto.clearRect;
    let sum = 0;
    window.__ring = [];
    proto.clearRect = function (...args) { if (this.canvas.classList.contains('hero-words')) { if (sum) window.__ring.push([performance.now(), sum]); sum = 0; } return clear.apply(this, args); };
    proto.fillText = function (...args) { if (this.canvas.classList.contains('hero-words')) sum += this.globalAlpha; return fill.apply(this, args); };
  });
  await page.waitForTimeout(600);
  const before = await page.evaluate(() => performance.now());
  await page.evaluate(() => document.querySelector('[data-work-link]').addEventListener('mouseenter', () => { window.__entered = performance.now(); }, { once: true }));
  await page.hover('[data-work-link]');
  await page.waitForTimeout(1100);
  const entered = await page.evaluate(() => window.__entered);
  const frames = await page.evaluate(() => window.__ring);
  const median = list => list.slice().sort((a, b) => a - b)[list.length >> 1];
  const measure = from => {
    const rest = median(frames.filter(([t]) => t < from).map(([, v]) => v));
    const peak = Math.max(...frames.filter(([t]) => t > from && t < from + 500).map(([, v]) => v));
    const after = median(frames.filter(([t]) => t > from + 700).map(([, v]) => v));
    return { ratio: +(peak / rest).toFixed(2), settle: +(after / rest).toFixed(2) };
  };
  out.ring.push({ delay: Math.round(entered - before), fromEnter: measure(entered), fromBefore: measure(before) });
  await context.close();
}
console.log(JSON.stringify(out));
await browser.close();
site?.server.close();
