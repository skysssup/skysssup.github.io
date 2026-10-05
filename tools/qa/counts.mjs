// The figure's dot counts (the caption's, glints not counted) per paper, viewport, and device pixel ratio, and how long
// each page took to show the drawn figure:
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/counts.mjs
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
const site = await serve(path.resolve(process.env.ROOT || REPO));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = [];
for (const [w, h, dpr, mobile] of [[1440, 900, 1, false], [1440, 900, 2, false], [390, 844, 1, true], [390, 844, 2, true], [1280, 800, 1, false]]) {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: scheme, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
    await context.addInitScript(() => { try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {} });
    const page = await context.newPage();
    const t0 = Date.now();
    await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live'), null, { timeout: 60000 });
    const dots = await page.textContent('[data-dot-count]');
    out.push(`${w}x${h}@${dpr} ${scheme}: ${dots} (${Date.now() - t0} ms to live)`);
    await context.close();
  }
}
console.log(out.join('\n'));
await browser.close();
site.server.close();
