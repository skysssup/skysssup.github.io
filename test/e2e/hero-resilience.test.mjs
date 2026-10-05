import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
let browser, site;

before(async () => {
  site = await serve(root);
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || undefined,
    channel: process.env.CHROME_PATH ? undefined : 'chrome',
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});
after(async () => { await browser?.close(); site?.server.close(); });

// Every test but the opening's own starts from a tab that has already seen the opening (js/page.js).
async function open(t, { reduced = false, touch = false, setup, intro = false, scheme = 'light' } = {}) {
  const context = await browser.newContext({
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch,
  });
  t.after(() => context.close());
  if (!intro) await context.addInitScript(() => { try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {} });
  await context.addInitScript(() => {
    const probe = window.__heroProbe = { draws: 0, programs: 0, buffers: 0, arrays: 0, uploads: [], uniforms: {}, series: { u_sheen: [], u_glitch: [], u_tint: [], u_flow: [], u_swap: [] }, firstDraws: [], touches: [], capture: false, pixels: null };
    let api;
    Object.defineProperty(window, 'SkyHero', {
      configurable: true,
      get: () => api,
      set(value) {
        api = value;
        const mount = value.mount;
        value.mount = function (...args) {
          window.__heroApi = mount.apply(this, args);
          return window.__heroApi;
        };
      },
    });
    const hero = gl => gl.canvas.classList.contains('hero-dots');
    const proto = WebGL2RenderingContext.prototype;
    for (const [method, key] of [['createProgram', 'programs'], ['createBuffer', 'buffers'], ['createVertexArray', 'arrays']]) {
      const original = proto[method];
      proto[method] = function (...args) {
        const result = original.apply(this, args);
        if (hero(this) && result) probe[key]++;
        return result;
      };
    }
    const locations = new WeakMap();
    const location = proto.getUniformLocation;
    proto.getUniformLocation = function (program, name) {
      const result = location.call(this, program, name);
      if (result) locations.set(result, name);
      return result;
    };
    for (const method of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform4fv']) {
      const original = proto[method];
      proto[method] = function (location, ...values) {
        const result = original.call(this, location, ...values);
        const name = locations.get(location);
        if (hero(this)) probe.uniforms[name] = method === 'uniform4fv' ? Array.from(values[0]) : values;
        if (hero(this) && probe.series[name]) probe.series[name].push([performance.now(), name === 'u_flow' ? values[3] : name === 'u_swap' ? values.slice() : values[0]]);
        return result;
      };
    }
    const upload = proto.bufferData;
    proto.bufferData = function (target, data, usage) {
      const result = upload.call(this, target, data, usage);
      if (hero(this) && ArrayBuffer.isView(data)) {
        const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
        let hash = 0;
        for (const byte of bytes) hash = (Math.imul(hash, 31) + byte) >>> 0;
        probe.uploads.push({ bytes: bytes.length, hash });
      }
      return result;
    };
    const draw = proto.drawArrays;
    proto.drawArrays = function (...args) {
      const result = draw.apply(this, args);
      if (!hero(this)) return result;
      probe.draws++;
      if (probe.firstDraws.length < probe.programs) probe.firstDraws.push({ live: this.canvas.parentElement.classList.contains('is-live'), count: args[2] });
      if (probe.capture) {
        const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
        this.readPixels(0, 0, this.drawingBufferWidth, this.drawingBufferHeight, this.RGBA, this.UNSIGNED_BYTE, pixels);
        let visible = 0, hash = 0, colored = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i]) visible++;
          if (pixels[i] > 64 && Math.max(pixels[i - 3], pixels[i - 2], pixels[i - 1]) - Math.min(pixels[i - 3], pixels[i - 2], pixels[i - 1]) > 40) colored++;
          hash = (Math.imul(hash, 31) + pixels[i]) >>> 0;
        }
        probe.pixels = { visible, hash, colored, draw: probe.draws, sheen: (probe.uniforms.u_sheen || [0, 0, 0, 0]).slice() };
        probe.capture = false;
      }
      return result;
    };
    for (const name of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      document.addEventListener(name, event => {
        if (event.pointerType === 'touch' && event.target.closest('#figure')) probe.touches.push({ type: name, id: event.pointerId });
      }, true);
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [], assets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/assets\/hero\/(ink\.webp|depth\.webp|bluenoise\.png|hero\.json)$/.test(request.url())) assets.push(request.url());
  });
  t.after(() => assert.deepEqual(errors, [], 'the hero must not abort page initialization or event handlers'));
  if (setup) await setup(page);
  await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  return { page, context, assets };
}

