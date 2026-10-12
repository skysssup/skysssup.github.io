import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pages = ['/#work-list', '/work/', '/work/agentcrucible/', '/work/airforge/', '/work/shipgate/', '/work/recall-ai/', '/work/spanforge/', '/work/localpulse/', '/work/ghost-notetaker/', '/work/moltdao/'];
const scenes = [
  { id: 'project-agentcrucible', idle: 'Tool call → committed state → checked claim', mid: 'Retry follows the lower route', done: 'Claim checked against committed state', marker: '.fault-marker', kind: 'opacity' },
  { id: 'project-airforge', idle: 'Draw a ramp, then drop the ball', mid: 'Ramp guides the fall', done: 'Ball settles on the platform', marker: '.physics-ball', kind: 'ball' },
  { id: 'project-shipgate', idle: 'Staged changes pass through the policy gate', mid: 'Evaluate local policy', done: 'Policy blocks this illustrative change', marker: '.blocked-route', kind: 'opacity' },
  { id: 'project-recall-ai', idle: 'Review shifts the next practice interval', mid: 'Retention curve updated', done: 'Next review moves along the timeline', marker: '.recall-marker', kind: 'shift', x: 99 },
  { id: 'project-spanforge', idle: 'Nested spans share a request timeline', mid: 'Tool and fetch spans overlap', done: 'Finalize closes the request', marker: '.trace-span rect', kind: 'stroke' },
  { id: 'project-localpulse', idle: 'Call series → local store → metric views', mid: 'Series written locally', done: 'Token and latency views receive the series', marker: '.pulse-bar', kind: 'fill' },
  { id: 'project-ghost-notetaker', idle: 'Capture becomes a local Markdown note', mid: 'Markdown note created', done: 'Note joins the workspace', marker: '.capture-dot', kind: 'opacity' },
  { id: 'project-moltdao', idle: 'Proposal → votes → treasury action', mid: 'Agent votes converge', done: 'Local experiment reaches a treasury decision', marker: '.voter', kind: 'fill' },
];

