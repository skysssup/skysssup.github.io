// Renders the 1200x630 share images in assets/og/ from each page's own title, summary, and visual.
// Run after changing a page's title, summary, or cover:  npm run og   (needs the dev dependencies)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '';
};
const dataUrl = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
const fonts = `
@font-face { font-family: S; src: url(${dataUrl('assets/fonts/instrument-sans-var.woff2', 'font/woff2')}); font-weight: 400 500; }
@font-face { font-family: M; src: url(${dataUrl('assets/fonts/fragment-mono-400.woff2', 'font/woff2')}); }`;

function card({ kicker, title, summary, label, visual, still }) {
  return `<!doctype html><html><head><style>${fonts}
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; background: #fff; color: #0c0c0c; font-family: S; position: relative; overflow: hidden; }
  .lines { position: absolute; inset: 0 32px; display: grid; grid-template-columns: repeat(2, 1fr); }
  .lines span { border-left: 1px solid rgba(12,12,12,.1); } .lines span:last-child { border-right: 1px solid rgba(12,12,12,.1); }
  .rule { position: absolute; left: 32px; right: 32px; top: 72px; border-top: 1px solid rgba(12,12,12,.1); }
  .mono { font: 400 15px/20px M; letter-spacing: .06em; text-transform: uppercase; }
  .top { position: absolute; top: 26px; left: 52px; right: 52px; display: flex; justify-content: space-between; }
  .muted { color: #6a6a6a; }
  .text { position: absolute; left: 52px; top: 120px; width: 500px; }
  h1 { font: 500 54px/60px S; letter-spacing: -.015em; margin-top: 14px; }
  p { font: 400 24px/34px S; margin-top: 20px; color: #2a2a2a; }
  .label { position: absolute; left: 52px; bottom: 40px; color: #1f3bff; }
  .visual { position: absolute; right: 52px; top: 112px; width: 528px; height: 330px; border: 1px solid rgba(12,12,12,.14); overflow: hidden; background: #f4f4f2; }
  .visual img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .still { position: absolute; right: 70px; top: 86px; width: 520px; height: 520px; background: #0c0c0c; -webkit-mask: url(${dataUrl('assets/hero/still.webp', 'image/webp')}) center / contain no-repeat; }
  </style></head><body>
  <div class="lines"><span></span><span></span></div><div class="rule"></div>
  <div class="top mono"><span>Aakash Dahal</span><span class="muted">skysssup.github.io</span></div>
  <div class="text"><div class="mono muted">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(summary)}</p></div>
  ${still ? '<div class="still"></div>' : visual ? `<div class="visual"><img src="${visual}"></div>` : ''}
  <div class="label mono">${esc(label)}</div>
  </body></html>`;
}

const jobs = [];
const home = read('index.html');
jobs.push({ out: 'home.png', html: card({ kicker: 'Developer tools · Physics software', title: 'Aakash Dahal', summary: meta(home, 'description'), label: 'Work · Contact', still: true }) });
const work = read('work/index.html');
jobs.push({ out: 'work.png', html: card({ kicker: 'Work', title: 'Eight projects', summary: 'AI systems, developer tools, and physics software, each with a case study.', label: 'AI systems · Developer tools · Physics software', still: true }) });
for (const slug of fs.readdirSync(path.join(root, 'work'))) {
  const file = path.join('work', slug, 'index.html');
  if (!fs.existsSync(path.join(root, file))) continue;
  const html = read(file);
  const title = meta(html, 'og:title').replace(/ — Aakash Dahal$/, '');
  const cover = path.join('work', slug, 'media', 'cover-1344.webp');
  const themes = (html.match(/<dt class="t-label">Themes<\/dt><dd>([^<]*)<\/dd>/) || [])[1] || '';
  jobs.push({ out: `${slug}.png`, html: card({ kicker: 'Case study · ' + themes.replace(/&amp;/g, '&'), title, summary: (html.match(/<div class="case-title">\s*<h1>[^<]*<\/h1>\s*<p>([^<]*)<\/p>/) || [])[1] || '', label: 'skysssup.github.io/work/' + slug, visual: fs.existsSync(path.join(root, cover)) ? dataUrl(cover, 'image/webp') : null }) });
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const job of jobs) {
  await page.setContent(job.html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, 'assets', 'og', job.out) });
  console.log('assets/og/' + job.out);
}
await browser.close();
