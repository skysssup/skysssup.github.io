import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = path.join(os.tmpdir(), 'reading-shots');
let browser, site;

before(async () => {
  fs.mkdirSync(shots, { recursive: true });
  site = await serve(root);
  browser = await chromium.launch({ channel: 'chrome' });
});
after(async () => { await browser?.close(); site?.server.close(); });

async function openCase(viewport, slug, reduced) {
  const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(site.origin + '/work/' + slug + '/', { waitUntil: 'networkidle' });
  await page.addStyleTag({ path: path.join(root, 'css/reading.css') });
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  return { context, page, errors };
}

async function textFits(page) {
  return page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('[data-diagram] .node').forEach(node => {
      const rect = node.querySelector('rect').getBBox();
      node.querySelectorAll('text').forEach(text => {
        const box = text.getBBox();
        if (box.width > rect.width - 8 || box.x < rect.x - 1 || box.x + box.width > rect.x + rect.width + 2) {
          bad.push(text.textContent + ' ' + Math.round(box.width) + '/' + Math.round(rect.width));
        }
      });
    });
    return bad;
  });
}

test('diagram stages fit, follow the existing steps, and animate once', async () => {
  const { context, page, errors } = await openCase({ width: 1280, height: 900 }, 'agentcrucible', false);
  await page.locator('[data-diagram] svg .node').first().waitFor();
  await page.locator('[data-diagram]').screenshot({ path: path.join(shots, 'agentcrucible-diagram-1280.png') });
  const labels = await page.evaluate(() => [...document.querySelectorAll('[data-diagram] .node')].map(node => [...node.querySelectorAll('.label')].map(text => text.textContent).join(' ')));
  assert.deepEqual(labels, ['Scenario', 'Agent', 'Fault harness', 'Mock services', 'Grader']);
  assert.deepEqual(await textFits(page), []);
  const row = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('[data-diagram] .node rect')].map(r => r.getBBox());
    return nodes[1].y === nodes[0].y && nodes[1].x > nodes[0].x;
  });
  assert.equal(row, true);
  const steps = await page.locator('.diagram-steps li').allTextContents();
  await page.locator('.diagram-steps li').nth(3).click();
  await page.waitForFunction(() => document.querySelector('[data-diagram]').getAttribute('data-stage') === '3');
  const selected = await page.locator('.diagram-steps li.is-selected').innerText();
  assert.match(selected, /Mock services: record the changes that actually committed after each call/);
  assert.equal(await page.locator('.node.is-selected').getAttribute('aria-label'), steps[3].replace(/\s+/g, ' ').trim());
  const motion = await page.evaluate(() => {
    const edge = document.querySelector('.edge.is-selected.is-play');
    const style = getComputedStyle(edge);
    return { name: style.animationName, count: style.animationIterationCount, timing: style.animationTimingFunction };
  });
  assert.equal(motion.name, 'diagram-route');
  assert.equal(motion.count, '1');
  assert.equal(motion.timing.includes('infinite'), false);
  await page.locator('.node.is-selected').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-diagram]').getAttribute('data-stage'), '4');
  assert.match(await page.locator('.diagram-steps li.is-selected').innerText(), /Grader: checks the committed changes/);
  const prose = await page.locator('.prose p').first().evaluate(el => getComputedStyle(el).maxWidth);
  assert.match(prose, /ch|px/);
  const overflow = await page.evaluate(() => {
    const pre = document.querySelector('pre.term');
    return {
      page: document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      preScrolls: pre.scrollWidth > pre.clientWidth,
      preContained: pre.clientWidth <= pre.parentElement.clientWidth + 1
    };
  });
  assert.equal(overflow.page, true);
  assert.equal(overflow.preContained, true);
  assert.equal(await page.locator('pre.term').evaluate(el => getComputedStyle(el).overflowX), 'auto');
  const links = await page.locator('.toc a').evaluateAll(els => els.map(el => el.getBoundingClientRect().height));
  assert.ok(links.every(h => h >= 44), 'desktop toc targets ' + links.join(','));
  const sticky = await page.locator('.toc').evaluate(el => getComputedStyle(el).position);
  assert.equal(sticky, 'sticky');
  await page.locator('#how').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => document.querySelector('[data-diagram]').classList.contains('is-paused'));
  assert.deepEqual(errors, []);
  await context.close();
});

