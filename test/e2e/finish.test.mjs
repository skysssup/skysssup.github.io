import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pages = ['/#agentcrucible', '/work/', '/work/agentcrucible/', '/work/airforge/', '/work/shipgate/', '/work/recall-ai/', '/work/spanforge/', '/work/localpulse/', '/work/ghost-notetaker/', '/work/moltdao/'];
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
    await context.addInitScript(() => {
      window.portraitDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas && this.canvas.classList && this.canvas.classList.contains('hero-dots')) window.portraitDraws++;
        return draw.apply(this, args);
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(site.origin + (options.url || '/work/'), { waitUntil: 'domcontentloaded' });
    await run(page, errors);
  } finally {
    await context.close();
  }
}

const settle = page => page.waitForFunction(() => window.SkyStudio && SkyStudio.settled());
const readyBench = page => page.waitForFunction(() => document.querySelector('[data-studio].is-ready') && window.SkyStudio && SkyStudio.settled());

async function showWheel(page) {
  const picker = page.locator('[data-studio-picker]');
  if (await picker.evaluate(el => getComputedStyle(el).display !== 'none') && await picker.getAttribute('aria-expanded') !== 'true') await picker.click();
}

async function reveal(page, locator) {
  const slug=await locator.evaluate(el=>el.closest('[data-studio-panel]')?.dataset.studioPanel);
  if(slug) {
    const pick=page.locator(`[data-studio-panel="${slug}"] [data-studio-view-pick="illustration"]`);
    if(await pick.count() && await pick.getAttribute('aria-pressed')!=='true') await pick.click();
  }
  const shown = await locator.evaluate(el => {
    const box = el.getBoundingClientRect();
    const pane = document.querySelector('.studio-pane').getBoundingClientRect();
    return box.width > 0 && box.bottom > pane.top && box.top < pane.bottom;
  });
  if (!shown) await locator.evaluate(el => el.scrollIntoView({ block: 'nearest' }));
}

