import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROJECTS = ['agentcrucible', 'airforge', 'shipgate'];

let browser, site;

before(async () => {
  site = await serve(root);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

after(async () => {
  await browser?.close();
  site?.server?.close();
});

async function openPage(options = {}) {
  const { url = '/', width = 1440, height = 900, reduced = false, touch = false } = options;
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    hasTouch: !!touch,
    isMobile: !!touch,
    colorScheme: 'dark',
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem('sky-intro', 'seen'); } catch (e) {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(site.origin + url);
  await page.locator('[data-studio].is-ready').waitFor({ timeout: 8000 });
  await page.waitForFunction(
    () => window.SkyStudio && typeof window.SkyStudio.settled === 'function' && window.SkyStudio.settled(),
    null,
    { timeout: 8000 },
  );
  return { context, page, errors };
}

async function lenisIdle(page) {
  let previous = null, quiet = 0;
  for (let sample = 0; sample < 100; sample += 1) {
    const state = await page.evaluate(() => ({
      y: scrollY,
      busy: !window.SkyStudio?.settled() || document.documentElement.classList.contains('lenis-scrolling')
    }));
    quiet = !state.busy && previous !== null && Math.abs(state.y - previous) < 0.5 ? quiet + 1 : 0;
    if (quiet >= 3) return;
    previous = state.y;
    await page.waitForTimeout(50);
  }
  throw new Error('Document scrolling did not settle');
}

async function headerClick(page, hash) {
  const box = await page.locator(`.studio-header a[href="${hash}"]`).boundingBox();
  assert.ok(box && box.y >= 0 && box.y + box.height <= page.viewportSize().height, 'the sticky header link is visible');
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function rowClick(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert.ok(box, `row found for ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

test('desktop 1440x900 work navigation, preview on hover/focus without hash or scroll drift', { timeout: 40000 }, async () => {
  const { context, page, errors } = await openPage({ width: 1440, height: 900 });
  try {
    await headerClick(page, '#work-list');
    await lenisIdle(page);
    assert.match(page.url(), /#work-list/);

    const markerBox = await page.locator('[data-studio-marker]').boundingBox();
    const selectedBox = await page.locator('#agentcrucible').boundingBox();
    assert.ok(markerBox && selectedBox, 'marker and selected row exist');
    assert.ok(Math.abs(markerBox.y - selectedBox.y) <= 2, `marker aligns selected row top: marker ${markerBox?.y} vs row ${selectedBox?.y}`);

    const initialY = await page.evaluate(() => window.scrollY);
    const initialHash = await page.evaluate(() => window.location.hash);
    const initialSlug = await page.evaluate(() => window.SkyStudio?.slug?.() ?? null);

    const airforgeRow = page.locator('[data-studio-pick][href*="airforge"]');
    const airBox = await airforgeRow.boundingBox();
    assert.ok(airBox, 'AirForge row exists');

    // Hover nonselected row
    await page.mouse.move(airBox.x + airBox.width / 2, airBox.y + airBox.height / 2);
    const preview = page.locator('[data-studio-preview]');
    await preview.waitFor({ state: 'visible', timeout: 5000 });
    const previewText = (await preview.textContent()) || '';
    assert.ok(previewText.toLowerCase().includes('airforge'), 'preview contains AirForge');

    // Assert hash, scrollY, slug remain unchanged
    const afterHover = await page.evaluate(() => ({
      y: window.scrollY,
      hash: window.location.hash,
      slug: window.SkyStudio?.slug?.() ?? null
    }));
    assert.equal(afterHover.hash, initialHash, 'hash unchanged on hover');
    assert.equal(afterHover.y, initialY, 'scrollY unchanged on hover');
    assert.equal(afterHover.slug, initialSlug, 'slug unchanged on hover');

    // Pointer leave clears preview
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-studio-preview]');
      return !el || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden' || el.getAttribute('hidden') !== null || el.textContent.trim() === '';
    }, { timeout: 5000 });

    // Focus similarly activates preview
    await airforgeRow.focus();
    await preview.waitFor({ state: 'visible', timeout: 5000 });
    const focusedText = (await preview.textContent()) || '';
    assert.ok(focusedText.toLowerCase().includes('airforge'), 'focus preview contains AirForge');
    assert.equal(errors.length, 0, 'no console errors');
  } finally {
    await context.close();
  }
});

test('navigate AirForge row, lab open, slider changes angle, avatar host unscaled, no errors', { timeout: 40000 }, async () => {
  const { context, page, errors } = await openPage({ width: 1440, height: 900 });
  try {
    await page.evaluate(() => {
      window.__testFigRef = document.getElementById('figure');
    });

    await headerClick(page, '#work-list');
    await lenisIdle(page);

    const initialProgress = await page.evaluate(() => {
      const el = document.querySelector('[data-studio-progress]');
      if (!el) return null;
      const ct = getComputedStyle(el).transform;
      let sy = 0;
      if (ct && ct !== 'none') {
        const m = ct.match(/^matrix\((.+)\)$/);
        if (m) {
          const parts = m[1].split(',').map(s => parseFloat(s.trim()));
          sy = parts[3] ?? 0;
        }
      }
      return { transform: ct, style: el.style.transform, scaleY: sy };
    });

    await rowClick(page, '[data-studio-pick][href*="airforge"]');
    await lenisIdle(page);

    const airProgress = await page.evaluate(() => {
      const el = document.querySelector('[data-studio-progress]');
      if (!el) return null;
      const ct = getComputedStyle(el).transform;
      let sy = 0;
      if (ct && ct !== 'none') {
        const m = ct.match(/^matrix\((.+)\)$/);
        if (m) {
          const parts = m[1].split(',').map(s => parseFloat(s.trim()));
          sy = parts[3] ?? 0;
        }
      }
      return { transform: ct, style: el.style.transform, scaleY: sy };
    });
    assert.ok(airProgress, 'progress span exists');
    assert.notEqual(airProgress.transform, 'none', 'progress span itself transform not none');
    assert.ok(
      airProgress.scaleY > (initialProgress?.scaleY || 0),
      `progress span transform grows navigating to AirForge: ${initialProgress?.scaleY} -> ${airProgress.scaleY}`
    );

    const evidenceTransform = await page.evaluate(() => {
      const el = document.querySelector('#project-agentcrucible .studio-evidence');
      return el ? getComputedStyle(el).transform : 'none';
    });
    assert.notEqual(evidenceTransform, 'none', 'evidence computed transform not none when partly unselected');

    const panel = page.locator('#project-airforge');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    const lab = panel.locator('details.studio-lab');
    assert.equal(await lab.count(), 1, 'details.studio-lab exists');
    const isOpen = await lab.evaluate(el => el.open);
    assert.ok(isOpen, 'details.studio-lab rendered open by default');

    const slider = panel.locator('#pl-airforge-angle');
    assert.equal(await slider.count(), 1, '#pl-airforge-angle exists');
    const output = panel.locator('[data-readout="angle"]');
    assert.equal(await output.count(), 1, '[data-readout="angle"] exists');

    const initialVal = await slider.inputValue();
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    const newVal = await slider.inputValue();
    assert.notEqual(newVal, initialVal, 'slider value updated on arrow key');
    const outText = await output.textContent();
    assert.ok(outText.includes(newVal), 'angle output reflects updated value');

    const handle = panel.getByRole('slider', { name: 'Ramp angle handle' });
    await handle.focus();
    await page.keyboard.press('End');
    assert.equal(await slider.inputValue(), '60');
    assert.equal(await handle.getAttribute('aria-valuenow'), '60');
    await page.keyboard.press('Home');
    assert.equal(await slider.inputValue(), '10');
    assert.equal(await handle.getAttribute('aria-valuetext'), '10 degrees');

    const playBtn = panel.locator('[data-action="play"]');
    const pauseBtn = panel.locator('[data-action="pause"]');
    assert.equal(await playBtn.count(), 1, 'play button exists');
    assert.equal(await pauseBtn.count(), 1, 'pause button exists');
    assert.equal(await playBtn.getAttribute('aria-pressed'), 'false');
    await playBtn.click();
    assert.equal(await playBtn.getAttribute('aria-pressed'), 'true');
    await pauseBtn.click();
    assert.equal(await playBtn.getAttribute('aria-pressed'), 'false');

    const sameFig = await page.evaluate(() => window.__testFigRef === document.getElementById('figure'));
    assert.ok(sameFig, '#figure retains same DOM identity');

    assert.equal(errors.length, 0, 'no console errors');
  } finally {
    await context.close();
  }
});

test('390 and 360 mobile routes reach all projects without overflow and preserve figure transform', { timeout: 50000 }, async () => {
  for (const width of [390, 360]) {
    const { context, page, errors } = await openPage({ width, height: 800, touch: true, reduced: true });
    try {
      const initialFigTransform = await page.evaluate(() => document.getElementById('figure')?.style.transform || '');

      await headerClick(page, '#work-list');
      await lenisIdle(page);

      for (const slug of PROJECTS) {
        await rowClick(page, `[data-studio-pick][href="#project-${slug}"]`);
        await lenisIdle(page);
        assert.equal(await page.evaluate(() => window.location.hash), `#project-${slug}`);
        const article = page.locator(`article#project-${slug}`);
        await article.waitFor({ state: 'visible', timeout: 5000 });
        const box = await article.boundingBox();
        const headerBox = await page.locator('.studio-header').boundingBox();
        const headerBottom = headerBox ? headerBox.y + headerBox.height : 0;
        assert.ok(box && box.y >= headerBottom - 2, `article#project-${slug} is visible under header (box.y=${box?.y}, headerBottom=${headerBottom})`);
      }

      await headerClick(page, '#contact');
      await lenisIdle(page);

      const mail = page.locator('a[href^="mailto:"]');
      await mail.waitFor({ state: 'visible', timeout: 5000 });
      assert.ok(await mail.isVisible(), 'mail link is visible');

      const lamp = page.locator('[data-lamp]');
      await lamp.click();
      const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      assert.equal(theme, 'light', 'html data-theme is light after clicking lamp');

      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      assert.ok(overflowX, `no horizontal overflow at width ${width}`);

      const postScrollFigTransform = await page.evaluate(() => document.getElementById('figure')?.style.transform || '');
      assert.equal(postScrollFigTransform, initialFigTransform, 'figure transform unchanged through scroll');

      assert.equal(errors.length, 0, `no console errors at width ${width}`);
    } finally {
      await context.close();
    }
  }
});
