import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECTS = ['agentcrucible', 'airforge', 'shipgate', 'recall-ai', 'spanforge', 'localpulse', 'ghost-notetaker', 'moltdao'];

test('local project labs compute inspectable results and pause with the page', { timeout: 180000 }, async (t) => {
  const site = await serve(root);
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    await t.test('each project exposes a local example with a computed result', async () => {
      const page = await open(browser, site.origin, { width: 1440, height: 900, reduced: true });
      try {
        assert.deepEqual(await page.locator('[data-studio-pick]').evaluateAll(nodes => nodes.map(node => node.id)), PROJECTS);
        const agent = await lab(page, 'agentcrucible');
        assert.match(await agent.locator('.project-lab__banner').innerText(), /Local example/);
        assert.match(await agent.locator('[data-out="status"]').innerText(), /Pass/);
        await agent.locator('[data-field="claimed"]').fill('0');
        await agent.locator('[data-field="response"]').fill('I successfully completed the refund. <script>alert(1)</script>');
        assert.match(await agent.locator('[data-out="status"]').innerText(), /Fail/);
        const reasons = await agent.locator('[data-out="reasons"]').innerText();
        const trace = await agent.locator('[data-out="trace"]').innerText();
        const response = await agent.locator('[data-field="response"]').inputValue();
        assert.match(reasons, /do not equal committed mutations/);
        assert.match(`${trace}\n${response}`, /<script>alert\(1\)<\/script>/);
        assert.equal(await agent.locator('script, img, iframe').count(), 0);

        const ship = await lab(page, 'shipgate');
        await ship.locator('[data-field="diff"]').fill('+ public comment only');
        assert.match(await ship.locator('[data-out="status"]').innerText(), /Allow/);
        assert.equal(await ship.locator('[data-out="matches"] li').count(), 0);
        await ship.locator('[data-field="diff"]').fill('+ AWS_ACCESS_KEY_ID=AKIA1234567890ABCDEF\n+ password = "hunter2"\n+ -----BEGIN PRIVATE KEY-----');
        const blocked = await ship.locator('[data-out="status"]').innerText();
        const matches = await ship.locator('[data-out="matches"]').innerText();
        assert.match(blocked, /Block\. 3 local match/);
        assert.match(matches, /Line 1: AWS access key id/);
        assert.match(matches, /Line 2: password assignment/);
        assert.match(matches, /Line 3: private key block/);
        await ship.locator('[data-field="diff"]').fill('+ AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE');
        assert.match(await ship.locator('[data-out="status"]').innerText(), /Allow/, 'the documented placeholder key is not a finding');

        const air = await lab(page, 'airforge');
        const angle = air.locator('[data-field="angle"]');
        await angle.fill('10');
        const low = await air.locator('[data-geom="ball"]').getAttribute('cy');
        await angle.fill('60');
        const high = await air.locator('[data-geom="ball"]').getAttribute('cy');
        assert.ok(Number(low) - Number(high) > 40, `angle 10 cy ${low} should sit below angle 60 cy ${high}`);
        assert.match(await air.locator('[data-readout="angle"]').innerText(), /60°/);
        assert.equal(await air.locator('[data-out="phase"]').innerText(), 'ramp');
        await air.locator('[data-field="gravity"]').fill('1');
        assert.match(await air.locator('[data-readout="gravity"]').innerText(), /1\.00/);
        assert.ok((await air.getByRole('button', { name: 'Play', exact: true }).boundingBox()).height >= 44);

        const recall = await lab(page, 'recall-ai');
        await recall.locator('[data-field="query"]').fill('graph');
        assert.match(await recall.locator('[data-out="cards"]').innerText(), /Graph BFS/);
        assert.doesNotMatch(await recall.locator('[data-out="cards"]').innerText(), /Binary search/);
        await recall.locator('[data-field="card"]').selectOption('binary-search');
        await recall.getByRole('button', { name: 'Again', exact: true }).click();
        assert.equal(await recall.locator('[data-out="interval"]').innerText(), '0.5 days');
        assert.equal(await recall.locator('[data-out="lapses"]').innerText(), '1');
        await recall.getByRole('button', { name: 'Good', exact: true }).click();
        assert.notEqual(await recall.locator('[data-out="interval"]').innerText(), '0.5 days');
        assert.notEqual(await recall.locator('[data-out="stability"]').innerText(), '1');
        assert.equal(await recall.locator('[data-out="lapses"]').innerText(), '1');

        const span = await lab(page, 'spanforge');
        await span.locator('[data-field="duration"]').fill('80');
        const shortText = await span.locator('[data-out="spans"]').innerText();
        assert.match(shortText, /tool · start 140 ms · 80 ms/);
        assert.match(shortText, /Tool overlaps fetch/);
        await span.locator('[data-field="parallel"]').setChecked(false);
        const queued = await span.locator('[data-out="spans"]').innerText();
        assert.match(queued, /fetch · start 236 ms · 100 ms/);
        assert.match(queued, /Fetch follows tool/);
        await span.locator('[data-field="query"]').fill('finalize');
        assert.equal(await span.locator('[data-out="spans"] li').count(), 2);

        const pulse = await lab(page, 'localpulse');
        await pulse.locator('[data-field="prompt"]').fill('12');
        await pulse.locator('[data-field="completion"]').fill('7');
        assert.match(await pulse.locator('[data-out="calls"]').innerText(), /12 prompt \+ 7 completion = 19/);
        assert.match(await pulse.locator('[data-out="sum"]').innerText(), /939 tokens across 2 example call/);
        await pulse.locator('[data-field="query"]').fill('edited');
        assert.match(await pulse.locator('[data-out="sum"]').innerText(), /^19 tokens across 1 example call/);
        assert.match(await pulse.locator('.project-lab__banner').innerText(), /No price/);

        const ghost = await lab(page, 'ghost-notetaker');
        const payload = '# Standup\nKeep <script>alert(1)</script> & <b>bold</b> literal';
        await ghost.locator('[data-field="markdown"]').fill(payload);
        assert.equal(await ghost.locator('[data-out="preview"]').innerText(), payload);
        assert.equal(await ghost.locator('[data-out="headings"]').innerText(), 'Standup');
        assert.equal(await ghost.locator('[data-out="chars"]').innerText(), String(payload.length));
        assert.equal(await ghost.locator('script').count(), 0);

        const molt = await lab(page, 'moltdao');
        assert.match(await molt.locator('[data-out="tally"]').innerText(), /0 yes, 0 no\. Toy decision: hold/);
        for (let i = 0; i < 4; i++) await molt.getByRole('button', { name: 'Yes', exact: true }).click();
        assert.match(await molt.locator('[data-out="tally"]').innerText(), /4 yes, 0 no\. Toy decision: pass/);
        for (let i = 0; i < 7; i++) await molt.getByRole('button', { name: 'No', exact: true }).click();
        assert.match(await molt.locator('[data-out="tally"]').innerText(), /0 yes, 7 no\. Toy decision: reject/);
        await molt.locator('[data-field="query"]').fill('missing');
        assert.match(await molt.locator('[data-out="tally"]').innerText(), /No example proposal matches/);
        await molt.getByRole('button', { name: 'Clear votes', exact: true }).click();
        await molt.locator('[data-field="query"]').fill('');
        assert.match(await molt.locator('[data-out="tally"]').innerText(), /0 yes, 0 no/);
        assert.deepEqual(await page.evaluate(() => window.__pageErrors), []);
      } finally {
        await page.context().close();
      }
    });

    await t.test('AirForge play holds for pause, a hidden document, reduced motion, examples off, and another project', async () => {
      const page = await open(browser, site.origin, { width: 1440, height: 900, reduced: false });
      try {
        const air = await lab(page, 'airforge');
        await air.getByRole('button', { name: 'Step', exact: true }).click();
        const stepped = Number.parseFloat(await air.locator('[data-out="time"]').innerText());
        assert.ok(Math.abs(stepped - 1 / 120) < 0.002, `one step is ${stepped}s`);
        await air.getByRole('button', { name: 'Reset', exact: true }).click();
        assert.equal(await air.locator('[data-out="time"]').innerText(), '0.000 s');
        await air.locator('[data-field="speed"]').fill('2');
        await air.getByRole('button', { name: 'Play', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#project-airforge [data-out="time"]').textContent !== '0.000 s');
        await page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        const hidden = await air.locator('[data-out="time"]').innerText();
        await frames(page, 8);
        assert.equal(await air.locator('[data-out="time"]').innerText(), hidden, 'a hidden document holds the ramp');
        await page.evaluate(() => {
          delete document.visibilityState;
          delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForFunction(value => document.querySelector('#project-airforge [data-out="time"]').textContent !== value, hidden);

        await page.locator('[data-motion-toggle]').click();
        await page.waitForFunction(() => document.documentElement.getAttribute('data-motion') === 'reduced');
        const reduced = await air.locator('[data-out="time"]').innerText();
        await frames(page, 8);
        assert.equal(await air.locator('[data-out="time"]').innerText(), reduced, 'reduced motion stops the ramp');
        assert.equal(await page.locator('#project-airforge [data-project-lab]').getAttribute('data-motion'), 'reduced');
        await page.locator('[data-motion-toggle]').click();
        await page.waitForFunction(() => !document.documentElement.hasAttribute('data-motion'));

        await air.getByRole('button', { name: 'Play', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#project-airforge [data-action="play"]').getAttribute('aria-pressed') === 'true');
        await page.locator('[data-bench-live]').click();
        const examples = await air.locator('[data-out="time"]').innerText();
        await frames(page, 8);
        assert.equal(await air.locator('[data-out="time"]').innerText(), examples, 'turning examples off holds the ramp');
        await page.locator('[data-bench-live]').click();

        await page.locator('#shipgate').evaluate(el => el.click());
        await page.waitForFunction(() => SkyStudio.slug() === 'shipgate');
        const left = await air.locator('[data-out="time"]').innerText();
        await frames(page, 8);
        assert.equal(await air.locator('[data-out="time"]').innerText(), left, 'leaving AirForge stops its clock');
        assert.equal(await page.evaluate(() => SkyStudio.playing()), false);
        assert.deepEqual(await page.evaluate(() => window.__pageErrors), []);
      } finally {
        await page.context().close();
      }
    });

    await t.test('a 328px content width still computes and does not overflow', async () => {
      const page = await open(browser, site.origin, { width: 356, height: 800, reduced: true });
      try {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `page overflows by ${overflow}px`);
        const pulse = await lab(page, 'localpulse');
        const box = await pulse.boundingBox();
        assert.ok(box.width <= 328, `lab is ${box.width}px wide`);
        await pulse.locator('[data-field="prompt"]').fill('5');
        await pulse.locator('[data-field="completion"]').fill('0');
        assert.match(await pulse.locator('[data-out="sum"]').innerText(), /925 tokens across 2 example call/);
        const angle = (await lab(page, 'airforge')).locator('[data-field="angle"]');
        await angle.focus();
        await page.keyboard.press('ArrowRight');
        assert.notEqual(await angle.inputValue(), '30');
        assert.match(await page.locator('#project-airforge [data-readout="angle"]').innerText(), /31°/);
      } finally {
        await page.context().close();
      }
    });
  } finally {
    await browser.close();
    site.server.close();
  }
});

async function open(browser, origin, options) {
  const context = await browser.newContext({
    viewport: { width: options.width, height: options.height },
    reducedMotion: options.reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1,
    colorScheme: 'dark',
  });
  await context.addInitScript(() => {
    window.__pageErrors = [];
    window.addEventListener('error', event => window.__pageErrors.push(String(event.message)));
  });
  const page = await context.newPage();
  page.on('pageerror', error => page.evaluate(message => window.__pageErrors.push(message), String(error)).catch(() => {}));
  await page.goto(origin + '/#agentcrucible', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('[data-studio].is-ready') && window.SkyProjectLab && window.SkyStudio);
  return page;
}

async function lab(page, slug) {
  if (await page.evaluate(name => window.SkyStudio.slug() !== name, slug)) {
    await page.locator(`#${slug}`).evaluate(el => el.click());
    await page.waitForFunction(name => {
      const panel = document.getElementById('project-' + name);
      return window.SkyStudio.slug() === name && panel.classList.contains('is-shown') && !panel.inert;
    }, slug);
  }
  const root = page.locator(`#project-${slug} [data-project-lab="${slug}"]`);
  const details = page.locator(`#project-${slug} details.studio-lab`);
  if (!await details.evaluate(node => node.open)) await details.locator('summary').evaluate(el => el.click());
  await root.waitFor({ state: 'visible' });
  return root;
}

async function frames(page, count) {
  for (let i = 0; i < count; i++) await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
}