function paint(selector) {
  const el = document.querySelector('.work-card.is-on').querySelector(selector);
  const probe = document.createElement('canvas').getContext('2d');
  const hex = value => { probe.fillStyle = '#000'; probe.fillStyle = value || '#000'; return probe.fillStyle; };
  const hot = hex(getComputedStyle(document.querySelector('.studio-page')).getPropertyValue('--accent').trim() || '#000');
  const style = getComputedStyle(el);
  const matrix = new DOMMatrix(style.transform);
  const end = window.SkyLabControls.previewRamp(30).samples.at(-1);
  return {
    opacity: style.opacity,
    fill: hex(style.fill),
    stroke: hex(style.stroke),
    x: el.hasAttribute('cx') ? Number(el.getAttribute('cx')) : matrix.e,
    y: el.hasAttribute('cy') ? Number(el.getAttribute('cy')) : matrix.f,
    hot,
    landing: { x: end[0], y: end[1] },
  };
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
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
    await page.goto(site.origin + '/#work-list', { waitUntil: 'domcontentloaded' });
    await readyBench(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
    await page.evaluate(() => {
      window.__samples = [];
      const tick = () => {
        const panels = [...document.querySelectorAll('[data-studio-panel]')];
        const picks = [...document.querySelectorAll('[data-studio-pick]')];
        const count = picks.length;
        const pos = SkyStudio.position();
        const selected = SkyStudio.selected();
        window.__samples.push({
          pos,
          selected,
          rounded: ((Math.round(pos) % count) + count) % count,
          on: panels.findIndex(panel => panel.classList.contains('is-current')),
          pressed: picks.findIndex(pick => pick.getAttribute('aria-selected') === 'true'),
          count: document.querySelector('[data-studio-count]').textContent.trim(),
          name: document.querySelector('[data-studio-current-name]').textContent,
          pick: picks.find(pick => pick.getAttribute('aria-selected') === 'true').querySelector('.studio-tile-name').textContent,
        });
        window.__sampleFrame = requestAnimationFrame(tick);
      };
      tick();
    });
    await showWheel(page);
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    const orbit = await page.locator('[data-studio-wheel]').boundingBox();
    await page.mouse.move(orbit.x + orbit.width / 2, orbit.y + 220);
    await page.mouse.wheel(0, 90);
    await page.mouse.wheel(0, 170);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.locator('[data-studio-step="1"]').click();
    await page.mouse.wheel(0, -80);
    await page.keyboard.press('End');
    await page.locator('[data-studio-step="-1"]').click();
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
    await settle(page);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const samples = await page.evaluate(() => { cancelAnimationFrame(window.__sampleFrame); return window.__samples; });
    assert.ok(samples.length > 8, 'the wheel was observed while input changed');
    assert.ok(samples.some(sample => Math.abs(sample.pos - Math.round(sample.pos)) > 0.05), 'a wheel gesture passed between projects');
    for (const sample of samples) {
      assert.equal(sample.selected, sample.rounded, `selection ${sample.selected} left position ${sample.pos}`);
      assert.equal(sample.on, sample.selected);
      assert.equal(sample.pressed, sample.selected);
      assert.equal(sample.name, sample.pick);
      assert.equal(sample.count, `${String(sample.selected + 1).padStart(2, '0')} / 10`);
    }
    const centerDelta = () => page.evaluate(() => {
      const rail = document.querySelector('.studio-wheel-window').getBoundingClientRect();
      const card = document.querySelector('[data-studio-item].is-active').getBoundingClientRect();
      return (card.top + card.height / 2) - (rail.top + rail.height / 2);
    });
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    const first = await centerDelta();
    assert.ok(Math.abs(first) <= 1, `first item landed ${first}px from the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'about');
    await page.keyboard.press('End');
    await settle(page);
    const last = await centerDelta();
    assert.ok(Math.abs(last) <= 1, `last item landed ${last}px from the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'contact');
    assert.equal(await page.evaluate(() => SkyStudio.selected()), 9);
    await page.keyboard.press('ArrowUp');
    await settle(page);
    assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'MoltDAO');
    const projectEnd = await centerDelta();
    assert.ok(Math.abs(projectEnd) <= 1, `last project landed ${projectEnd}px from the curve focus`);
    await page.keyboard.press('ArrowDown');
    await settle(page);
    const wrapped = await centerDelta();
    assert.ok(Math.abs(wrapped) <= 1, `wrapped neighbor landed ${wrapped}px from the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'contact');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowUp');
    await settle(page);
    const otherWrap = await centerDelta();
    assert.ok(Math.abs(otherWrap) <= 1, `wrapped previous neighbor landed ${otherWrap}px from the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'contact');
    assert.equal(await page.locator('[data-studio-pick="1"] .studio-tile-name').innerText(), 'AgentCrucible');
    assert.equal(await page.locator('[data-studio-pick="8"] .studio-tile-name').innerText(), 'MoltDAO');
    assert.deepEqual(errors, []);
  });
});

