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
before(async () => {
  site = await serve(root);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
  await context.addInitScript(() => sessionStorage.setItem('sky-intro', 'seen'));
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(site.origin);
  await page.locator('#work-list').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  return { context, page, errors };
}

test('moving through the list never changes row positions, and details remain clickable', async () => {
  const { context, page, errors } = await open();
  const rows = page.locator('.home-work > li');
  const before = await rows.evaluateAll(items => items.map(item => {
    const box = item.getBoundingClientRect(); return [box.top, box.height];
  }));
  for (const i of [2, 6, 1, 5, 3]) {
    const box = await rows.nth(i).boundingBox();
    await page.mouse.move(box.x + 150, box.y + box.height / 2);
    await page.waitForTimeout(220);
    assert.equal(await page.locator('.home-work a.is-active .name').innerText(), await rows.nth(i).locator('.name').innerText());
    const after = await rows.evaluateAll(items => items.map(item => {
      const box = item.getBoundingClientRect(); return [box.top, box.height];
    }));
    assert.deepEqual(after, before, 'hover must not reflow or move hit areas');
  }
  const selected = await page.locator('.work-card.is-on h3').innerText();
  await page.locator('.work-card.is-on a').hover();
  assert.equal(await page.locator('.work-card.is-on h3').innerText(), selected, 'leaving the list must not hide details');
  if (process.env.WORK_SHOTS) {
    fs.mkdirSync(process.env.WORK_SHOTS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.WORK_SHOTS, 'work-desktop.png') });
  }
  assert.equal(await page.locator('.work-card[inert] a').evaluateAll(items => items.every(item => item.closest('article').inert)), true);
  assert.deepEqual(errors, []);
  await page.locator('.work-card.is-on a').click();
  await page.waitForURL('**/work/recall-ai/');
  await context.close();
});

test('wheel scrolling updates selection and reaches contact without a scroll trap', async () => {
  const { context, page } = await open();
  await page.mouse.move(1200, 480);
  const first = await page.locator('.home-work a.is-active .name').innerText();
  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(700);
  // Read both labels in one frame while smooth scrolling is still settling.
  const [next, detail] = await page.evaluate(() => [
    document.querySelector('.home-work a.is-active .name').innerText,
    document.querySelector('.work-card.is-on h3').innerText
  ]);
  assert.notEqual(next, first);
  assert.equal(detail, next);
  await page.mouse.wheel(0, 1400);
  await page.waitForTimeout(700);
  const contact = await page.locator('#contact').boundingBox();
  assert.ok(contact.y < 900 && contact.y + contact.height > 0, 'wheel must leave the list normally');
  assert.equal((await page.locator('[data-contact-note]').innerText()).replace(/\s+/g, ' '), 'Email reaches me fastest.');
  await context.close();
});

test('keyboard and reduced motion keep details usable on desktop and mobile', async () => {
  for (const width of [1440, 390]) {
    const { context, page, errors } = await open({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const link = page.locator('[data-work-link]').first();
    await link.focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'AirForge');
    await page.keyboard.press('End');
    assert.equal(await page.locator('.work-card.is-on h3').innerText(), 'MoltDAO');
    assert.equal(await page.locator('.work-tilt').last().evaluate(el => getComputedStyle(el).transform), 'none');
    const stageHeight = await page.locator('.work-stage-body').evaluate(el => el.getBoundingClientRect().height);
    await page.keyboard.press('Home');
    assert.equal(await page.locator('.work-stage-body').evaluate(el => el.getBoundingClientRect().height), stageHeight, 'detail changes must not shift the mobile layout');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    const result = await new AxeBuilder({ page }).include('#work-list').analyze();
    assert.deepEqual(result.violations.map(v => v.id), []);
    if (process.env.WORK_SHOTS) {
      fs.mkdirSync(process.env.WORK_SHOTS, { recursive: true });
      await page.locator('.work-card.is-on').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(process.env.WORK_SHOTS, `work-${width}-reduced.png`) });
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});