async function live(page) {
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-live') && !document.querySelector('#figure').classList.contains('is-fallback'));
}

async function fallback(page) {
  await page.waitForFunction(() => document.querySelector('#figure').classList.contains('is-fallback') && !document.querySelector('#figure').classList.contains('is-live'));
  assert.notEqual(await page.locator('#figure .still').evaluate(el => getComputedStyle(el).display), 'none');
}

async function state(page) {
  return page.evaluate(() => ({ ...window.__heroProbe, count: window.__heroApi.count() }));
}

async function capture(page, redraw) {
  const before = (await state(page)).draws;
  await page.evaluate(() => { window.__heroProbe.capture = true; });
  if (redraw) await page.evaluate(redraw);
  await page.waitForFunction(n => window.__heroProbe.pixels?.draw > n, before);
  return (await state(page)).pixels;
}

// A frame with no sheen or star burst in it, for checks on the figure's own colours.
async function captureWithoutSheen(page) {
  for (let i = 0; i < 60; i++) {
    const pixels = await capture(page);
    if (pixels.sheen[1] === 0) return pixels;
    await page.waitForTimeout(100);
  }
  throw new Error('every captured frame carried a sheen');
}

async function lose(page) {
  await page.evaluate(() => {
    const gl = document.querySelector('.hero-dots').getContext('webgl2');
    window.__loseHero = gl.getExtension('WEBGL_lose_context');
    if (!window.__loseHero) throw new Error('WEBGL_lose_context is required to test real recovery');
    window.__loseHero.loseContext();
  });
  await fallback(page);
}

async function stillDrawing(page) {
  await page.waitForTimeout(180);
  const before = (await state(page)).draws;
  await page.waitForTimeout(300);
  assert.equal((await state(page)).draws, before, 'no hero draw is allowed while paused');
}

async function touchAt(context, page) {
  const cdp = await context.newCDPSession(page);
  const box = await page.locator('#figure').boundingBox();
  const x = Math.round(box.x + box.width / 2), y = Math.round(box.y + box.height / 2);
  return {
    x, y,
    send: (type, px = x, py = y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: px, y: py, id: 1 }] }),
  };
}

test('loading waits for data and the first drawn figure before announcing a live hero', async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  t.after(release);
  const { page } = await open(t, { setup: page => page.route('**/assets/hero/ink.webp', async route => { await held; await route.continue(); }) });
  await page.waitForFunction(() => !!window.__heroApi);
  assert.equal((await state(page)).draws, 0);
  assert.equal(await page.locator('#figure').evaluate(el => el.classList.contains('is-live')), false);
  await page.evaluate(() => window.__heroApi.ripple());
  release();
  await live(page);
  const result = await state(page);
  assert.ok(result.firstDraws[0].count > 5000);
  assert.equal(result.firstDraws[0].live, false, 'is-live must not be set before a successful draw');
  assert.ok((await capture(page)).visible > 0, 'the recovered canvas contains rendered dots');
  assert.deepEqual(result.uniforms.u_rip.filter((_, i) => i % 4 === 3), [0, 0, 0, 0]);
});

test('real context loss pauses rendering and repeated restoration rebuilds cached geometry', async t => {
  const { page, assets } = await open(t);
  await live(page);
  const original = await state(page);
  const requests = assets.slice().sort();
  for (let cycle = 1; cycle <= 2; cycle++) {
    await lose(page);
    await stillDrawing(page);
    await page.evaluate(() => window.__heroApi.ripple());
    await page.evaluate(() => window.__loseHero.restoreContext());
    await live(page);
    const restored = await state(page);
    assert.equal(restored.programs, original.programs + cycle);
    assert.equal(restored.buffers, original.buffers + cycle);
    assert.equal(restored.arrays, original.arrays + cycle);
    assert.equal(restored.count, original.count);
    assert.deepEqual(restored.uploads.at(-1), original.uploads.at(-1));
    assert.equal(restored.firstDraws.at(-1).live, false);
    assert.ok((await capture(page)).visible > 500, 'restoration must draw actual pixels, not just restore CSS classes');
    assert.deepEqual(assets.slice().sort(), requests, 'restoration must not fetch assets again');
    assert.equal(await page.evaluate(() => document.querySelector('.hero-dots').getContext('webgl2').getError()), 0);
  }
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_build[0] > 2);
  assert.ok(await page.locator('.hero-words').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((n, i) => i % 4 === 3 && n > 0);
  }), 'the ring must return too');
});

