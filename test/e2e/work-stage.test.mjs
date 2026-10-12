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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + '/#hero');
  await page.locator('#figure.is-live').waitFor();
  await page.locator('#work-list').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.SkyWorkbench && window.SkyWorkbench.settled());
  return { context, page, errors };
}
const settle = page => page.waitForFunction(() => window.SkyWorkbench.settled(), null, { timeout: 3000 });

test('the project wheel settles cleanly through wheel, keys, buttons, and rapid reversals', async () => {
  const { page, context, errors } = await open();
  const orbit = await page.locator('[data-orbit]').boundingBox();
  await page.mouse.move(orbit.x + orbit.width / 2, orbit.y + 230);
  await page.mouse.wheel(0, 140);
  await page.waitForTimeout(180); await settle(page);
  assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'AirForge');
  await page.locator('[data-work-pick="1"]').focus();
  await page.keyboard.press('ArrowDown');
  await settle(page);
  assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'Shipgate');
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  await page.keyboard.press('ArrowUp');
  await settle(page);
  assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'Ghost Notetaker');
  assert.equal(await page.locator('[data-work-pick][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('.work-card:not(.is-on)').evaluateAll(cards => cards.every(c => c.inert)), true);
  await page.locator('.work-card.is-on .scene-links a').first().click();
  await page.waitForURL('**/work/ghost-notetaker/');
  assert.deepEqual(errors, []);
  await context.close();
});

test('wheel boundaries release page scroll and dragging does not trigger an accidental selection', async () => {
  const { page, context, errors } = await open();
  await page.locator('[data-work-pick="0"]').focus();
  await page.keyboard.press('End'); await settle(page);
  const orbit = await page.locator('[data-orbit]').boundingBox();
  await page.mouse.move(orbit.x + 80, orbit.y + 240);
  const initial = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(700);
  assert.ok(await page.evaluate(() => scrollY) > initial + 80, 'the wheel must release scrolling at its final item');
  await page.locator('#work-list').scrollIntoViewIfNeeded();
  await page.locator('[data-work-pick="7"]').focus();
  await page.keyboard.press('Home'); await settle(page);
  const first = await page.locator('[data-work-pick="0"]').boundingBox();
  await page.mouse.move(first.x + 60, first.y + 40);
  await page.mouse.down();
  await page.mouse.move(first.x + 60, first.y - 200, { steps: 15 });
  await page.mouse.up(); await settle(page);
  assert.ok(await page.evaluate(() => window.SkyWorkbench.selected()) >= 2, 'a drag must commit its final position');
  assert.equal(await page.locator('.is-dragging').count(), 0);
  assert.deepEqual(errors, []);
  await context.close();
});

test('each project scene responds, resets on leaving, and stops processing input while idle', async () => {
  const { page, context, errors } = await open({ reducedMotion: 'reduce' });
  for (let i = 0; i < 8; i++) {
    await page.locator('[data-work-pick="0"]').focus();
    await page.keyboard.press('Home');
    for (let n = 0; n < i; n++) await page.keyboard.press('ArrowDown');
    const active = page.locator('.work-card.is-on');
    assert.equal(await active.locator('svg[role="img"]').count(), 1);
    const action = active.locator('[data-scene-action]');
    await action.click();
    assert.equal(await action.getAttribute('aria-pressed'), 'true');
    await action.click();
    assert.equal(await action.getAttribute('aria-pressed'), 'false');
    if (process.env.CRAFT_SHOTS && i < 3) {
      fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, `project-${i}.png`) });
    }
  }
  const title = await page.locator('.work-card.is-on h3').innerText();
  await page.keyboard.press('"');
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.SkyWorkbench.settled()), true);
  assert.equal(await page.locator('.work-card.is-on h3').innerText(), title);
  assert.deepEqual(errors, []);
  await context.close();
});

test('desktop, tablet, and mobile retain accessible navigation and the large main avatar', async () => {
  for (const width of [1440, 1024, 768, 390, 304]) {
    const { page, context, errors } = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: width < 761 });
    await page.locator('#figure.is-live').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width} must not overflow`);
    const figure = await page.locator('#figure').boundingBox();
    assert.ok(figure.width >= Math.min(250, width - 48));
    if (width > 760) {
      const tile = page.locator(".orbit-item.is-active"), card = tile.locator(".project-pick"), link = tile.locator(".orbit-open");
      const slot = await tile.boundingBox(), cardBounds = await card.boundingBox(), linkBounds = await link.boundingBox();
      assert.ok(Math.abs(slot.width - cardBounds.width) < 1, "the open link cannot shrink the card");
      assert.equal(await link.evaluate(el => getComputedStyle(el).position), "absolute");
      assert.ok(linkBounds.x >= cardBounds.x && linkBounds.x + linkBounds.width <= cardBounds.x + cardBounds.width + 1, "the open link belongs inside the card");
    }
    await page.locator('[data-work-pick="0"]').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'AirForge');
    const accessibility = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(accessibility.violations.map(v => `${v.id}:${v.nodes.map(n => n.target).join('|')}`), []);
    if (process.env.CRAFT_SHOTS) {
      fs.mkdirSync(process.env.CRAFT_SHOTS, { recursive: true });
      await page.locator('#hero').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.CRAFT_SHOTS, `full-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('scroll visuals respond to scrolling, then settle, and disable cleanly for reduced motion', async () => {
  const { page, context, errors } = await open();
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, 360);
  await page.waitForFunction(() => window.SkyScrollField.settled(), null, { timeout: 4000 });
  const draws = await page.evaluate(() => window.SkyScrollField.draws());
  await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => window.SkyScrollField.draws()), draws, 'the scroll field must stop when it settles');
  await page.locator('[data-motion-toggle]').click();
  assert.equal(await page.locator('[data-scroll-field]').isVisible(), false);
  await page.keyboard.press('Tab');
  assert.deepEqual(errors, []);
  await context.close();
});

