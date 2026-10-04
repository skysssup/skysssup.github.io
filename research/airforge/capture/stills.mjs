// Captures the AirForge stills at device scale factor 2 from a running build (see record.mjs):
// an unclear stroke with its picker, and the Funnel example mid-run.
//   BASE=http://localhost:4173/airforge/ OUT=. node stills.mjs
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:4173/airforge/';
const OUT = process.env.OUT || '.';
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'light' });
await ctx.addInitScript(() => { localStorage.setItem('airforge.tutorialDismissed', '1'); localStorage.setItem('airforge.theme', 'light'); });
const page = await ctx.newPage();
// 1. a triangle: not a line, circle, or rectangle, so it stays dashed and the picker asks
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(1430, 470);
await page.waitForTimeout(1500);
const tri = [[600, 640], [720, 430], [840, 640], [600, 640]];
const pts = [];
for (let k = 0; k < 3; k++) for (let i = 0; i < 14; i++) { const t = i / 14; pts.push([tri[k][0] + (tri[k + 1][0] - tri[k][0]) * t + Math.sin(i * 1.3 + k) * 0.8, tri[k][1] + (tri[k + 1][1] - tri[k][1]) * t + Math.sin(i * 0.7 + k) * 0.8]); }
pts.push([602, 639]);
await page.mouse.move(...pts[0]); await page.mouse.down();
for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1]);
await page.mouse.up();
await page.mouse.move(1430, 470);
await page.waitForTimeout(800);
console.log('picker:', await page.evaluate(() => document.querySelector('.picker')?.innerText.replace(/\n+/g, ' | ')));
await page.screenshot({ path: `${OUT}/unclear-stroke-full.png` });
// 2. Funnel, mid-pour
await page.goto(BASE + '?example=funnel', { waitUntil: 'networkidle' });
await page.mouse.move(1430, 470);
await page.waitForTimeout(1500);
await page.keyboard.press('d');
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/funnel-full.png` });
await browser.close();