test('assets finishing during context loss are retained for restoration', async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  t.after(release);
  const { page, assets } = await open(t, { setup: page => page.route('**/assets/hero/ink.webp', async route => { await held; await route.continue(); }) });
  await page.waitForSelector('.hero-dots', { state: 'attached' });
  await lose(page);
  const loaded = page.waitForResponse('**/assets/hero/ink.webp');
  release();
  await loaded;
  await stillDrawing(page);
  await page.evaluate(() => window.__loseHero.restoreContext());
  await live(page);
  assert.ok((await capture(page)).visible > 0);
  assert.equal(assets.length, 4);
});

test('reduced motion cancels active mouse push and ripples, and never advances the still', async t => {
  const { page } = await open(t);
  await live(page);
  const box = await page.locator('#figure').boundingBox();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_pointer[2] > 0.1 && window.__heroProbe.uniforms.u_rip.some((n, i) => i % 4 === 3 && n > 0));
  await page.evaluate(() => document.fonts.ready);
  const movingDraws = await page.evaluate(() => {
    const draws = window.__heroProbe.draws;
    window.SkyMotion.set('reduced');
    return draws;
  });
  assert.equal((await state(page)).draws, movingDraws + 1, 'reducing motion must draw exactly one finished still');
  await stillDrawing(page);
  assert.equal((await state(page)).draws, movingDraws + 1, 'no queued animation draw may follow the still');
  const before = await capture(page, () => window.__heroApi.highlight(null));
  const uniforms = (await state(page)).uniforms;
  assert.deepEqual(uniforms.u_rot, [0.12, 0.02]);
  for (const key of ['u_time', 'u_blink', 'u_beat', 'u_glitch']) assert.deepEqual(uniforms[key], [0], key);
  assert.deepEqual(uniforms.u_sheen, [0, 0, 0, 0], 'no sheen and no sparkle burst under reduced motion');
  assert.deepEqual(uniforms.u_last, [0, 0, 0, 0], 'no gust growing back');
  assert.deepEqual(uniforms.u_breeze, [0, 0, 0, 0], 'and no breeze');
  assert.ok(uniforms.u_puff.filter((_, i) => i % 4 === 3).every(n => n === 0), 'and no puffs from the cursor');
  assert.deepEqual(uniforms.u_stir.slice(0, 2), [0, 0], 'and no stir');
  assert.equal(uniforms.u_pointer[2], 0);
  assert.deepEqual(uniforms.u_rip.filter((_, i) => i % 4 === 3), [0, 0, 0, 0]);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.evaluate(() => window.__heroApi.ripple());
  await stillDrawing(page);
  const after = await capture(page, () => window.__heroApi.highlight(null));
  assert.equal(after.hash, before.hash, 'redrawing the reduced-motion frame must produce the same pixels');
  assert.deepEqual((await state(page)).uniforms, uniforms);
  await page.evaluate(() => window.SkyMotion.set('full'));
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_blink[0] === 1);
  assert.equal((await state(page)).uniforms.u_pointer[2], 0, 'old hover state must not return when motion resumes');
});

test('a reduced-motion initial load and context restoration stay still', async t => {
  const { page } = await open(t, { reduced: true });
  await page.evaluate(() => document.fonts.ready);
  await live(page);
  const initialDraws = (await state(page)).draws;
  await stillDrawing(page);
  assert.equal((await state(page)).draws, initialDraws, 'revealing the still must not queue an animation draw');
  const before = await capture(page, () => window.__heroApi.highlight(null));
  assert.ok(before.visible > 500);
  assert.deepEqual((await state(page)).uniforms.u_sheen, [0, 0, 0, 0]);
  await lose(page);
  await stillDrawing(page);
  await page.evaluate(() => window.__loseHero.restoreContext());
  await live(page);
  const restoredDraws = (await state(page)).draws;
  await stillDrawing(page);
  assert.equal((await state(page)).draws, restoredDraws, 'restoration must stop drawing after the query reveals the still');
  const after = await capture(page, () => window.__heroApi.highlight(null));
  assert.equal(after.hash, before.hash);
});

