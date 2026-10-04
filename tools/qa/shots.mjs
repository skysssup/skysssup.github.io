// Visual QA helper, used while designing: screenshots, full-page captures after every reveal has fired,
// and a recording of the Gear Two switch. Needs the dev dependencies (`npm ci`) and Chrome for Playwright.
//
//   node tools/qa/shots.mjs shot  <url> <width> <height> <light|dark|gear> <out.png> [scrollY] [reduced=0|1]
//   node tools/qa/shots.mjs full  <url> <width> <height> <light|dark|gear> <out.png>
//   node tools/qa/shots.mjs video <out-dir> [light|dark|gear] [width] [height] [url]
//
// Environment: ORIGIN (default http://127.0.0.1:8080; set it to https://skysssup.github.io for the live site),
// DPR (device scale factor, default 1), CLIP=x,y,width,height (crop a `shot`).
import { chromium } from 'playwright';

const ORIGIN = process.env.ORIGIN || 'http://127.0.0.1:8080';
const [mode, ...args] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

async function open(url, { width = 1440, height = 900, theme = 'light', reduced = false, touch = false, video } = {}) {
  const context = await browser.newContext({
    viewport: { width, height }, colorScheme: theme === 'light' ? 'light' : 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: touch, isMobile: touch, deviceScaleFactor: Number(process.env.DPR || 1),
    recordVideo: video ? { dir: video, size: { width, height } } : undefined,
  });
  await context.addInitScript(m => {
    try {
      if (!sessionStorage.getItem('qa-seeded')) {
        sessionStorage.setItem('qa-seeded', '1');
        localStorage.setItem('sky-theme', m === 'light' ? 'light' : 'dark');
        if (m === 'gear') sessionStorage.setItem('sky-gear', 'two');
      }
    } catch (e) {}
  }, theme);
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
} else {
  console.log('usage: node tools/qa/shots.mjs shot|full|video ...');
}
await browser.close();
