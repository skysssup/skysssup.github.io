import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { serve } from './server.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let browser, site;
before(async () => { site = await serve(root); browser = await chromium.launch({ channel: 'chrome' }); });
after(async () => { await browser?.close(); site?.server.close(); });

async function open(options = {}) {
  const { url = '/#about', hookHero = false, ...rest } = options;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...rest });
  if (hookHero) {
    await context.addInitScript(() => {
      window.portraitDraws = 0;
      const draw = WebGL2RenderingContext.prototype.drawArrays;
      WebGL2RenderingContext.prototype.drawArrays = function (...args) {
        if (this.canvas && this.canvas.classList && this.canvas.classList.contains('hero-dots')) window.portraitDraws++;
        return draw.apply(this, args);
      };
    });
  }
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + url);
  await page.locator('[data-studio].is-ready').waitFor();
  await page.locator('#figure.is-live').waitFor();
  await page.waitForFunction(() => window.SkyStudio && window.SkyStudio.settled());
  return { context, page, errors };
}
const settle = page => page.waitForFunction(() => window.SkyStudio.settled(), null, { timeout: 3000 });

async function showWheel(page) {
  const picker = page.locator('[data-studio-picker]');
  if (await picker.evaluate(el => getComputedStyle(el).display !== 'none') && await picker.getAttribute('aria-expanded') !== 'true') {
    await picker.click();
  }
}

async function illustration(page, card) {
  const pick=card.locator('[data-studio-view-pick="illustration"]');
  if(await pick.count()) await pick.click();
}

test('the project wheel settles cleanly through wheel, keys, buttons, and rapid reversals', async () => {
  const { page, context, errors } = await open({ url: '/#hero' });
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'about');
  assert.equal(await page.evaluate(() => window.SkyWorkbench), undefined);
  assert.equal(await page.evaluate(() => window.SkyPresence), undefined);
  assert.equal(await page.evaluate(() => window.SkyScrollField), undefined);
  await page.goto(site.origin + '/#work-list');
  await settle(page);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'agentcrucible');
  await page.goto(site.origin + '/#about');
  await settle(page);
  const entries = await page.evaluate(() => JSON.parse(document.getElementById('studio-data').textContent).map(item => item.slug));
  assert.deepEqual(entries, ['about', 'agentcrucible', 'airforge', 'shipgate', 'recall-ai', 'spanforge', 'localpulse', 'ghost-notetaker', 'moltdao', 'contact']);
  assert.equal(await page.locator('[data-studio-pick][role="option"]').count(), 10);
  const wheel = await page.locator('[data-studio-wheel]').boundingBox();
  await page.mouse.move(wheel.x + wheel.width / 2, wheel.y + wheel.height / 2);
  await page.mouse.wheel(0, 140);
  await page.waitForTimeout(180);
  await settle(page);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'airforge');
  assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'AirForge');
  await page.locator('[data-studio-pick][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowDown');
  await settle(page);
  assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'Shipgate');
  assert.equal(await page.evaluate(() => location.hash), '#shipgate');
  assert.equal(await page.locator('[data-studio-count]').innerText(), '04 / 10');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  await settle(page);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'moltdao');
  assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'MoltDAO');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await settle(page);
  assert.equal(await page.evaluate(() => SkyStudio.slug()), 'about', 'the wheel cycles from the last entry to the first');
  assert.equal(await page.locator('[data-studio-pick][aria-selected="true"]').count(), 1);
  assert.equal(await page.locator('[data-studio-panel].is-current.is-on').count(), 1);
  assert.equal(await page.locator('[data-studio-panel]:not(.is-current)').evaluateAll(cards => cards.every(card => card.inert && card.getAttribute('aria-hidden') === 'true')), true);
  assert.equal(await page.locator('[data-studio-panel].is-current').evaluate(card => card.inert || card.getAttribute('aria-hidden') !== 'false'), false);
  await page.evaluate(() => SkyStudio.selectSlug('ghost-notetaker'));
  await page.waitForFunction(() => SkyStudio.slug() === 'ghost-notetaker' && SkyStudio.settled());
  await page.locator('[data-studio-pick][aria-selected="true"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'project-ghost-notetaker');
  await page.locator('.work-card.is-on .scene-links a').first().click();
  await page.waitForURL('**/work/ghost-notetaker/');
  assert.deepEqual(errors, []);
  await context.close();
});