test('off-screen heroes remain paused through preference changes and context restoration', async t => {
  const { page } = await open(t);
  await live(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForFunction(() => document.querySelector('#figure').getBoundingClientRect().bottom < 0);
  await stillDrawing(page);
  const paused = (await state(page)).draws;
  await page.evaluate(() => { window.SkyMotion.set('reduced'); document.documentElement.setAttribute('data-theme', 'dark'); });
  assert.equal((await state(page)).draws, paused, 'preference changes must not draw off-screen');
  await stillDrawing(page);
  await lose(page);
  await page.evaluate(() => window.__loseHero.restoreContext());
  await page.waitForFunction(() => window.__heroProbe.programs === 2);
  assert.equal((await state(page)).draws, paused, 'context restoration must not draw off-screen');
  await stillDrawing(page);
  assert.equal(await page.locator('#figure').evaluate(el => el.classList.contains('is-live')), false);
  await page.evaluate(() => scrollTo(0, 0));
  await live(page);
  await stillDrawing(page);
  assert.deepEqual((await state(page)).uniforms.u_blink, [0]);
});

test('visibilitychange pauses all drawing, including reduced-motion and theme updates', async t => {
  const { page } = await open(t);
  await live(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused = (await state(page)).draws;
  await page.evaluate(() => { window.SkyMotion.set('reduced'); document.documentElement.setAttribute('data-theme', 'dark'); window.__heroApi.ripple(); });
  assert.equal((await state(page)).draws, paused);
  await stillDrawing(page);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.ok((await state(page)).draws > paused);
  await stillDrawing(page);
  assert.deepEqual((await state(page)).uniforms.u_blink, [0]);
});

test('horizontal touch drags rotate through the springs and cancellation releases capture without push', async t => {
  const { page, context } = await open(t, { touch: true });
  await live(page);
  assert.equal(await page.locator('#figure').evaluate(el => getComputedStyle(el).touchAction), 'pan-y');
  const touch = await touchAt(context, page);
  const scroll = await page.evaluate(() => scrollY);
  await touch.send('touchStart');
  await touch.send('touchMove', touch.x + 140, touch.y + 10);
  await page.waitForTimeout(650);
  const right = (await state(page)).uniforms.u_rot[0];
  for (const dx of [70, 14, 0, -14, -70, -140]) await touch.send('touchMove', touch.x + dx, touch.y + 10);
  await page.waitForTimeout(850);
  const left = await state(page);
  assert.ok(right - left.uniforms.u_rot[0] > 0.06, `a horizontal drag must change yaw (${right} -> ${left.uniforms.u_rot[0]})`);
  assert.equal(left.uniforms.u_pointer[2], 0);
  const id = left.touches.find(e => e.type === 'pointerdown').id;
  assert.equal(await page.locator('#figure').evaluate((el, id) => el.hasPointerCapture(id), id), true);
  assert.equal(await page.evaluate(() => scrollY), scroll);
  await touch.send('touchCancel');
  await page.waitForFunction(() => window.__heroProbe.touches.some(e => e.type === 'pointercancel'));
  assert.equal(await page.locator('#figure').evaluate((el, id) => el.hasPointerCapture(id), id), false);
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_rip.every((n, i) => i % 4 !== 3 || n === 0));
  assert.equal((await state(page)).uniforms.u_pointer[2], 0);
});

test('native vertical touch scrolling cancels hero interaction and allows the next tap', async t => {
  const { page, context } = await open(t, { touch: true });
  await live(page);
  const touch = await touchAt(context, page);
  await touch.send('touchStart');
  for (let step = 1; step <= 5; step++) await touch.send('touchMove', touch.x + 2, touch.y - step * 26);
  await touch.send('touchEnd');
  await page.waitForFunction(() => scrollY > 20 && window.__heroProbe.touches.some(e => e.type === 'pointercancel'));
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_rip.every((n, i) => i % 4 !== 3 || n === 0));
  assert.equal((await state(page)).uniforms.u_pointer[2], 0);
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(250);
  const tap = await touchAt(context, page);
  await tap.send('touchStart');
  await tap.send('touchEnd');
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_rip.some((n, i) => i % 4 === 3 && n > 0));
  assert.equal((await state(page)).uniforms.u_pointer[2], 0);
});

test('enabling reduced motion during a captured touch cancels the drag and its ripple', async t => {
  const { page, context } = await open(t, { touch: true });
  await live(page);
  const touch = await touchAt(context, page);
  await touch.send('touchStart');
  await touch.send('touchMove', touch.x + 80, touch.y);
  const id = (await state(page)).touches.find(e => e.type === 'pointerdown').id;
  assert.equal(await page.locator('#figure').evaluate((el, id) => el.hasPointerCapture(id), id), true);
  await page.evaluate(() => window.SkyMotion.set('reduced'));
  assert.equal(await page.locator('#figure').evaluate((el, id) => el.hasPointerCapture(id), id), false);
  const before = await capture(page, () => window.__heroApi.highlight(null));
  await touch.send('touchMove', touch.x - 80, touch.y);
  await touch.send('touchEnd');
  await stillDrawing(page);
  const after = await capture(page, () => window.__heroApi.highlight(null));
  assert.equal(after.hash, before.hash);
  assert.deepEqual((await state(page)).uniforms.u_rip.filter((_, i) => i % 4 === 3), [0, 0, 0, 0]);
});