test('mobile first and last cards center, and narrow pages do not overflow', async () => {
  await withPage({ url: '/#agentcrucible', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    await showWheel(page);
    const delta = () => page.evaluate(() => {
      const rail = document.querySelector('.studio-wheel-window').getBoundingClientRect();
      const card = document.querySelector('[data-studio-item].is-active').getBoundingClientRect();
      return (card.top + card.height / 2) - (rail.top + rail.height / 2);
    });
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    await page.keyboard.press('Home');
    await settle(page);
    const first = await delta();
    assert.ok(Math.abs(first) <= 1, `first mobile card is ${first}px off the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'about');
    await page.keyboard.press('End');
    await settle(page);
    const last = await delta();
    assert.ok(Math.abs(last) <= 1, `last mobile card is ${last}px off the curve focus`);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'contact');
    await page.locator('[data-studio-pick="1"]').click();
    await settle(page);
    await showWheel(page);
    assert.equal(await page.locator('[data-studio-pick="1"] .studio-tile-name').innerText(), 'AgentCrucible');
    const agent = await delta();
    assert.ok(Math.abs(agent) <= 1, `AgentCrucible is ${agent}px off the curve focus`);
    await showWheel(page);
    await page.locator('[data-studio-pick="8"]').click();
    await settle(page);
    assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'MoltDAO');
    const molt = await delta();
    assert.ok(Math.abs(molt) <= 1, `MoltDAO is ${molt}px off the curve focus`);
    assert.deepEqual(errors, []);
  });
});

test('resizing during mobile keyboard selection preserves its requested endpoint', async () => {
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-studio-pick="2"]').click();
    await settle(page);
    assert.equal(await page.evaluate(() => SkyStudio.slug()), 'airforge');
    await page.setViewportSize({ width: 390, height: 844 });
    await showWheel(page);
    await page.locator('[data-studio-pick="2"]').focus();
    await page.keyboard.press('End');
    await page.setViewportSize({ width: 391, height: 844 });
    await page.waitForFunction(() => SkyStudio.slug() === 'contact' && SkyStudio.settled());
    const offset = await page.evaluate(() => {
      const card = document.querySelector('[data-studio-item].is-active').getBoundingClientRect();
      const viewport = document.querySelector('.studio-wheel-window').getBoundingClientRect();
      return ((card.top + card.bottom) - (viewport.top + viewport.bottom)) / 2;
    });
    assert.ok(Math.abs(offset) < 1, `resized endpoint is ${offset}px off the curve focus`);
    await page.setViewportSize({ width: 768, height: 844 });
    await page.waitForFunction(() => SkyStudio.slug() === 'contact' && SkyStudio.settled());
    const crossed = await page.evaluate(() => {
      const card = document.querySelector('[data-studio-item].is-active').getBoundingClientRect();
      const viewport = document.querySelector('.studio-wheel-window').getBoundingClientRect();
      return ((card.top + card.bottom) - (viewport.top + viewport.bottom)) / 2;
    });
    assert.ok(Math.abs(crossed) < 1, `crossing 600px left the endpoint ${crossed}px off the curve focus`);
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
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => document.querySelector('#project-agentcrucible').classList.contains('is-running') || document.querySelector('#project-agentcrucible [data-scene-status]').textContent !== 'Tool call → committed state → checked claim');
    await page.locator('[data-studio-pick="2"]').click();
    await settle(page);
    const drawing = page.locator('#project-airforge .scene-drawing');
    await reveal(page, drawing);
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => {
      const card = document.querySelector('#project-airforge');
      return card.classList.contains('is-current') && (card.classList.contains('is-running') || card.querySelector('[data-scene-status]').textContent !== 'Draw a ramp, then drop the ball');
    });
    assert.equal(await page.locator('#project-airforge [data-scene-action]').getAttribute('aria-pressed'), 'false');
    const box = await drawing.boundingBox();
    await page.mouse.move(box.x + 80, box.y + 80);
    await drawing.click({ position: { x: 80, y: 80 } });
    assert.equal(await page.locator('#studio-viewer').evaluate(el => el.open), true);
    assert.equal(await page.locator('#project-airforge [data-scene-action]').getAttribute('aria-pressed'), 'false');
    await page.locator('[data-studio-viewer-close]').click();
    await page.locator('#project-airforge [data-scene-action]').click();
    await page.waitForFunction(() => SkyStudio.playing());
    const first = await page.evaluate(paint, '.physics-ball');
    await page.waitForTimeout(350);
    const next = await page.evaluate(paint, '.physics-ball');
    assert.ok(Math.hypot(next.x - first.x, next.y - first.y) > 1, 'replay advances while the pointer is inside the drawing');
    await page.locator('[data-bench-live]').click();
    const held = await page.evaluate(paint, '.physics-ball');
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(paint, '.physics-ball'), held, 'examples off pauses the illustration');
    await page.locator('[data-bench-live]').click();
    await page.waitForFunction(() => !SkyStudio.playing());
    await page.locator('#project-airforge [data-scene-action]').click();
    assert.match(await page.locator('#project-airforge [data-scene-action]').innerText(), /^Replay/);
    await page.locator('#project-airforge [data-scene-action]').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => SkyStudio.playing());
    assert.deepEqual(errors, []);
  });
  await withPage({ url: '/#agentcrucible' }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-studio-pick="2"]').click();
    await settle(page);
    const first = await page.evaluate(paint, '.physics-ball');
    await page.waitForTimeout(400);
    assert.deepEqual(await page.evaluate(paint, '.physics-ball'), first);
    assert.equal(await page.evaluate(() => SkyStudio.playing()), false);
    assert.deepEqual(errors, []);
  });
});

test('each illustration action shows its timed result, resets, and leaves nothing on the next project', async () => {
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    for (const [index, scene] of scenes.entries()) {
      const studioIndex = index + 1;
      await page.locator(`[data-studio-pick="${studioIndex}"]`).click();
      await page.waitForFunction(i => SkyStudio.selected() === i && SkyStudio.settled(), studioIndex);
      const card = page.locator(`#${scene.id}`);
      const action = card.locator('[data-scene-action]');
      assert.equal(await action.getAttribute('aria-pressed'), 'false');
      await reveal(page, card.locator('.scene-drawing'));
      await page.waitForFunction(id => {
        const box = document.getElementById(id).querySelector('.scene-drawing').getBoundingClientRect();
        const pane = document.querySelector('.studio-pane').getBoundingClientRect();
        return box.bottom > pane.top && box.top < pane.bottom;
      }, scene.id);
      const marker = ['project-airforge', 'project-ghost-notetaker', 'project-recall-ai', 'project-spanforge', 'project-localpulse', 'project-moltdao'].includes(scene.id) ? scene.marker : '.scene-courier';
      await page.evaluate(selector => {
        window.__trail = [];
        window.__watch = true;
        const watch = () => {
          if (!window.__watch) return;
          const current = document.querySelector('.work-card.is-on');
          const packet = current.querySelector(selector);
          const box = packet.getBoundingClientRect();
          let effectiveOpacity=1;
          for(let node=packet;node&&node!==current;node=node.parentElement) effectiveOpacity*=Number(getComputedStyle(node).opacity);
          window.__trail.push({
            status: current.querySelector('[data-scene-status]').textContent,
            transform: packet.getAttribute('transform') || packet.getAttribute('cx') || getComputedStyle(packet).transform,
            seen: (box.width > 0 || box.height > 0) && effectiveOpacity > 0 && getComputedStyle(packet).display !== 'none',
            visual: [box.x, box.y, packet.getAttribute('cx'), packet.getAttribute('cy'), getComputedStyle(packet).transform, getComputedStyle(packet).fill, getComputedStyle(packet).stroke, getComputedStyle(packet).opacity,effectiveOpacity].join('|'),
            running: current.classList.contains('is-running'),
          });
          requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      }, marker);
      await action.click();
      await page.waitForFunction(done => {
        const current = document.querySelector('.work-card.is-on');
        return current.querySelector('[data-scene-status]').textContent === done && !current.classList.contains('is-running');
      }, scene.done, { timeout: 8000 });
      const trail = await page.evaluate(() => { window.__watch = false; return window.__trail; });
      const moving = trail.filter(sample => sample.running && sample.seen);
      assert.ok(moving.length > 1, `${scene.id} result never became visible while it ran: ${JSON.stringify(trail.slice(0, 5))}`);
      assert.ok(new Set(moving.map(sample => sample.transform + sample.visual)).size > 1, `${scene.id} did not advance visually while it ran`);
      assert.ok(trail.some(sample => sample.status === scene.mid), `${scene.id} skipped its middle result`);
      assert.equal(await action.getAttribute('aria-pressed'), 'true');
      assert.match(await action.innerText(), /^Reset/);
      const shown = await page.evaluate(paint, scene.marker);
      if (scene.kind === 'opacity') assert.equal(Number(shown.opacity), 1, scene.id);
      if (scene.kind === 'ball') {
        assert.ok(Math.abs(shown.x - shown.landing.x) <= 2 && Math.abs(shown.y - shown.landing.y) <= 2, `${scene.id} ball finished at ${shown.x},${shown.y} instead of ${shown.landing.x},${shown.landing.y}`);
      }
      if (scene.kind === 'shift') assert.ok(Math.abs(shown.x - scene.x) <= 2, `${scene.id} marker finished at ${shown.x}`);
      if (scene.kind === 'stroke') assert.equal(shown.stroke, shown.hot, scene.id);
      if (scene.kind === 'fill') assert.equal(shown.fill, shown.hot, scene.id);
      await action.click();
      assert.equal(await card.locator('[data-scene-status]').innerText(), scene.idle);
      assert.equal(await action.getAttribute('aria-pressed'), 'false');
      assert.match(await action.innerText(), /^Replay/);
      assert.equal(await card.evaluate(el => el.classList.contains('is-probed') || el.classList.contains('is-running') || el.hasAttribute('data-scene-step')), false);
      await page.waitForFunction(id => getComputedStyle(document.getElementById(id).querySelector('.scene-courier')).opacity === '0', scene.id, { timeout: 1000 });
    }
    for (const [index, scene] of scenes.entries()) {
      const studioIndex = index + 1;
      const nextIndex = (index + 1) % scenes.length + 1;
      const next = scenes[(index + 1) % scenes.length];
      await page.locator(`[data-studio-pick="${studioIndex}"]`).click();
      await page.waitForFunction(i => SkyStudio.selected() === i && SkyStudio.settled(), studioIndex);
      await reveal(page, page.locator(`#${scene.id} [data-scene-action]`));
      await page.locator(`#${scene.id} [data-scene-action]`).click();
      await page.waitForFunction(mid => document.querySelector('.work-card.is-on [data-scene-status]').textContent === mid, scene.mid);
      await page.locator(`[data-studio-pick="${nextIndex}"]`).click();
      await page.waitForFunction(i => SkyStudio.selected() === i && SkyStudio.settled(), nextIndex);
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
  await withPage({ url: '/#agentcrucible' }, async (page, errors) => {
    await readyBench(page);
    for (const [index, scene] of scenes.entries()) {
      const studioIndex = index + 1;
      await page.locator(`[data-studio-pick="${studioIndex}"]`).click();
      await page.waitForFunction(i => SkyStudio.selected() === i && SkyStudio.settled(), studioIndex);
      await reveal(page, page.locator(`#${scene.id} [data-scene-action]`));
      await page.locator(`#${scene.id} [data-scene-action]`).click();
      const state = await page.locator(`#${scene.id}`).evaluate((card, marker) => {
        const drawn = card.querySelector(marker);
        return {
          status: card.querySelector('[data-scene-status]').textContent,
          running: card.classList.contains('is-running'),
          pressed: card.querySelector('[data-scene-action]').getAttribute('aria-pressed'),
          label: card.querySelector('[data-scene-action]').textContent,
          animation: getComputedStyle(drawn).animationName,
          courier: getComputedStyle(card.querySelector('.scene-courier')).opacity,
        };
      }, scene.marker);
      assert.equal(state.status, scene.done, scene.id);
      assert.equal(state.running, false, scene.id);
      assert.equal(state.pressed, 'true', scene.id);
      assert.match(state.label, /^Reset/);
      assert.equal(state.animation, 'none', scene.id);
      assert.equal(state.courier, '0', scene.id);
      const shown = await page.evaluate(paint, scene.marker);
      if (scene.kind === 'opacity') assert.equal(Number(shown.opacity), 1, scene.id);
      if (scene.kind === 'ball') assert.ok(Math.abs(shown.x - shown.landing.x) <= 1 && Math.abs(shown.y - shown.landing.y) <= 1, scene.id);
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
    const ball = () => {
      const node = card.querySelector('.physics-ball');
      return `${node.getAttribute('cx')},${node.getAttribute('cy')}`;
    };
    const animations = () => [...card.querySelectorAll('.scene-svg *')].flatMap(el => el.getAnimations({ subtree: true }).map(animation => ({
      name: animation.animationName, state: animation.playState, time: animation.currentTime,
    })));
    const start = { ball: ball(), courier: courier.getAttribute('transform'), frames: window.portraitDraws || 0, animations: animations() };
    let left = count;
    const step = () => {
      if (--left) requestAnimationFrame(step);
      else resolve({
        start,
        ball: ball(),
        courier: courier.getAttribute('transform'),
        frames: (window.portraitDraws || 0) - start.frames,
        animations: animations(),
      });
    };
    requestAnimationFrame(step);
  }), frames);
}

test('a hidden tab and an offscreen workbench pause drawing without a clock wait', async () => {
  await withPage({ url: '/#agentcrucible', reduced: false }, async (page, errors) => {
    await readyBench(page);
    await page.locator('[data-studio-pick="2"]').click();
    await page.waitForFunction(() => SkyStudio.selected() === 2 && SkyStudio.settled());
    await reveal(page,page.locator('#project-airforge [data-scene-action]'));
    await page.locator('#project-airforge [data-scene-action]').click();
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ramp guides the fall');
    const live = await sampleDrawing(page);
    assert.notEqual(live.ball, live.start.ball, 'the ball did not advance while the illustration was on screen');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get() { return true; } });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hidden = await sampleDrawing(page);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('page-hidden')), true);
    assert.equal(hidden.courier, hidden.start.courier, 'illustration courier advanced while the tab was hidden');
    assert.equal(hidden.frames, 0, 'the portrait kept drawing while the tab was hidden');
    assert.equal(hidden.ball, hidden.start.ball, 'the ball advanced while the tab was hidden');
    assert.ok(hidden.animations.every(animation => animation.state !== 'running'), `hidden animations stayed active: ${JSON.stringify(hidden.animations)}`);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ball settles on the platform' && !document.querySelector('#project-airforge').classList.contains('is-running'), null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});

test('scrolling the workbench off screen pauses its drawing and continues on return', async () => {
  await withPage({ url: '/#agentcrucible', reduced: false, height: 480 }, async (page, errors) => {
    await readyBench(page);
    assert.equal(await page.locator('[data-presence]').count(), 0);
    await page.locator('[data-studio-pick="2"]').click();
    await page.waitForFunction(() => SkyStudio.selected() === 2 && SkyStudio.settled());
    await reveal(page,page.locator('#project-airforge [data-scene-action]'));
    await page.locator('#project-airforge [data-scene-action]').click();
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ramp guides the fall');
    await page.setViewportSize({width:1440,height:240});
    await page.evaluate(() => {
      const panel = document.getElementById('project-airforge');
      const drawing = panel.querySelector('.scene-drawing');
      panel.scrollTop = drawing.offsetTop + drawing.offsetHeight + panel.clientHeight;
    });
    await page.waitForFunction(() => {
      const drawing = document.querySelector('#project-airforge .scene-drawing').getBoundingClientRect();
      const pane = document.querySelector('.studio-pane').getBoundingClientRect();
      return drawing.bottom <= pane.top || drawing.top >= pane.bottom;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => SkyStudio.snapshot().scene && SkyStudio.snapshot().scene.visible === false);
    const away = await sampleDrawing(page);
    assert.equal(away.courier, away.start.courier, 'illustration courier advanced off screen');
    assert.equal(away.ball, away.start.ball, 'the ball advanced off screen');
    assert.ok(away.animations.every(animation => animation.state !== 'running'), `offscreen animations stayed active: ${JSON.stringify(away.animations)}`);
    await page.setViewportSize({width:1440,height:480});
    await page.evaluate(() => { document.getElementById('project-airforge').scrollTop = 0; });
    await page.waitForFunction(() => {
      const drawing = document.querySelector('#project-airforge .scene-drawing').getBoundingClientRect();
      const pane = document.querySelector('.studio-pane').getBoundingClientRect();
      return drawing.bottom > pane.top && drawing.top < pane.bottom;
    });
    await page.waitForFunction(() => document.querySelector('#project-airforge [data-scene-status]').textContent === 'Ball settles on the platform', null, { timeout: 5000 });
    assert.deepEqual(errors, []);
  });
});

test('a project request settles while the workbench is outside a short viewport', async () => {
  await withPage({ url: '/', reduced: false, height: 480 }, async (page, errors) => {
    await readyBench(page);
    await page.evaluate(() => { document.querySelector('.studio-panel.is-current').scrollTop = 99999; });
    await page.evaluate(() => SkyStudio.select(4));
    await page.waitForFunction(() => SkyStudio.selected() === 4 && SkyStudio.settled() && SkyStudio.slug() === 'recall-ai');
    assert.equal(await page.locator('.work-card.is-on').getAttribute('id'), 'project-recall-ai');
    assert.equal(await page.locator('[data-studio-pick="4"]').getAttribute('aria-selected'), 'true');
    assert.deepEqual(errors, []);
  });
  await withPage({ url: '/', width: 390, height: 800, touch: true }, async (page, errors) => {
    await readyBench(page);
    assert.equal(await page.locator('[data-studio-picker]').getAttribute('aria-expanded'), 'false');
    await page.evaluate(() => SkyStudio.selectSlug('recall-ai'));
    await page.waitForFunction(() => SkyStudio.slug() === 'recall-ai' && SkyStudio.settled());
    assert.equal(await page.locator('[data-studio-picker]').getAttribute('aria-expanded'), 'false');
    assert.equal(await page.locator('[data-studio-pick="4"]').getAttribute('aria-selected'), 'true');
    await showWheel(page);
    assert.equal(await page.locator('#project-recall-ai.is-current').count(), 1);
    assert.deepEqual(errors, []);
  });
});