test('wheel boundaries keep the page still, and drag or click commits the gesture that finishes', async () => {
  const { page, context, errors } = await open();
  await page.locator('[data-studio-pick][aria-selected="true"]').focus();
  await page.keyboard.press('End');
  await settle(page);
  const wheel = await page.locator('[data-studio-wheel]').boundingBox();
  await page.mouse.move(wheel.x + 80, wheel.y + wheel.height / 2);
  const initial = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => scrollY), initial, 'wheel input must not scroll the document');
  await page.keyboard.press('Home');
  await settle(page);
  const first = await page.locator('[data-studio-item].is-active').boundingBox();
  await page.mouse.move(first.x + 60, first.y + 40);
  await page.mouse.down();
  await page.mouse.move(first.x + 60, first.y - 220, { steps: 15 });
  await page.mouse.up();
  await settle(page);
  assert.ok(await page.evaluate(() => window.SkyStudio.selected()) >= 2, 'a drag must commit its final position');
  assert.equal(await page.locator('.is-dragging').count(), 0);
  assert.equal(await page.evaluate(() => SkyStudio.settled()), true);
  await page.mouse.move(wheel.x + 80, wheel.y + wheel.height / 2);
  await page.mouse.wheel(0, 280);
  await page.locator('[data-studio-pick="4"]').click();
  await settle(page);
  assert.equal(await page.evaluate(() => SkyStudio.selected()), 4);
  await page.waitForTimeout(220);
  assert.equal(await page.evaluate(() => SkyStudio.selected()), 4, 'a pick click cancels the in-flight wheel');
  assert.equal(await page.evaluate(() => scrollY), initial);
  assert.deepEqual(errors, []);
  await context.close();
});

test('each project scene responds, resets on leaving, and stops processing input while idle', async () => {
  const { page, context, errors } = await open({ reducedMotion: 'reduce' });
  await page.evaluate(() => SkyStudio.selectSlug('agentcrucible'));
  await settle(page);
  await illustration(page,page.locator('#project-agentcrucible'));
  const point = await page.evaluate(() => {
    const svg = document.querySelector('#project-agentcrucible .scene-svg');
    const spot = new DOMPoint(100, 180).matrixTransform(svg.getScreenCTM());
    return { x: spot.x, y: spot.y };
  });
  await page.mouse.move(point.x, point.y);
  await page.waitForFunction(() => document.querySelector('#project-agentcrucible [data-scene-status]').textContent === 'Tool call enters the fault test');
  assert.match(await page.locator('#project-agentcrucible .scene-pointer').getAttribute('transform'), /translate\(100[\s,]180\)/);
  assert.equal(await page.locator('#project-agentcrucible .scene-pointer').evaluate(el => el.style.opacity), '0.75');
  await page.mouse.move(0, 0);
  for (let i = 0; i < 8; i++) {
    await showWheel(page);
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    await page.keyboard.press('Home');
    for (let n = 0; n < i + 1; n++) await page.keyboard.press('ArrowDown');
    await settle(page);
    const active = page.locator('.work-card.is-on');
    assert.equal(await active.locator('svg[role="img"]').count(), 1);
    await illustration(page,active);
    const action = active.locator('[data-scene-action]');
    assert.match(await action.innerText(), /^Replay/);
    await action.click();
    assert.equal(await action.getAttribute('aria-pressed'), 'true');
    assert.match(await action.innerText(), /^Reset/);
    await action.click();
    assert.equal(await action.getAttribute('aria-pressed'), 'false');
    assert.match(await action.innerText(), /^Replay/);
    if (process.env.CRAFT_SHOTS && i < 3) {
      fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, `project-${i}.png`) });
    }
  }
  await page.evaluate(() => SkyStudio.selectSlug('airforge'));
  await settle(page);
  await illustration(page,page.locator('#project-airforge'));
  const replay = page.locator('#project-airforge [data-scene-action]');
  await page.locator('#project-airforge .scene-drawing').click();
  assert.equal(await page.locator('#studio-viewer').evaluate(el => el.open), true);
  assert.equal(await page.locator('.studio-viewer-stage svg').count(), 1);
  assert.equal(await page.locator('#project-airforge .scene-svg').count(), 1);
  assert.equal(await replay.getAttribute('aria-pressed'), 'false');
  await page.locator('[data-studio-viewer-close]').click();
  await page.waitForFunction(() => !document.querySelector('#studio-viewer').open);
  assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-studio-zoom')), 'airforge');
  await replay.click();
  assert.match(await replay.innerText(), /^Reset/);
  assert.equal(await page.locator('#project-airforge [data-scene-status]').innerText(), 'Ball settles on the platform');
  const title = await page.locator('.work-card.is-on .work-card-name').innerText();
  await page.keyboard.press('"');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.SkyStudio.settled()), true);
  assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), title);
  assert.deepEqual(errors, []);
  await context.close();
});