test('a band of light crosses the figure soon after it assembles, and stars burst with it', async t => {
  const { page } = await open(t);
  await live(page);
  await page.waitForFunction(() => window.__heroProbe.series.u_sheen.some(([, x]) => x >= 0.999), null, { timeout: 12000 });
  const { series, uniforms } = await state(page);
  const sweep = series.u_sheen.filter(([, x]) => x > 0);
  assert.ok(sweep.find(([, x]) => x >= 0.999)[0] < 8000, `the sweep must finish within 8 s of load, finished at ${sweep.find(([, x]) => x >= 0.999)[0]} ms`);
  assert.ok(sweep.some(([, x]) => x > 0.02 && x < 0.98), 'the band travels across the figure rather than jumping');
  for (let i = 1; i < sweep.length && sweep[i][1] < 0.999; i++) assert.ok(sweep[i][1] >= sweep[i - 1][1], 'the band never runs backwards within a sweep');
  assert.ok(uniforms.u_span[3] > 0 && uniforms.u_span[3] < 0.05, `each burst picks a few dozen stars, chance ${uniforms.u_span[3]}`);
  assert.equal(uniforms.u_flow[0], 0.32, 'on light paper its gust blows off up to a third of the dots near the downwind edge');
  assert.ok(uniforms.u_breeze[0] > 0 && uniforms.u_breeze[1] > 0, 'and between gusts a breeze keeps taking dots off the outline');
});

test('Gear Two keeps tearing the figure after the switch; light mode, reduced motion, and touch drags never tear', async t => {
  const { page } = await open(t);
  await live(page);
  await page.waitForTimeout(2500);
  assert.ok((await state(page)).series.u_glitch.every(([, x]) => x === 0), 'light mode never tears');
  const clicked = await page.evaluate(() => { document.querySelector('[data-gear-toggle]').click(); return performance.now(); });
  // the switch glitches at full strength (1) until its window closes, which a busy main thread can push late;
  // tears run lighter (0.6 or 0.8), so the series itself says where the window ended
  await page.waitForFunction(at => window.__heroProbe.series.u_glitch.some(([time, x]) => time > at && x > 0 && x < 1), clicked, { timeout: 12000 });
  const series = (await state(page)).series.u_glitch;
  const switched = series.filter(([time, x]) => time >= clicked && x === 1);
  assert.ok(switched.length > 0, 'switching on still glitches at full strength');
  const closed = switched.at(-1)[0];
  const [time, level] = series.find(([time, x]) => time > closed && x > 0);
  assert.ok(time - closed < 6000, `a tear within 6 s of the switch window closing, came after ${Math.round(time - closed)} ms`);
  assert.ok(level === 0.6 || level === 0.8, `tears run lighter than the switch (${level})`);

  const still = await open(t, { reduced: true });
  await live(still.page);
  await still.page.evaluate(() => window.skyGear.setGear(true));
  await still.page.waitForTimeout(2500);
  assert.ok((await state(still.page)).series.u_glitch.every(([, x]) => x === 0), 'reduced motion never tears');

  const touched = await open(t, { touch: true });
  await live(touched.page);
  await touched.page.evaluate(() => window.skyGear.setGear(true));
  const touch = await touchAt(touched.context, touched.page);
  await touch.send('touchStart');
  await touch.send('touchMove', touch.x + 60, touch.y + 4);
  await touch.send('touchMove', touch.x + 120, touch.y + 6);
  const dragging = await touched.page.evaluate(() => performance.now());
  await touched.page.waitForTimeout(6000);
  const during = (await state(touched.page)).series.u_glitch.filter(([time]) => time > dragging);
  assert.ok(during.length > 3 && during.every(([, x]) => x === 0), 'no tears while a touch drag turns the figure');
  await touch.send('touchEnd');
});

