// The hero's frame rate under SwiftShader (as CI renders it): frames a second of the hero canvas at 1280 x 800 in light
// and dark (SCHEMES=light,dark,gear), split into frames with a sheen's gust on and idle ones.
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/fps.mjs
// ROOT serves another checkout (a git worktree of an older commit, to compare), or ORIGIN uses a running server.
// SECONDS (default 14) per sample, RUNS (default 2) samples per scheme, W, H, DPR. Prints medians as JSON.
// For profiling, SUBS='[["from","to"]]' (or [pattern, replacement, regexFlags]) rewrites the shaders' source before
// they compile, and NORING=1 (or NORING=stroke) skips the ring's glyphs (or only their halos). Run it on a quiet
// machine, and run it twice: one sample varies by 5-10%.
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
let origin = process.env.ORIGIN, site = null;
if (!origin) { site = await serve(path.resolve(process.env.ROOT || REPO)); origin = site.origin; }
const SECONDS = +(process.env.SECONDS || 14), RUNS = +(process.env.RUNS || 2);
const W = +(process.env.W || 1280), H = +(process.env.H || 800), DPR = +(process.env.DPR || 1);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const schemes = (process.env.SCHEMES || 'light,dark' + (process.env.GEAR ? ',gear' : '')).split(',');
const out = {};
for (const scheme of schemes) {
  const rates = [], ms = [], idles = [], gusts = [];
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, colorScheme: scheme === 'light' ? 'light' : 'dark' });
    await context.addInitScript(subs => {
      try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {}
      const proto0 = WebGL2RenderingContext.prototype, source = proto0.shaderSource;
      proto0.shaderSource = function (sh, src) {
        for (const [a, b, flags] of subs.list) src = flags != null ? src.replace(new RegExp(a, flags), b) : src.split(a).join(b);
        return source.call(this, sh, src);
      };
      if (subs.noring) {
        const p2 = CanvasRenderingContext2D.prototype, ft = p2.fillText, st = p2.strokeText;
        if (subs.noring !== 'stroke') p2.fillText = function (...a) { if (this.canvas.classList.contains('hero-words')) return; return ft.apply(this, a); };
        p2.strokeText = function (...a) { if (this.canvas.classList.contains('hero-words')) return; return st.apply(this, a); };
      }
      window.__draws = [];
      const proto = WebGL2RenderingContext.prototype, draw = proto.drawArrays;
      const names = new WeakMap(), loc = proto.getUniformLocation, u4 = proto.uniform4f, state = { sheen: 0, last: 0 };
      proto.getUniformLocation = function (p, n) { const r = loc.call(this, p, n); if (r) names.set(r, n); return r; };
      proto.uniform4f = function (l, a, b, c, d) { const n = names.get(l); if (n === 'u_sheen') state.sheen = b; if (n === 'u_last') state.last = b; return u4.call(this, l, a, b, c, d); };
      let frameAt = -1;
      proto.drawArrays = function (...args) {
        if (this.canvas.classList.contains('hero-dots')) {
          const now = performance.now();
          // one entry per frame (a frame may draw more than once during Gear Two's glitch)
          if (now - frameAt > 4) window.__draws.push([now, state.sheen !== 0 || state.last !== 0 ? 1 : 0]);
          frameAt = now;
        }
        return draw.apply(this, args);
      };
    }, { list: JSON.parse(process.env.SUBS || '[]'), noring: process.env.NORING || '' });
    const page = await context.newPage();
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'), null, { timeout: 60000 });
    if (scheme === 'gear') { await page.evaluate(() => window.skyGear.setGear(true)); }
    await page.waitForTimeout(4000);
    const t0 = await page.evaluate(() => performance.now());
    await page.waitForTimeout(SECONDS * 1000);
    const r = await page.evaluate(t0 => {
      const d = window.__draws.filter(([t]) => t >= t0);
      const text = (document.querySelector('[data-hero-telemetry]') || {}).textContent || '';
      // frame intervals, split by whether a gust (this sheen's or the last's) was on at the frame that began them
      let idle = 0, idleN = 0, gust = 0, gustN = 0;
      for (let i = 1; i < d.length; i++) { const dt = d[i][0] - d[i - 1][0]; if (d[i - 1][1]) { gust += dt; gustN++; } else { idle += dt; idleN++; } }
      return { n: d.length, span: (performance.now() - t0) / 1000, text, idle: idleN ? idleN / idle * 1000 : 0, gust: gustN ? gustN / gust * 1000 : 0, idleShare: idle / (idle + gust) };
    }, t0);
    rates.push(r.n / r.span);
    ms.push(r.text);
    idles.push(r.idle); gusts.push(r.gust);
    await context.close();
  }
  rates.sort((a, b) => a - b);
  const med = list => { const s = list.slice().sort((a, b) => a - b); return +s[s.length >> 1].toFixed(1); };
  out[scheme] = { median: med(rates), idle: med(idles), gust: med(gusts), all: rates.map(x => +x.toFixed(1)), idleAll: idles.map(x => +x.toFixed(1)), gustAll: gusts.map(x => +x.toFixed(1)), readout: ms.map(s => s.replace(/.*°/, '')) };
}
console.log(JSON.stringify(out));
await browser.close();
site?.server.close();
