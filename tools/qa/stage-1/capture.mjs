import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(process.argv[2] || '.');
const out = path.resolve(process.argv[3] || './new-static-audit');
const sourceSha = process.env.SOURCE_SHA || 'not supplied';
const W = +(process.env.W || 1440), H = +(process.env.H || 900);
const assetHashes = Object.fromEntries(['ink.webp', 'light.webp', 'depth.webp', 'color.webp', 'hero.json'].map(name =>
  [name, createHash('sha256').update(fs.readFileSync(path.join(root, 'assets/hero', name))).digest('hex')]));
const require = createRequire(path.join(root, 'package.json'));
const { chromium } = require('playwright');
const { serve } = await import(pathToFileURL(path.join(root, 'test/e2e/server.mjs')));
const site = await serve(root);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const summary = [];

try {
  for (const dpr of (process.env.DPRS || '1,2').split(',').map(Number)) {
    for (const mode of (process.env.MODES || 'light,dark,blue,gear').split(',')) {
      const folder = path.join(out, `${mode}-dpr${dpr}`);
      fs.mkdirSync(folder, { recursive: true });
      const context = await browser.newContext({
        viewport: { width: W, height: H },
        colorScheme: mode === 'light' ? 'light' : 'dark',
        reducedMotion: 'reduce',
        deviceScaleFactor: dpr,
      });
      await context.addInitScript(({ mode }) => {
        localStorage.setItem('sky-theme', mode === 'light' ? 'light' : 'dark');
        localStorage.setItem('sky-motion', 'reduced');
        sessionStorage.setItem('sky-intro', 'seen');
        if (mode === 'blue') sessionStorage.setItem('sky-gear', 'blue');
        if (mode === 'gear') sessionStorage.setItem('sky-gear', 'two');
        window.__audit = { uniforms: {}, draws: [], renderer: null };
        const proto = WebGL2RenderingContext.prototype;
        const names = new WeakMap();
        const loc = proto.getUniformLocation;
        proto.getUniformLocation = function (program, name) {
          const result = loc.call(this, program, name);
          if (result) names.set(result, name);
          return result;
        };
        for (const method of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform4fv']) {
          const original = proto[method];
          proto[method] = function (location, ...values) {
            const name = names.get(location);
            if (name && this.canvas.classList.contains('hero-dots')) {
              window.__audit.uniforms[name] = method === 'uniform4fv' ? Array.from(values[0]) : values;
            }
            return original.call(this, location, ...values);
          };
        }
        const draw = proto.drawArrays;
        proto.drawArrays = function (...args) {
          if (this.canvas.classList.contains('hero-dots')) {
            const extension = this.getExtension('WEBGL_debug_renderer_info');
            window.__audit.renderer = extension ? this.getParameter(extension.UNMASKED_RENDERER_WEBGL) : this.getParameter(this.RENDERER);
            window.__audit.draws.push(args);
          }
          return draw.apply(this, args);
        };
      }, { mode });
      const page = await context.newPage();
      await page.goto(site.origin + '/', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.querySelector('#figure')?.classList.contains('is-live'), undefined, { timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      if (W < 700) await page.locator('#figure').scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      const metadata = await page.evaluate(async () => {
        const el = document.querySelector('#figure');
        const rect = el.getBoundingClientRect();
        const meta = await (await fetch('/assets/hero/hero.json')).json();
        const s = Math.min(rect.width, rect.height);
        const b = meta.bounds;
        const w = b[2] - b[0], h = b[3] - b[1];
        const scale = (s - 2 * s * 0.02) / Math.max(w, h);
        return {
          state: { ...document.documentElement.dataset },
          frame: { left: rect.left + (rect.width - s) / 2 + (s - w * scale) / 2 - b[0] * scale,
            top: rect.top + (rect.height - s) / 2 + (s - h * scale) / 2 - b[1] * scale,
            scale, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } },
          ...window.__audit,
          devicePixelRatio: window.devicePixelRatio,
          userAgent: navigator.userAgent,
          pointCountLabel: document.querySelector('[data-hero-count]')?.textContent || null,
        };
      });
      const rect = metadata.frame.rect;
      const clip = { x: Math.max(0, Math.floor(rect.x - 40)), y: Math.max(0, Math.floor(rect.y - 40)),
        width: Math.min(W - Math.max(0, Math.floor(rect.x - 40)), Math.ceil(rect.width + 80)),
        height: Math.min(H - Math.max(0, Math.floor(rect.y - 40)), Math.ceil(rect.height + 80)) };
      await page.screenshot({ path: path.join(folder, 'viewport.png') });
      await page.screenshot({ path: path.join(folder, 'hero.png'), clip });
      const record = { mode, dpr, viewport: { width: W, height: H }, motion: 'reduced', assetHashes,
        note: 'Natural reduced-motion render with uniform observation only; no shader, color, point, or pose replacement. Not real-time motion evidence.',
        source_sha: sourceSha, clip, ...metadata };
      fs.writeFileSync(path.join(folder, 'metadata.json'), JSON.stringify(record, null, 2));
      summary.push({ mode, dpr, rotation: metadata.uniforms.u_rot, state: metadata.state, renderer: metadata.renderer, folder });
      await context.close();
      console.log(`${mode} DPR ${dpr}: captured; rotation ${metadata.uniforms.u_rot}`);
    }
  }
} finally {
  await browser.close();
  site.server.close();
}
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));