test('the material map names five materials inside the figure', async t => {
  const { page } = await open(t);
  await live(page);
  const counts = await page.evaluate(async () => {
    const decode = async url => {
      const bitmap = await createImageBitmap(await (await fetch(url)).blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const ctx = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const color = await decode('/assets/hero/color.webp'), depth = await decode('/assets/hero/depth.webp');
    const found = {};
    for (let i = 0; i < color.length; i += 4) if (depth[i] > 0) { const m = Math.round(color[i] / 51); found[m] = (found[m] || 0) + 1; }
    return found;
  });
  assert.deepEqual(Object.keys(counts).map(Number).sort(), [0, 1, 2, 3, 4], 'gold, marble, cloud, lightning, glint');
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  for (const [m, n] of Object.entries(counts)) assert.ok(n / total > 0.001, `material ${m} covers ${n} of ${total} figure pixels`);
});

test('a quick sweep of the cursor across the figure blows dust off it, and a slow one only stirs it', async t => {
  const { page } = await open(t);
  await live(page);
  const box = await page.locator('#figure').boundingBox();
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
  for (let i = 1; i <= 8; i++) { await page.mouse.move(box.x + box.width * (0.55 + i * 0.005), box.y + box.height * 0.55); await page.waitForTimeout(120); }
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_pointer[2] > 0.5);
  assert.ok((await state(page)).uniforms.u_puff.filter((_, i) => i % 4 === 3).every(n => n === 0), 'a slow drift leaves no puff');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.45, { steps: 4 });
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.6, { steps: 4 });
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_puff.some((n, i) => i % 4 === 3 && n > 0));
});

test('the public ripple API emits at the center without adding control semantics to the image', async t => {
  const { page } = await open(t);
  await live(page);
  await page.evaluate(() => window.__heroApi.ripple());
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_rip.some((n, i) => i % 4 === 3 && n > 0));
  const uniforms = (await state(page)).uniforms;
  assert.ok(Math.abs(uniforms.u_rip[0] - uniforms.u_res[0] / 2) < 1);
  assert.ok(Math.abs(uniforms.u_rip[1] - uniforms.u_res[1] / 2) < 1);
  assert.equal(uniforms.u_pointer[2], 0);
  assert.equal(await page.locator('#figure').getAttribute('role'), 'img');
  assert.equal(await page.locator('#figure').getAttribute('tabindex'), null);
});

test('the figure wears its materials\' colors, keeps 40% of them in Gear Two, and draws in plain ink without the map', async t => {
  const { page } = await open(t);
  await live(page);
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_build[0] > 2);
  const painted = await capture(page);
  assert.ok(painted.colored > 300, `${painted.colored} colored pixels: the wings and the caduceus should carry gold`);
  assert.deepEqual((await state(page)).uniforms.u_tint, [1]);
  await page.evaluate(() => window.skyGear.setGear(true));
  await page.waitForFunction(() => Math.abs(window.__heroProbe.uniforms.u_tint[0] - 0.4) < 1e-6, null, { timeout: 3000 });
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_positive[0] === 1, null, { timeout: 10000 });
  assert.ok((await state(page)).uniforms.u_flow[0] < 0.2, 'Gear Two\'s gust is quieter than the blue one');
  const plain = await open(t, { setup: page => page.route('**/assets/hero/color.webp', route => route.abort()) });
  await live(plain.page);
  await plain.page.waitForFunction(() => window.__heroProbe.uniforms.u_build[0] > 2);
  const ink = await captureWithoutSheen(plain.page);
  assert.ok(ink.visible > 500);
  assert.equal(ink.colored, 0, 'without the color map every dot is ink');
  assert.deepEqual((await state(plain.page)).uniforms.u_tint, [0]);
});