test('desktop, tablet, and mobile retain accessible navigation and the large main avatar', async () => {
  for (const width of [1440, 1024, 768, 600, 390, 360, 304]) {
    const { page, context, errors } = await open({ viewport: { width, height: width === 768 ? 1024 : 900 }, reducedMotion: 'reduce', hasTouch: width <= 600 });
    await page.locator('#figure.is-live').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(overflow <= 0, `${width} overflows by ${overflow}px`);
    const figure = await page.locator('#figure').boundingBox();
    const frame = await page.locator('#about .studio-art-frame').boundingBox();
    for (const edge of ['x', 'y', 'width', 'height']) {
      const expected=frame[edge]+(edge==='width'||edge==='height'?-2:1);
      assert.ok(Math.abs(figure[edge]-expected)<=1, `figure ${edge} leaves the one-pixel frame`);
    }
    const shell = await page.locator('.studio-shell').boundingBox();
    const header = await page.locator('.studio-header').boundingBox();
    const editor = await page.locator('.studio-editor').boundingBox();
    const footer = await page.locator('.studio-status').boundingBox();
    assert.ok(Math.abs(header.height - 78) <= 1, `header is ${header.height}px`);
    assert.ok(Math.abs(footer.height - 46) <= 1, `footer is ${footer.height}px`);
    assert.ok(Math.abs((header.y + header.height) - editor.y) <= 1, 'header and editor are not contiguous');
    assert.ok(Math.abs((editor.y + editor.height) - footer.y) <= 1, 'editor and footer are not contiguous');
    if (width === 1440) {
      assert.ok(Math.abs(shell.width - 1008) <= 1, `shell width ${shell.width}`);
      assert.ok(Math.abs(shell.x - 216) <= 1, `shell x ${shell.x}`);
      assert.ok(Math.abs(editor.height - 579) <= 1, `editor height ${editor.height}`);
    }
    if (width === 768) assert.ok(Math.abs(shell.width - 728) <= 1, `768 shell width ${shell.width}`);
    if (width > 600) {
      const rail = await page.locator('[data-studio-wheel]').boundingBox();
      const pane = await page.locator('.studio-pane').boundingBox();
      assert.ok(Math.abs(rail.width - 230) <= 1, `wheel width ${rail.width}`);
      assert.ok(rail.x + rail.width <= pane.x + 1, 'wheel and editor are columns');
      assert.ok(pane.y < rail.y + rail.height && rail.y < pane.y + pane.height);
      const tile = await page.locator('[data-studio-item].is-active').boundingBox();
      assert.ok(Math.abs(tile.width - 150) <= 1 && Math.abs(tile.height - 94) <= 1, 'the selected tile keeps its measured box');
    } else {
      const picker = page.locator('[data-studio-picker]');
      assert.equal(await picker.getAttribute('aria-expanded'), 'false');
      assert.equal(await page.locator('#about.is-current').isVisible(), true);
      await picker.click();
      assert.equal(await picker.getAttribute('aria-expanded'), 'true');
      const openWheel = await page.locator('[data-studio-wheel]').boundingBox();
      assert.ok(Math.abs(openWheel.y - (editor.y + 27)) <= 1, 'the open wheel starts under the picker');
      assert.ok(Math.abs((openWheel.y + openWheel.height) - (editor.y + editor.height)) <= 1, 'the open wheel fills the editor');
      await page.keyboard.press('Escape');
      assert.equal(await picker.getAttribute('aria-expanded'), 'false');
      assert.equal(await picker.evaluate(el => el === document.activeElement), true);
      assert.equal(await page.locator('#about.is-current').isVisible(), true);
    }
    await showWheel(page);
    await page.locator('[data-studio-pick][aria-selected="true"]').focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await settle(page);
    assert.equal(await page.locator('.work-card.is-on .work-card-name').innerText(), 'AirForge');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'project-airforge');
    const accessibility = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(accessibility.violations.map(v => `${v.id}:${v.nodes.map(n => n.target).join('|')}`), []);
    if (process.env.CRAFT_SHOTS) {
      fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, `full-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('scroll visuals respond to scrolling, then settle, and disable cleanly for reduced motion', async () => {
  const { page, context, errors } = await open();
  assert.equal(await page.locator('[data-scroll-field], .scroll-waypoints, [data-presence]').count(), 0);
  const wheel = await page.locator('[data-studio-wheel]').boundingBox();
  await page.mouse.move(wheel.x + 80, wheel.y + 240);
  await page.mouse.wheel(0, 360);
  await settle(page);
  const position = await page.evaluate(() => SkyStudio.position());
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => SkyStudio.position()), position, 'the wheel must hold its position once it settles');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-motion') === 'reduced');
  assert.equal(await page.locator('[data-studio-pick]').count(), 10);
  assert.equal(await page.locator('[data-studio-panel].is-current').isVisible(), true);
  const before = await page.evaluate(() => SkyStudio.selected());
  await page.locator('[data-studio-pick][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.evaluate(() => SkyStudio.settled()), true, 'reduced motion commits the wheel on the same turn');
  assert.equal(await page.evaluate(() => SkyStudio.selected()), (before + 1) % 10);
  await page.keyboard.press('Tab');
  assert.deepEqual(errors, []);
  await context.close();
});

test('mobile scrolling selects a project naturally and header/contact controls remain usable', async () => {
  const { page, context, errors } = await open({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  await showWheel(page);
  const rail = await page.locator('.studio-wheel-window').boundingBox();
  await page.mouse.move(rail.x + Math.min(150, rail.width / 2), rail.y + 80);
  const beforeSelect = await page.evaluate(() => scrollY);
  await page.mouse.wheel(360, 0);
  await page.waitForFunction(() => window.SkyStudio.selected() > 0);
  assert.equal(await page.locator('[data-studio-pick][aria-selected="true"]').count(), 1);
  assert.equal(await page.evaluate(() => scrollY), beforeSelect);
  await page.keyboard.press('Escape');
  const pane = await page.locator('.studio-pane').boundingBox();
  await page.mouse.move(pane.x + 40, pane.y + 80);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => scrollY), 0, 'the studio document does not scroll');
  assert.match(await page.locator('.studio-header').innerText(), /Aakash/);
  assert.doesNotMatch(await page.locator('.studio-header').innerText(), /Gear|Lights|Back to top/);
  assert.doesNotMatch(await page.locator('.studio-status').innerText(), /2026|Back to top/);
  const slug = await page.evaluate(() => SkyStudio.slug());
  assert.equal(await page.locator('[data-studio-step="1"]').isVisible(), false);
  await showWheel(page);
  await page.locator('[data-studio-pick][aria-selected="true"]').focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await settle(page);
  assert.notEqual(await page.evaluate(() => SkyStudio.slug()), slug, 'the visible picker advances the project');
  assert.equal(await page.locator('[data-studio-picker]').getAttribute('aria-expanded'),'false');
  await page.locator('[data-index-open]').click();
  await page.locator('[data-index-search]').fill('python');
  assert.match(await page.locator('.index-projects [data-index-item]:not([hidden])').innerText(), /Recall/);
  await page.keyboard.press('Escape');
  await page.evaluate(() => SkyStudio.selectSlug('contact'));
  await settle(page);
  assert.equal(await page.locator('#contact a[href^="mailto:"]').getAttribute('href'), 'mailto:hello@aakashdahal.fun');
  assert.deepEqual(errors, []);
  await context.close();
});

test('red and blue avatar controls are direct, vivid, and keep the page black', async () => {
  for (const width of [1440, 304]) {
    const { page, context, errors } = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    for (const [selector, mode, color] of [['[data-gear-toggle]', 'two', '#ff3b30'], ['[data-gear-blue]', 'blue', '#4f9bff']]) {
      await page.locator(selector).click();
      assert.equal(await page.locator('html').getAttribute('data-gear'), mode);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), paper);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--figure-ink').trim()), color);
      assert.equal(await page.locator('.studio-avatar-controls button[aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('.palette-options').count(), 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0);
      const accessibility = await new AxeBuilder({ page }).analyze();
      assert.deepEqual(accessibility.violations.map(v => v.id + ':' + v.nodes.map(n => n.target).join('|')), []);
    }
    await page.locator('[data-gear-blue]').click();
    assert.equal(await page.locator('html').getAttribute('data-gear'), null);
    await page.locator('[data-lamp]').click();
    assert.equal(await page.locator('[data-lamp]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('living drawing responds to input and stops for reduced motion', async () => {
  const { page, context, errors } = await open({ hookHero: true });
  assert.equal(await page.locator('[data-presence]').count(), 0);
  await page.waitForTimeout(250);
  const frames = await page.evaluate(() => window.portraitDraws);
  await page.mouse.move(850, 410);
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.portraitDraws) > frames, 'the about portrait keeps drawing');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => document.documentElement.getAttribute('data-motion') === 'reduced');
  const paused = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => window.portraitDraws), paused, 'reduced motion freezes portrait draws');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-motion'));
  assert.ok(await page.locator('#figure canvas.hero-dots').evaluate(el => el.width) > 0, 'resuming motion keeps the portrait canvas');
  const moving = await page.evaluate(() => window.portraitDraws);
  await page.evaluate(() => SkyStudio.selectSlug('airforge'));
  await page.waitForFunction(() => SkyStudio.slug() === 'airforge' && SkyStudio.settled());
  const away = await page.evaluate(() => window.portraitDraws);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(() => window.portraitDraws), away, 'leaving About freezes portrait draws');
  await page.evaluate(() => SkyStudio.selectSlug('about'));
  await page.waitForFunction(() => SkyStudio.slug() === 'about' && SkyStudio.settled());
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => window.portraitDraws) > Math.max(moving, away), 'returning to About resumes portrait draws');
  const figure = await page.evaluate(() => {
    const node = document.getElementById('figure');
    node.dataset.instance = 'hermes';
    return node.querySelectorAll('canvas').length;
  });
  await page.locator('[data-studio-zoom="about"]').click();
  assert.equal(await page.evaluate(() => {
    const node = document.querySelector('.studio-viewer-stage > #figure');
    return !!(node && node.dataset.instance === 'hermes' && node.classList.contains('is-live'));
  }), true);
  assert.equal(await page.locator('#figure').count(), 1);
  assert.equal(figure, await page.locator('#figure canvas').count());
  await page.locator('[data-studio-viewer-close]').click();
  assert.equal(await page.evaluate(() => document.querySelector('#hero > #figure') && document.getElementById('figure').dataset.instance === 'hermes'), true);
  assert.deepEqual(errors, []);
  await context.close();
});

test('wheel selection follows visible position and a button cancels an unfinished wheel gesture', async () => {
  const { page, context, errors } = await open();
  await page.evaluate(() => {
    window.wheelSamples = [];
    let left = 40;
    const count = document.querySelectorAll('[data-studio-pick]').length;
    function sample() {
      const pos = SkyStudio.position();
      window.wheelSamples.push([pos, SkyStudio.selected(), ((Math.round(pos) % count) + count) % count]);
      if (--left) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const wheel = await page.locator('[data-studio-wheel]').boundingBox();
  await page.mouse.move(wheel.x + 80, wheel.y + 240);
  await page.mouse.wheel(0, 140);
  await settle(page);
  await page.waitForTimeout(350);
  const samples = await page.evaluate(() => window.wheelSamples);
  assert.ok(samples.length > 8, 'the wheel was observed while input changed');
  assert.ok(samples.some(([pos]) => Math.abs(pos - Math.round(pos)) > 0.05), 'capture the wheel while it is between projects');
  assert.ok(samples.every(([pos, selected, rounded]) => rounded === selected && selected === ((Math.round(pos) % 10) + 10) % 10), 'the article must follow the visible card');
  await page.mouse.wheel(0, 150);
  const beforeButton = await page.evaluate(() => Math.round(SkyStudio.position()));
  await page.locator('[data-studio-step="-1"]').click();
  await settle(page);
  const picked = await page.evaluate(() => SkyStudio.selected());
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => SkyStudio.selected()), picked, 'an old wheel timeout cannot replace button input');
  assert.ok(picked <= ((beforeButton % 10) + 10) % 10 + 1, 'previous input reverses the unfinished gesture');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get() { return true; } });
    document.dispatchEvent(new Event('visibilitychange'));
    SkyStudio.select(4);
  });
  assert.equal(await page.evaluate(() => SkyStudio.settled() && SkyStudio.selected() === 4 && SkyStudio.slug() === 'recall-ai'), true);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
    const node = document.querySelector('.studio-wheel-window');
    node.style.position = 'fixed';
    node.style.top = '-5000px';
    SkyStudio.select(6);
  });
  assert.equal(await page.evaluate(() => SkyStudio.settled() && SkyStudio.slug() === 'localpulse'), true);
  assert.deepEqual(errors, []);
  await context.close();
});
