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

async function open(t, { reduced = false, touch = false, setup } = {}) {
  const context = await browser.newContext({
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    colorScheme: 'light', reducedMotion: reduced ? 'reduce' : 'no-preference', hasTouch: touch, isMobile: touch,
  });
  t.after(() => context.close());
  await context.addInitScript(() => {
    const probe = window.__heroProbe = { draws: 0, programs: 0, buffers: 0, arrays: 0, uploads: [], uniforms: {}, firstDraws: [], touches: [], capture: false, pixels: null };
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
        if (hero(this)) probe.uniforms[locations.get(location)] = method === 'uniform4fv' ? Array.from(values[0]) : values;
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
        probe.pixels = { visible, hash, colored, draw: probe.draws };
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
    if (/\/assets\/hero\/(data\.png|bluenoise\.png|hero\.json)$/.test(request.url())) assets.push(request.url());
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
  const { page } = await open(t, { setup: page => page.route('**/assets/hero/data.png', async route => { await held; await route.continue(); }) });
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
  }), 'the project-name ring must return too');
});

test('assets finishing during context loss are retained for restoration', async t => {
  let release;
  const held = new Promise(resolve => { release = resolve; });
  t.after(release);
  const { page, assets } = await open(t, { setup: page => page.route('**/assets/hero/data.png', async route => { await held; await route.continue(); }) });
  await page.waitForSelector('.hero-dots', { state: 'attached' });
  await lose(page);
  const loaded = page.waitForResponse('**/assets/hero/data.png');
  release();
  await loaded;
  await stillDrawing(page);
  await page.evaluate(() => window.__loseHero.restoreContext());
  await live(page);
  assert.ok((await capture(page)).visible > 0);
  assert.equal(assets.length, 3);
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

test('the figure wears the avatar\'s colors, and draws in plain ink when the color map is missing', async t => {
  const { page } = await open(t);
  await live(page);
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_build[0] > 2);
  const painted = await capture(page);
  assert.ok(painted.colored > 300, `${painted.colored} colored pixels: the wings and the caduceus should carry gold`);
  assert.deepEqual((await state(page)).uniforms.u_tint, [1]);
  await page.evaluate(() => window.skyGear.setGear(true));
  await page.waitForFunction(() => window.__heroProbe.uniforms.u_tint[0] === 0, null, { timeout: 3000 });
  const plain = await open(t, { setup: page => page.route('**/assets/hero/color.webp', route => route.abort()) });
  await live(plain.page);
  await plain.page.waitForFunction(() => window.__heroProbe.uniforms.u_build[0] > 2);
  const ink = await capture(plain.page);
  assert.ok(ink.visible > 500);
  assert.equal(ink.colored, 0, 'without the color map every dot is ink');
  assert.deepEqual((await state(plain.page)).uniforms.u_tint, [0]);
});

for (const [name, asset, response] of [
  ['network failure', 'data.png', null],
  ['undecodable image', 'bluenoise.png', { status: 200, contentType: 'image/png', body: 'not an image' }],
  ['failed metadata response with a valid JSON body', 'hero.json', { status: 503, contentType: 'application/json', body: fs.readFileSync(path.join(root, 'assets/hero/hero.json'), 'utf8') }],
  ['invalid metadata geometry', 'hero.json', { status: 200, contentType: 'application/json', body: '{"size":448,"bounds":[0,0,0,0],"center":[0.5,0.5],"density":0.56}' }],
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