test('on dark paper the dots stand for light, from the light map, and the lights swap the maps behind a band', async t => {
  const maps = [];
  const watch = page => page.on('request', request => {
    const map = request.url().match(/\/assets\/hero\/(ink|light)\.webp$/);
    if (map) maps.push(map[1]);
  });
  const { page } = await open(t, { scheme: 'dark', setup: watch });
  await live(page);
  const dark = await state(page);
  assert.deepEqual(maps, ['light'], 'dark paper loads the light map alone');
  assert.deepEqual(dark.uniforms.u_positive, [1]);
  assert.deepEqual(dark.uniforms.u_swap, [0, 0, 1, 0]);
  await page.evaluate(() => window.skyTheme.set('light'));
  await page.waitForFunction(() => window.__heroProbe.series.u_swap.some(([, v]) => v[1] !== 0), null, { timeout: 15000 });
  await page.waitForFunction(() => window.__heroProbe.series.u_swap.at(-1)[1][1] === 0, null, { timeout: 15000 });
  const light = await state(page);
  assert.deepEqual(maps, ['light', 'ink'], 'the ink map is fetched when the lights come on');
  assert.deepEqual(light.uniforms.u_positive, [0]);
  assert.notEqual(light.count, dark.count, 'the figure is stippled again from the ink map');
  assert.ok(light.uploads.at(-1).hash !== dark.uploads.at(-1).hash);
  const swap = light.series.u_swap.filter(([, v]) => v[1] !== 0).map(([, v]) => v);
  assert.ok(swap.some(([x, , role]) => role === 1 && x > 0.02 && x < 0.98), 'a band crosses the figure to bring in the new dots');
  assert.ok(swap.some(([, , role]) => role === -1), 'while the old ones are drawn ahead of it');
  const incoming = swap.filter(([, , role]) => role === 1).map(([x]) => x);
  for (let i = 1; i < incoming.length; i++) assert.ok(incoming[i] >= incoming[i - 1], 'the band never runs backwards');

  // under reduced motion the maps swap at once, in one still
  await page.evaluate(() => window.SkyMotion.set('reduced'));
  const before = (await state(page)).series.u_swap.length;
  await page.evaluate(() => window.skyTheme.set('dark'));
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_positive[0] === 1);
  await stillDrawing(page);
  assert.ok((await state(page)).series.u_swap.slice(before).every(([, v]) => v[1] === 0), 'no band under reduced motion');
  assert.deepEqual(maps, ['light', 'ink'], 'a map is fetched once');

  // a map that never arrives leaves the figure on the one it has, at full strength
  const blocked = await open(t, { setup: page => page.route('**/assets/hero/light.webp', route => route.abort('failed')) });
  await live(blocked.page);
  const failed = blocked.page.waitForEvent('requestfailed', request => request.url().endsWith('/assets/hero/light.webp'));
  await blocked.page.evaluate(() => window.skyTheme.set('dark'));
  await failed;
  await blocked.page.waitForFunction(() => window.__heroProbe.uniforms.u_alpha[0] === 1 && window.__heroProbe.uniforms.u_positive[0] === 0);
});

for (const [name, asset, response] of [
  ['network failure', 'ink.webp', null],
  ['missing depth map', 'depth.webp', null],
  ['undecodable image', 'bluenoise.png', { status: 200, contentType: 'image/png', body: 'not an image' }],
  ['failed metadata response with a valid JSON body', 'hero.json', { status: 503, contentType: 'application/json', body: fs.readFileSync(path.join(root, 'assets/hero/hero.json'), 'utf8') }],
  ['invalid metadata geometry', 'hero.json', { status: 200, contentType: 'application/json', body: '{"size":896,"depth":448,"bounds":[0,0,0,0],"center":[0.5,0.5],"density":0.6}' }],
]) {
  test(`the static fallback survives ${name}`, async t => {
    const { page } = await open(t, { setup: page => page.route(`**/assets/hero/${asset}`, route => response ? route.fulfill(response) : route.abort('failed')) });
    await fallback(page);
    await page.evaluate(() => window.__heroApi.ripple());
    await stillDrawing(page);
    assert.equal((await state(page)).draws, 0);
  });
}

for (const failure of ['unavailable context', 'throwing context', 'shader compilation']) {
  test(`the static fallback survives ${failure}`, async t => {
    const { page } = await open(t, { setup: page => page.addInitScript(failure => {
      if (failure === 'shader compilation') {
        const source = WebGL2RenderingContext.prototype.shaderSource;
        WebGL2RenderingContext.prototype.shaderSource = function (shader, text) {
          return source.call(this, shader, this.canvas.classList.contains('hero-dots') ? text + '\ninvalid shader syntax' : text);
        };
      } else {
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (type === 'webgl2' && this.classList.contains('hero-dots')) {
            if (failure === 'throwing context') throw new Error('WebGL initialization failed');
            return null;
          }
          return getContext.call(this, type, ...args);
        };
      }
    }, failure) });
    await fallback(page);
    await page.evaluate(() => window.__heroApi.ripple());
    await stillDrawing(page);
    assert.equal((await state(page)).draws, 0);
  });
}

// The opening (js/hero.js INTRO, js/page.js): still in ink, a shine that brings the colors, a turn, Gear Two and back.
async function stages(page) {
  await page.evaluate(() => {
    const figure = document.getElementById('figure'), root = document.documentElement;
    window.__stages = [[performance.now(), figure.getAttribute('data-intro'), root.getAttribute('data-gear')]];
    new MutationObserver(() => window.__stages.push([performance.now(), figure.getAttribute('data-intro'), root.getAttribute('data-gear')]))
      .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-intro', 'data-gear'] });
    // the hold is counted from the moment the drawn figure is on screen
    new MutationObserver(() => { if (window.__liveAt == null && figure.classList.contains('is-live')) window.__liveAt = performance.now(); })
      .observe(figure, { attributes: true, attributeFilter: ['class'] });
  });
}