test('mobile scrolling selects a project naturally and header/contact controls remain usable', async () => {
  const { page, context, errors } = await open({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce', hasTouch: true });
  const rail = await page.locator('.orbit-window').boundingBox();
  await page.mouse.move(rail.x + 150, rail.y + 30);
  await page.mouse.wheel(360, 0);
  await page.waitForFunction(() => window.SkyWorkbench.selected() > 0);
  assert.equal(await page.locator('[data-work-pick][aria-pressed="true"]').count(), 1);
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(200);
  assert.ok(await page.evaluate(() => scrollY) > before, 'touch layout must retain native vertical page scrolling');
  assert.doesNotMatch(await page.locator('.site-header').innerText(), /Aakash|Gear|Lights|Index/);
  assert.doesNotMatch(await page.locator('.site-footer').innerText(), /Aakash|2026|Source|Back to top/);
  await page.locator('[data-index-open]').click();
  await page.locator('[data-index-search]').fill('python');
  assert.match(await page.locator('.index-projects [data-index-item]:not([hidden])').innerText(), /Recall/);
  await page.keyboard.press('Escape');
  await page.locator('#contact').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.contact-address').getAttribute('href'), 'mailto:hello@aakashdahal.fun');
  assert.deepEqual(errors, []);
  await context.close();
});

test('red and blue avatar controls are direct, vivid, and keep the page black', async () => {
  for (const width of [1440, 304]) {
    const { page, context, errors } = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const paper = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim());
    for (const [selector, mode, color] of [['[data-gear-toggle]', 'two', '#ff3b30'], ['[data-gear-blue]', 'blue', '#438fff']]) {
      await page.locator(selector).click();
      assert.equal(await page.locator('html').getAttribute('data-gear'), mode);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()), paper);
      assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--figure-ink').trim()), color);
      assert.equal(await page.locator('.avatar-mode[aria-pressed="true"]').count(), 1);
      assert.equal(await page.locator('.palette-options').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
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
  const { page, context, errors } = await open();
  await page.waitForFunction(() => window.SkyPresence && SkyPresence.running());
  const frames = await page.evaluate(() => SkyPresence.frames());
  await page.mouse.move(850, 410);
  await page.waitForTimeout(250);
  assert.ok(await page.evaluate(() => SkyPresence.frames()) > frames);
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => !SkyPresence.running());
  const paused = await page.evaluate(() => SkyPresence.frames());
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => SkyPresence.frames()), paused);
  assert.equal(await page.locator('[data-presence="hero"]').isVisible(), false);
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(() => SkyPresence.running() && SkyPresence.frames() > 0);
  assert.ok(await page.locator('[data-presence="hero"]').evaluate(el => el.width) > 0, "resuming motion must restore the full canvas dimensions");
  assert.deepEqual(errors, []);
  await context.close();
});

test('wheel selection follows visible position and a button cancels an unfinished wheel gesture', async () => {
  const { page, context, errors } = await open();
  await page.evaluate(() => {
    window.wheelSamples = [];
    let left = 40;
    function sample() {
      window.wheelSamples.push([SkyWorkbench.position(), SkyWorkbench.selected()]);
      if (--left) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  const orbit = await page.locator('[data-orbit]').boundingBox();
  await page.mouse.move(orbit.x + 80, orbit.y + 240);
  await page.mouse.wheel(0, 140);
  await settle(page);
  await page.waitForTimeout(350);
  const samples = await page.evaluate(() => window.wheelSamples);
  assert.ok(samples.some(([x]) => x > .1 && x < .9), 'capture the wheel while it is between projects');
  assert.ok(samples.every(([x, selected]) => Math.round(x) === selected), 'the article must follow the visible card');
  await page.mouse.wheel(0, 150);
  await page.locator('[data-orbit-step="-1"]').click();
  const picked = await page.evaluate(() => SkyWorkbench.selected());
  await settle(page);
  assert.equal(await page.evaluate(() => SkyWorkbench.selected()), picked, 'an old wheel timeout cannot replace button input');
  assert.deepEqual(errors, []);
  await context.close();
});