let browser, site;
before(async () => {
  site = await serve(root);
  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function withPage(options, run) {
  const stamp = fs.mkdtempSync(path.join(os.tmpdir(), 'sky-finish-'));
  const context = await browser.newContext({
    viewport: { width: options.width || 1440, height: options.height || 900 },
    reducedMotion: options.reduced === false ? 'no-preference' : 'reduce',
    hasTouch: !!options.touch,
    isMobile: !!options.touch,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    acceptDownloads: false,
  });
  try {
    await context.addInitScript(dir => sessionStorage.setItem('sky-finish-context', dir), stamp);
    await context.addInitScript(() => sessionStorage.setItem('sky-intro', 'seen'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(site.origin + (options.url || '/work/'), { waitUntil: 'domcontentloaded' });
    await run(page, errors);
  } finally {
    await context.close();
  }
}

const settle = page => page.waitForFunction(() => window.SkyWorkbench && SkyWorkbench.settled());
const readyBench = page => page.waitForFunction(() => document.querySelector('.workbench.is-ready') && window.SkyWorkbench);

function paint(selector) {
  const el = document.querySelector('.work-card.is-on').querySelector(selector);
  const probe = document.createElement('canvas').getContext('2d');
  const hex = value => { probe.fillStyle = '#000'; probe.fillStyle = value; return probe.fillStyle; };
  const hot = hex(getComputedStyle(document.querySelector('.workbench')).getPropertyValue('--bench-hot').trim() || '#000');
  const style = getComputedStyle(el);
  const matrix = new DOMMatrix(style.transform);
  return { opacity: style.opacity, fill: hex(style.fill), stroke: hex(style.stroke), x: matrix.e, y: matrix.f, hot };
}

test('site index clear restores results, keeps the dialog expanded, and Escape returns focus', async () => {
  await withPage({ url: '/work/' }, async (page, errors) => {
    const opener = page.locator('[data-index-open]');
    const dialog = page.locator('#site-index');
    const search = page.locator('[data-index-search]');
    const clear = page.locator('[data-index-clear]');
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await clear.isVisible(), false);

    await opener.click();
    assert.equal(await dialog.evaluate(el => el.open), true);
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#site-index').open);
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await opener.evaluate(el => el === document.activeElement), true);

    const contact = page.locator('nav.nav a[href="/#contact"]');
    await contact.focus();
    await page.keyboard.press('/');
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    assert.equal(await dialog.evaluate(el => el.open), true);
    const all = await page.locator('[data-index-item]:visible').count();
    await search.fill('python');
    await page.waitForFunction(() => document.querySelector('[data-index-status]').textContent.includes('result'));
    const filtered = await page.locator('[data-index-item]:visible').count();
    assert.ok(filtered > 0 && filtered < all, `python should narrow the index (${filtered} of ${all})`);
    assert.equal(await page.locator('[data-index-item]:visible').evaluateAll(nodes => nodes.some(node => /Recall/i.test(node.textContent))), true);
    assert.equal(await clear.isVisible(), true);
    const box = await clear.boundingBox();
    assert.ok(box && box.width >= 44 && box.height >= 44, 'clear control is a visible target');
    await clear.click();
    assert.equal(await search.inputValue(), '');
    assert.equal(await search.evaluate(el => el === document.activeElement), true);
    assert.equal(await clear.isVisible(), false);
    assert.equal(await dialog.evaluate(el => el.open), true);
    assert.equal(await opener.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('[data-index-item]:visible').count(), all);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#site-index').open);
    assert.equal(await opener.getAttribute('aria-expanded'), 'false');
    assert.equal(await contact.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  });
});

test('selected work stays on the rounded wheel position and both ends sit on the rail center', async () => {
  await withPage({ url: '/#work-list' }, async (page, errors) => {
    await readyBench(page);
    await page.evaluate(() => {
      window.__samples = [];
      const tick = () => {
        const cards = [...document.querySelectorAll('.work-card')];
        const picks = [...document.querySelectorAll('[data-work-pick]')];
        window.__samples.push({
          pos: SkyWorkbench.position(),
          selected: SkyWorkbench.selected(),
          on: cards.findIndex(card => card.classList.contains('is-on')),
          pressed: picks.findIndex(pick => pick.getAttribute('aria-pressed') === 'true'),
          count: document.querySelector('[data-orbit-count]').textContent.trim(),
          name: document.querySelector('.work-card.is-on h3').textContent,
          pick: picks.find(pick => pick.getAttribute('aria-pressed') === 'true')?.querySelector('.orbit-name')?.textContent || '',
        });
        window.__sampleFrame = requestAnimationFrame(tick);
      };
      tick();
    });
    await page.locator('[data-work-pick="0"]').focus();
    const orbit = await page.locator('[data-orbit]').boundingBox();
    await page.mouse.move(orbit.x + orbit.width / 2, orbit.y + 220);
    await page.mouse.wheel(0, 90);
    await page.mouse.wheel(0, 170);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.locator('[data-orbit-step="1"]').click();
    await page.mouse.wheel(0, -80);
    await page.keyboard.press('End');
    await page.locator('[data-orbit-step="-1"]').click();
    await page.locator('[aria-pressed="true"][data-work-pick]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const samples = await page.evaluate(() => { cancelAnimationFrame(window.__sampleFrame); return window.__samples; });
    assert.ok(samples.length > 8, 'the wheel was observed while input changed');
    assert.ok(samples.some(sample => Math.abs(sample.pos - Math.round(sample.pos)) > 0.05), 'a wheel gesture passed between projects');
    for (const sample of samples) {
      assert.equal(sample.selected, Math.round(sample.pos), `selection ${sample.selected} left position ${sample.pos}`);
      assert.equal(sample.on, sample.selected);
      assert.equal(sample.pressed, sample.selected);
      assert.equal(sample.name, sample.pick);
      assert.equal(sample.count, `${String(sample.selected + 1).padStart(2, '0')} / 08`);
    }
    const centerDelta = () => page.evaluate(() => {
      const rail = document.querySelector('.orbit-window').getBoundingClientRect();
      const card = document.querySelector('.orbit-item.is-active').getBoundingClientRect();
      return (card.top + card.height / 2) - (rail.top + rail.height / 2);
    });
    await page.locator('[aria-pressed="true"][data-work-pick]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    const first = await centerDelta();
    assert.ok(Math.abs(first) <= 1, `first project landed ${first}px from the rail center`);
    await page.locator('[aria-pressed="true"][data-work-pick]').focus();
    await page.keyboard.press('End');
    await settle(page);
    const last = await centerDelta();
    assert.ok(Math.abs(last) <= 1, `last project landed ${last}px from the rail center`);
    assert.equal(await page.evaluate(() => SkyWorkbench.selected()), 7);
    assert.deepEqual(errors, []);
  });
});

test('mobile first and last cards center, and narrow pages do not overflow', async () => {
  await withPage({ url: '/#work-list', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    const delta = () => page.evaluate(() => {
      const rail = document.querySelector('.orbit-window').getBoundingClientRect();
      const card = document.querySelector('.orbit-item.is-active').getBoundingClientRect();
      return (card.left + card.width / 2) - (rail.left + rail.width / 2);
    });
    await page.locator('[data-work-pick="0"]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    const first = await delta();
    assert.ok(Math.abs(first) <= 1, `first mobile card is ${first}px off center`);
    assert.equal(await page.evaluate(() => document.querySelector('.work-card.is-on h3').textContent), 'AgentCrucible');
    await page.keyboard.press('End');
    await settle(page);
    const last = await delta();
    assert.ok(Math.abs(last) <= 1, `last mobile card is ${last}px off center`);
    assert.equal(await page.evaluate(() => document.querySelector('.work-card.is-on h3').textContent), 'MoltDAO');
    assert.deepEqual(errors, []);
  });
});

test('narrow pages do not grow a horizontal scrollbar', async () => {
  await withPage({ url: '/work/', width: 390, height: 800, touch: true }, async (page, errors) => {
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 800 });
      for (const url of pages) {
        await page.goto(site.origin + url, { waitUntil: 'domcontentloaded' });
        if (url.startsWith('/#')) await readyBench(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${url} at ${width}px overflows by ${overflow}px`);
      }
    }
    assert.deepEqual(errors, []);
  });
});

test('selection previews a workflow, drawing replay works with the pointer over it, and reduced motion stays still', async () => {
  await withPage({ url: '/#work-list', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('#project-agentcrucible').classList.contains('is-previewed'));
    await page.locator('[data-work-pick="1"]').click();
    await settle(page);
    const drawing = page.locator('#project-airforge .scene-drawing');
    await drawing.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('#project-airforge').classList.contains('is-previewed'));
    assert.equal(await page.locator('#project-airforge [data-scene-action]').getAttribute('aria-pressed'), 'false');
    await drawing.click({ position: { x: 80, y: 80 } });
    await page.waitForFunction(() => SkyWorkbench.playing());
    const first = await page.evaluate(paint, '.physics-ball');
    await page.waitForTimeout(350);
    const next = await page.evaluate(paint, '.physics-ball');
    assert.ok(Math.hypot(next.x - first.x, next.y - first.y) > 1, 'replay advances while the pointer is inside the drawing');
    await page.waitForFunction(() => !SkyWorkbench.playing());
    await drawing.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => SkyWorkbench.playing());
    assert.deepEqual(errors, []);
  });
  await withPage({ url: '/#work-list' }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-work-pick="1"]').click();
    await settle(page);
    const first = await page.evaluate(paint, '.physics-ball');
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(paint, '.physics-ball'), first);
    assert.equal(await page.evaluate(() => SkyWorkbench.playing()), false);
    assert.deepEqual(errors, []);
  });
});

test('each illustration action shows its timed result, resets, and leaves nothing on the next project', async () => {
  await withPage({ url: '/#work-list', reduced: false }, async (page, errors) => {
    await readyBench(page);
    for (const [index, scene] of scenes.entries()) {
      await page.locator(`[data-work-pick="${index}"]`).click();
      await page.waitForFunction(i => SkyWorkbench.selected() === i && SkyWorkbench.settled(), index);
      const card = page.locator(`#${scene.id}`);
      assert.equal(await card.locator('[data-scene-action]').getAttribute('aria-pressed'), 'false');
      await card.locator('.scene-drawing').scrollIntoViewIfNeeded();
      await page.waitForFunction(id => {
        const box = document.getElementById(id).querySelector('.scene-drawing').getBoundingClientRect();
        return box.bottom > 0 && box.top < innerHeight;
      }, scene.id);
      const marker = ['project-airforge','project-ghost-notetaker','project-recall-ai','project-spanforge','project-localpulse','project-moltdao'].includes(scene.id) ? scene.marker : '.scene-courier';
      await page.evaluate(selector => {
        window.__trail = [];
        window.__watch = true;
        const watch = () => {
          if (!window.__watch) return;
          const current = document.querySelector('.work-card.is-on');
          const packet = current.querySelector(selector);
          const box = packet.getBoundingClientRect();
          window.__trail.push({
            status: current.querySelector('[data-scene-status]').textContent,
            transform: packet.getAttribute('transform') || getComputedStyle(packet).transform,
            seen: (box.width > 0 || box.height > 0) && getComputedStyle(packet).opacity !== '0' && getComputedStyle(packet).display !== 'none',
            visual: [box.x,box.y, getComputedStyle(packet).transform,getComputedStyle(packet).fill,getComputedStyle(packet).stroke,getComputedStyle(packet).opacity].join('|'),
            running: current.classList.contains('is-running'),
          });
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      }, marker);
      await card.locator('[data-scene-action]').click();
      await page.waitForFunction(done => {
        const current = document.querySelector('.work-card.is-on');
        return current.querySelector('[data-scene-status]').textContent === done && !current.classList.contains('is-running');
      }, scene.done, { timeout: 8000 });
      const trail = await page.evaluate(() => { window.__watch = false; return window.__trail; });
      const moving = trail.filter(sample => sample.running && sample.seen);
      assert.ok(moving.length > 1, `${scene.id} result never became visible while it ran: ${JSON.stringify(trail.slice(0, 5))}`);
      assert.ok(new Set(moving.map(sample => sample.transform + sample.visual)).size > 1, `${scene.id} did not advance visually while it ran`);
      assert.ok(trail.some(sample => sample.status === scene.mid), `${scene.id} skipped its middle result`);
      assert.equal(await card.locator('[data-scene-action]').getAttribute('aria-pressed'), 'true');
      assert.match(await card.locator('[data-scene-action]').innerText(), new RegExp(await card.locator('[data-scene-action]').getAttribute('data-active-label')));
      assert.match(await page.locator('[data-announce]').innerText(), new RegExp(scene.done.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      const shown = await page.evaluate(paint, scene.marker);
      if (scene.kind === 'opacity') assert.equal(Number(shown.opacity), 1, scene.id);
      if (scene.kind === 'ball') {
        assert.ok(Math.abs(shown.x - 426) <= 2 && Math.abs(shown.y - 207) <= 2, `${scene.id} ball finished at ${shown.x},${shown.y}`);
      }
      if (scene.kind === 'shift') assert.ok(Math.abs(shown.x - scene.x) <= 2, `${scene.id} marker finished at ${shown.x}`);
      if (scene.kind === 'stroke') assert.equal(shown.stroke, shown.hot, scene.id);
      if (scene.kind === 'fill') assert.equal(shown.fill, shown.hot, scene.id);
      await card.locator('[data-scene-action]').click();
      assert.equal(await card.locator('[data-scene-status]').innerText(), scene.idle);
      assert.equal(await card.locator('[data-scene-action]').getAttribute('aria-pressed'), 'false');
      assert.equal(await card.evaluate(el => el.classList.contains('is-probed') || el.classList.contains('is-running') || el.hasAttribute('data-scene-step')), false);
      await page.waitForFunction(id => getComputedStyle(document.getElementById(id).querySelector('.scene-courier')).opacity === '0', scene.id, { timeout: 1000 });
    }
    await page.locator('.project-pick[aria-pressed="true"]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    for (const [index, scene] of scenes.entries()) {
      const next = scenes[(index + 1) % scenes.length];
      await page.locator(`[data-work-pick="${index}"]`).click();
      await page.waitForFunction(i => SkyWorkbench.selected() === i && SkyWorkbench.settled(), index);
      await page.locator(`#${scene.id} [data-scene-action]`).click();
      await page.waitForFunction(mid => document.querySelector('.work-card.is-on [data-scene-status]').textContent === mid, scene.mid);
      if (index === scenes.length - 1) {
        await page.locator('.project-pick[aria-pressed="true"]').focus();
        await page.keyboard.press('Home');
      } else await page.locator(`[data-work-pick="${index + 1}"]`).click();
      await page.waitForFunction(i => SkyWorkbench.selected() === i && SkyWorkbench.settled(), (index + 1) % scenes.length);
      const leftover = await page.locator(`#${scene.id}`).evaluate(el => ({
        status: el.querySelector('[data-scene-status]').textContent,
        pressed: el.querySelector('[data-scene-action]').getAttribute('aria-pressed'),
        running: el.classList.contains('is-running'),
        probed: el.classList.contains('is-probed'),
        step: el.getAttribute('data-scene-step'),
        courier: getComputedStyle(el.querySelector('.scene-courier')).opacity,
      }));
      assert.equal(leftover.status, scene.idle, scene.id);
      assert.equal(leftover.pressed, 'false', scene.id);
      assert.equal(leftover.running, false, scene.id);
      assert.equal(leftover.probed, false, scene.id);
      assert.equal(leftover.step, null, scene.id);
      assert.equal(leftover.courier, '0', scene.id);
      assert.equal(await page.locator(`#${next.id} [data-scene-action]`).getAttribute('aria-pressed'), 'false');
    }
    assert.deepEqual(errors, []);
  });
});

test('reduced motion shows each illustration result immediately and does not animate it', async () => {
  await withPage({ url: '/#work-list' }, async (page, errors) => {
    await readyBench(page);
    for (const [index, scene] of scenes.entries()) {
      await page.locator(`[data-work-pick="${index}"]`).click();
      await page.waitForFunction(i => SkyWorkbench.selected() === i && SkyWorkbench.settled(), index);
      await page.locator(`#${scene.id} [data-scene-action]`).click();
      const state = await page.locator(`#${scene.id}`).evaluate((card, marker) => {
        const drawn = card.querySelector(marker);
        return {
          status: card.querySelector('[data-scene-status]').textContent,
          running: card.classList.contains('is-running'),
          pressed: card.querySelector('[data-scene-action]').getAttribute('aria-pressed'),
          animation: getComputedStyle(drawn).animationName,
          courier: getComputedStyle(card.querySelector('.scene-courier')).opacity,
        };
      }, scene.marker);
      assert.equal(state.status, scene.done, scene.id);
      assert.equal(state.running, false, scene.id);
      assert.equal(state.pressed, 'true', scene.id);
      assert.equal(state.animation, 'none', scene.id);
      assert.equal(state.courier, '0', scene.id);
      const shown = await page.evaluate(paint, scene.marker);
      if (scene.kind === 'opacity') assert.equal(Number(shown.opacity), 1, scene.id);
      if (scene.kind === 'ball') assert.ok(Math.abs(shown.x - 426) <= 1 && Math.abs(shown.y - 207) <= 1, scene.id);
      if (scene.kind === 'shift') assert.ok(Math.abs(shown.x - scene.x) <= 1, scene.id);
      if (scene.kind === 'stroke') assert.equal(shown.stroke, shown.hot, scene.id);
      if (scene.kind === 'fill') assert.equal(shown.fill, shown.hot, scene.id);
    }
    assert.deepEqual(errors, []);
  });
});

async function sampleDrawing(page, frames = 8) {
  return page.evaluate(count => new Promise(resolve => {
    const card = document.querySelector('.work-card.is-on');
    const courier = card.querySelector('.scene-courier');
    const ball = () => getComputedStyle(card.querySelector('.physics-ball')).transform;
    const animations = () => [...card.querySelectorAll('.scene-svg *')].flatMap(el => el.getAnimations({ subtree: true }).map(animation => ({
      name: animation.animationName, state: animation.playState, time: animation.currentTime,
    })));
    const start = { ball: ball(), courier: courier.getAttribute('transform'), frames: window.SkyPresence ? SkyPresence.frames() : 0, animations: animations() };
    let left = count;
    const step = () => {
      if (--left) requestAnimationFrame(step);
      else resolve({
        start,
        ball: ball(),
        courier: courier.getAttribute('transform'),
        frames: (window.SkyPresence ? SkyPresence.frames() : 0) - start.frames,
        animations: animations(),
        running: window.SkyPresence ? SkyPresence.running() : false,
      });
    };
    requestAnimationFrame(step);
  }), frames);
}

test('a hidden tab and an offscreen workbench pause drawing without a clock wait', async () => {
  await withPage({ url: '/#work-list', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-work-pick="1"]').click();
    await page.waitForFunction(() => SkyWorkbench.selected() === 1 && SkyWorkbench.settled());
    const live = await sampleDrawing(page);
    assert.ok(live.frames > 0, 'presence drawing did not advance while the workbench was on screen');
    await page.locator('#project-airforge [data-scene-action]').click();
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ramp guides the fall');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get() { return true; } });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await sampleDrawing(page);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('page-hidden')), true);
    assert.equal(hidden.courier, hidden.start.courier, 'illustration courier advanced while the tab was hidden');
    assert.equal(hidden.frames, 0, 'presence kept drawing while the tab was hidden');
    assert.equal(hidden.running, false);
    assert.equal(hidden.ball, hidden.start.ball, 'the ball advanced while the tab was hidden');
    assert.ok(hidden.animations.every(animation => animation.state !== 'running'), `hidden animations stayed active: ${JSON.stringify(hidden.animations)}`);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const resumed = await sampleDrawing(page);
    assert.ok(resumed.frames > 0, 'presence did not resume when the tab returned');
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ball settles on the platform' && !document.querySelector('#project-airforge').classList.contains('is-running'), null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});

test('scrolling the workbench off screen pauses its drawing and continues on return', async () => {
  await withPage({ url: '/#work-list', reduced: false, height: 480 }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-work-pick="1"]').click();
    await page.waitForFunction(() => SkyWorkbench.selected() === 1 && SkyWorkbench.settled());
    await page.locator('#project-airforge [data-scene-action]').click();
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ramp guides the fall');
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForFunction(() => {
      const drawing = document.querySelector('#project-airforge .scene-drawing').getBoundingClientRect();
      const hero = document.querySelector('[data-presence="hero"]').getBoundingClientRect();
      const work = document.querySelector('[data-presence="work"]').getBoundingClientRect();
      return drawing.bottom < 0 && hero.bottom < 0 && work.bottom < 0;
    }, null, { timeout: 5000 });
    const away = await sampleDrawing(page);
    assert.equal(away.courier, away.start.courier, 'illustration courier advanced off screen');
    assert.equal(away.frames, 0, 'presence kept drawing off screen');
    assert.equal(away.ball, away.start.ball, 'the ball advanced off screen');
    assert.ok(away.animations.every(animation => animation.state !== 'running'), `offscreen animations stayed active: ${JSON.stringify(away.animations)}`);
    await page.locator('#work-list').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const bench = document.querySelector('[data-workbench]').getBoundingClientRect();
      return bench.top < innerHeight && bench.bottom > 0;
    });
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ball settles on the platform', null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});