test('the opening holds the figure still in its ink, shines its colors in, and takes the page to Gear Two and back without saving it', async t => {
  const { page } = await open(t, { intro: true });
  await stages(page);
  await live(page);
  assert.equal(await page.locator('#figure').getAttribute('data-intro'), 'hold');
  const held = (await state(page)).uniforms;
  assert.deepEqual(held.u_tint, [0], 'the figure starts in its ink alone');
  assert.deepEqual(held.u_rot, [0, 0], 'facing the viewer, as the still that covered the page did');
  assert.deepEqual(held.u_blink, [0], 'and nothing blinks');
  assert.equal(held.u_breeze[0], 0, 'and no breeze takes its dots');
  await page.waitForFunction(() => document.getElementById('figure').getAttribute('data-intro') === 'turn', null, { timeout: 15000 });
  const { stages: changes, liveAt } = await page.evaluate(() => ({ stages: window.__stages, liveAt: window.__liveAt }));
  const hold = changes.find(([, stage]) => stage === 'shine')[0] - liveAt;
  assert.ok(hold >= 1900 && hold < 4000, `the drawn figure holds still for 2 s before its shine, held ${Math.round(hold)} ms`);
  const { series } = await state(page);
  assert.ok(series.u_flow.some(([, wake]) => wake === 1), 'the opening shine brings the colors in behind its band');
  assert.ok(series.u_sheen.some(([, x]) => x > 0.02 && x < 0.98), 'and crosses the figure');
  assert.deepEqual((await state(page)).uniforms.u_tint, [1], 'after the shine the figure wears its colors');
  await page.waitForFunction(() => document.documentElement.getAttribute('data-gear') === 'two', null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => sessionStorage.getItem('sky-gear')), null, 'Gear Two is not saved for the next page');
  await page.waitForFunction(() => document.getElementById('figure').getAttribute('data-intro') === 'done', null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => document.documentElement.getAttribute('data-gear')), null, 'the page comes back');
  const seen = (await page.evaluate(() => window.__stages)).map(([, stage, gear]) => `${stage}${gear ? '+gear' : ''}`).filter((x, i, a) => x !== a[i - 1]);
  assert.deepEqual(seen, ['hold', 'shine', 'turn', 'red', 'red+gear', 'redshine+gear', 'redturn+gear', 'back+gear', 'back', 'done']);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('sky-intro')), 'seen');
});

test('a press or a key ends the opening at once; a press on Gear Two then acts on the page as it is', async t => {
  const { page } = await open(t, { intro: true });
  await live(page);
  await page.keyboard.press('Shift');
  assert.equal(await page.locator('#figure').getAttribute('data-intro'), 'done');
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_tint[0] === 1, null, { timeout: 5000 });

  const red = await open(t, { intro: true });
  await live(red.page);
  await red.page.waitForFunction(() => document.documentElement.getAttribute('data-gear') === 'two', null, { timeout: 30000 });
  await red.page.locator('[data-gear-toggle]').click();
  assert.equal(await red.page.locator('#figure').getAttribute('data-intro'), 'done');
  await red.page.waitForFunction(() => !document.documentElement.hasAttribute('data-gear'));
  await red.page.waitForTimeout(1500);
  assert.equal(await red.page.evaluate(() => document.documentElement.getAttribute('data-gear')), null, 'the visitor switched Gear Two off, and it stays off');
  assert.equal(await red.page.evaluate(() => sessionStorage.getItem('sky-gear')), null);
});

test('the opening plays once a tab and again on a reload, never on the way back from another page or under reduced motion', async t => {
  const { page } = await open(t, { intro: true });
  await live(page);
  assert.equal(await page.locator('#figure').getAttribute('data-intro'), 'hold');
  await page.goto(site.origin + '/work/', { waitUntil: 'domcontentloaded' });
  await page.goto(site.origin + '/', { waitUntil: 'domcontentloaded' });
  await live(page);
  assert.equal(await page.locator('#figure').getAttribute('data-intro'), null, 'coming back to the page does not replay it');
  assert.ok((await state(page)).uniforms.u_build[0] < 99, 'the figure assembles as before');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await live(page);
  assert.notEqual(await page.locator('#figure').getAttribute('data-intro'), null, 'a reload plays it again');

  const still = await open(t, { intro: true, reduced: true });
  await live(still.page);
  assert.equal(await still.page.locator('#figure').getAttribute('data-intro'), null);
  assert.deepEqual((await state(still.page)).uniforms.u_tint, [1]);
});
