// How unevenly the figure's dots slide against their neighbours as it turns: for every pixel of the shipped depth map
// inside the figure, its screen shift between yaw 0 and yaw 16 degrees (the engine's own reliefField, rotate, and
// project, at 1440 x 900, where the figure is 758 px across), and the local spread of that shift over 3 x 3 pixels. A
// rigid turn keeps the shift smooth; a spread is dots sliding apart (docs/next-4.md, step 2).
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/slide.mjs
// ROOT serves another checkout (a git worktree of an older commit, to compare). Prints the median, the 95th and 99th
// percentiles in px, and the share of pixels that slide more than 2 px apart.
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const { serve } = await import(path.join(REPO, 'test/e2e/server.mjs'));
const site = await serve(path.resolve(process.env.ROOT || REPO));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome' });
const page = await browser.newPage();
await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
const out = await page.evaluate(async () => {
  const hero = window.SkyHero;
  const bitmap = await createImageBitmap(await (await fetch('/assets/hero/depth.webp')).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  const size = bitmap.width, ctx = new OffscreenCanvas(size, size).getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const rgba = ctx.getImageData(0, 0, size, size).data, meta = await (await fetch('/assets/hero/hero.json')).json();
  const field = hero.reliefField(rgba, size, 1.5), yaw = 16 * Math.PI / 180, scale = 757.8;
  const shift = new Float32Array(size * size).fill(NaN);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    if (field[i] < 0) continue;
    const px = x / (size - 1) - meta.center[0], r = hero.rotate([px, 0, (field[i] - 0.62) * 0.34], yaw, 0);
    shift[i] = (r[0] * hero.project(r)[2] - px) * scale;
  }
  const spread = [];
  for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
    let n = 0, s = 0, s2 = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const v = shift[(y + dy) * size + x + dx]; if (!Number.isNaN(v)) { n++; s += v; s2 += v * v; } }
    if (n === 9) spread.push(Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)));
  }
  spread.sort((a, b) => a - b);
  const q = p => +spread[Math.floor(spread.length * p)].toFixed(2);
  return { median: q(0.5), p95: q(0.95), p99: q(0.99), over2px: +(spread.filter(v => v > 2).length / spread.length * 100).toFixed(2) };
});
console.log(JSON.stringify(out));
await browser.close();
site.server.close();
