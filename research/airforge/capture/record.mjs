// Records the AirForge lead clip from a running build: draw a ramp, a ball, and a platform with the mouse, press D
// (Drop), then Clear so the clip loops. The page clock runs at SCALE of real time so software WebGL keeps up; the
// frames are re-timed by SCALE when encoding, so the clip plays at real speed.
//   In an AirForge checkout: npm run build && npx vite preview --port 4173
//   Here: npm i playwright && BASE=http://localhost:4173/airforge/ OUT=frames node record.mjs
//   Encode: write an ffmpeg concat list from frames.json (duration = timestamp gap x scale), then
//   ffmpeg -f concat -safe 0 -i concat.txt -vf "fps=30,scale=1440:900:flags=lanczos,format=yuv420p" \
//     -c:v libx264 -preset slow -crf 23 -tune animation -movflags +faststart -an overview.mp4
import { chromium } from 'playwright';
import fs from 'node:fs';
const SCALE = 0.4;
const BASE = process.env.BASE || 'http://localhost:4173/airforge/';
const OUT = process.env.OUT || 'frames';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light' });
await ctx.addInitScript(scale => {
  localStorage.setItem('airforge.tutorialDismissed', '1');
  localStorage.setItem('airforge.theme', 'light');
  const now = performance.now.bind(performance), t0 = now();
  performance.now = () => t0 + (now() - t0) * scale;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(performance.now()));
}, SCALE);
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.mouse.move(1430, 470);
await page.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async f => {
  frames.push(f.metadata.timestamp);
  fs.writeFileSync(`${OUT}/${String(frames.length).padStart(5, '0')}.jpg`, Buffer.from(f.data, 'base64'));
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
const jitter = (i, a = 1.2) => Math.sin(i * 1.7) * a + Math.sin(i * 0.53) * a * 0.6;
async function stroke(points, ms) {
  await page.mouse.move(points[0][0], points[0][1]);
  await page.mouse.down();
  const dt = ms / points.length;
  for (let i = 1; i < points.length; i++) { await page.mouse.move(points[i][0], points[i][1]); await page.waitForTimeout(dt); }
  await page.mouse.up();
}
const wait = s => page.waitForTimeout(s * 1000 / SCALE);
await wait(0.9);
const ramp = []; for (let i = 0; i <= 16; i++) { const t = i / 16; ramp.push([250 + t * 560 + jitter(i), 300 + t * 300 + jitter(i + 9)]); }
await stroke(ramp, 1600);
await wait(0.45);
const ball = []; for (let i = 0; i <= 22; i++) { const a = -Math.PI / 2 + (i / 22) * Math.PI * 2.05; ball.push([292 + Math.cos(a) * 26 + jitter(i, 0.6), 222 + Math.sin(a) * 26 + jitter(i + 3, 0.6)]); }
await stroke(ball, 1700);
await wait(0.45);
const rect = (x0, y0, x1, y1, n) => { const c = [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0 + 0.5]]; const out = []; for (let k = 0; k < 4; k++) for (let i = 0; i < n; i++) { const t = i / n; out.push([c[k][0] + (c[k + 1][0] - c[k][0]) * t + jitter(k * n + i, 0.5), c[k][1] + (c[k + 1][1] - c[k][1]) * t + jitter(k * n + i + 5, 0.5)]); } out.push(c[4]); return out; };
await stroke(rect(1010, 716, 1405, 752, 10), 1900);
await wait(0.7);
await page.keyboard.press('d');
await wait(4.6);
const state = await page.evaluate(() => document.body.innerText.split('\n').filter(Boolean).slice(-1)[0]);
await page.click('button[aria-label="Clear"]');
await wait(1.1);
await cdp.send('Page.stopScreencast');
fs.writeFileSync(`${OUT}.json`, JSON.stringify({ scale: SCALE, ts: frames }));
console.log('frames', frames.length, 'wall span', (frames.at(-1) - frames[0]).toFixed(2), 's; video span', ((frames.at(-1) - frames[0]) * SCALE).toFixed(2), 's; status:', state, logs.length ? 'ERRORS ' + logs.join(' | ') : '');
await browser.close();