test('narrow and tablet diagrams stack or wrap without clipping the section index', async () => {
  for (const [name, viewport] of [['tablet', { width: 800, height: 900 }], ['narrow', { width: 390, height: 844 }]]) {
    const { context, page, errors } = await openCase(viewport, 'airforge', false);
    await page.locator('[data-diagram] svg .node').first().waitFor();
    await page.locator('[data-diagram]').screenshot({ path: path.join(shots, 'airforge-diagram-' + name + '.png') });
    await page.locator('.toc').screenshot({ path: path.join(shots, 'airforge-toc-' + name + '.png') });
    assert.deepEqual(await textFits(page), []);
    const stacked = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('[data-diagram] .node rect')].map(r => r.getBBox());
      return nodes[1].y > nodes[0].y + nodes[0].height * 0.5;
    });
    if (name === 'narrow') assert.equal(stacked, true);
    const heights = await page.locator('.toc a').evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().height)));
    assert.ok(heights.every(h => h >= 44), name + ' toc ' + heights.join(','));
    const clipped = await page.locator('.toc a').evaluateAll(els => els.filter(el => el.scrollWidth > el.clientWidth + 1).map(el => el.textContent.trim()));
    assert.deepEqual(clipped, []);
    const sticky = await page.locator('.toc').evaluate(el => getComputedStyle(el).position);
    assert.equal(sticky, 'sticky');
    await page.locator('.toc a').first().focus();
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    });
    assert.equal(focused, true);
    const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
    assert.equal(pageOverflow, true);
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('reduced motion drops the route animation and evidence controls stay tappable', async () => {
  const quiet = await openCase({ width: 1100, height: 800 }, 'agentcrucible', true);
  await quiet.page.locator('.diagram-steps li').nth(1).click();
  await quiet.page.waitForFunction(() => document.querySelector('.edge.is-selected'));
  const animation = await quiet.page.evaluate(() => getComputedStyle(document.querySelector('.edge.is-selected')).animationName);
  assert.equal(animation, 'none');
  assert.deepEqual(quiet.errors, []);
  await quiet.context.close();

  const evidence = await openCase({ width: 390, height: 844 }, 'airforge', false);
  await evidence.page.locator('.fig-ctrl').waitFor();
  await evidence.page.locator('.lead-media').screenshot({ path: path.join(shots, 'ghost-evidence-390.png') });
  const control = await evidence.page.locator('.fig-ctrl').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { w: r.width, h: r.height };
  });
  assert.ok(control.w >= 44 && control.h >= 44, JSON.stringify(control));
  const caption = await evidence.page.locator('.lead-media figcaption .t-small').innerText();
  assert.match(caption, /Quick capture: clipboard text becomes a new note/);
  assert.deepEqual(evidence.errors, []);
  await evidence.context.close();

  const recall = await openCase({ width: 1280, height: 800 }, 'shipgate', false);
  await recall.page.locator('.toc').screenshot({ path: path.join(shots, 'recall-toc-1280.png') });
  assert.equal(await recall.page.locator('[data-diagram] .node').count(), 3);
  assert.equal(await recall.page.locator('[data-diagram]').getAttribute('data-stage'), '0');
  assert.equal(await recall.page.locator('.lead-media').count(), 0);
  assert.match(await recall.page.locator('#problem p').innerText(), /Local-first spaced repetition/);
  assert.deepEqual(recall.errors, []);
  await recall.context.close();
});
