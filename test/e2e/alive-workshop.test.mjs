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
    const markerCenter = markerBox.y + markerBox.height / 2;
    const selectedCenter = selectedBox.y + selectedBox.height / 2;
    assert.ok(Math.abs(markerCenter - selectedCenter) <= 24, `marker center aligns selected thumbnail center: marker ${markerCenter} vs thumbnail ${selectedCenter}`);

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

    // Drag test on desktop wheel: cancel drag does not jump, drag up 136px selects next project
    const wheel = page.locator('.studio-project-wheel');
    const wheelBox = await wheel.boundingBox();
    assert.ok(wheelBox, 'wheel exists');

    // Reliable drag up 136px -> commits next project (airforge)
    await wheel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y }));
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y - 136 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y - 136 }));
    });
    await lenisIdle(page);
    assert.equal(await page.evaluate(() => window.location.hash), '#project-airforge', 'drag up 136px navigates to next project real hash');
    assert.equal(await page.evaluate(() => window.SkyStudio?.slug?.()), 'airforge', 'airforge slug committed by drag');

    // Cancel drag (small dy <= 35) no jump
    await wheel.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y }));
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y - 12 }));
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y - 12 }));
    });
    assert.equal(await page.evaluate(() => window.location.hash), '#project-airforge', 'canceled small drag does not jump or change hash');

    // Touch on project wheel does not trap page scroll
    const wheelTouchAction = await page.locator('.studio-project-wheel').evaluate(el => getComputedStyle(el).touchAction);
    assert.notEqual(wheelTouchAction, 'none', 'project wheel does not trap touch');

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

    // Verify wheel pose changes: active front tile selects anchor, neighbors recede/rotate
    const airforgePose = await page.locator('#airforge').evaluate(el => ({
      selected: el.getAttribute('aria-selected') === 'true',
      hasClass: el.classList.contains('is-selected'),
      pickY: el.style.getPropertyValue('--pick-y'),
      pickScale: el.style.getPropertyValue('--pick-scale')
    }));
    assert.equal(airforgePose.selected, true, 'airforge is selected');
    assert.equal(airforgePose.hasClass, true, 'airforge has is-selected class');
    assert.equal(airforgePose.pickY, '0px', 'selected front tile has 0px pick-y');

    const neighborPose = await page.locator('#agentcrucible').evaluate(el => ({
      selected: el.getAttribute('aria-selected') === 'true',
      pickY: el.style.getPropertyValue('--pick-y'),
      pickRotate: el.style.getPropertyValue('--pick-rotate')
    }));
    assert.equal(neighborPose.selected, false, 'neighbor is not selected');
    assert.notEqual(neighborPose.pickY, '0px', 'neighbor recedes with non-zero pick-y');

    const evidenceTransform = await page.evaluate(() => {
      const el = document.querySelector('#project-agentcrucible .studio-evidence');
      return el ? getComputedStyle(el).transform : 'none';
    });
    assert.notEqual(evidenceTransform, 'none', 'evidence computed transform not none when partly unselected');

    const panel = page.locator('#project-airforge');
    await panel.waitFor({ state: 'visible', timeout: 5000 });

    const lab = panel.locator('details.studio-lab');
    assert.equal(await lab.count(), 1, 'details.studio-lab exists');
    const isClosedByDefault = !(await lab.evaluate(el => el.open));
    assert.ok(isClosedByDefault, 'details.studio-lab rendered closed by default');
    await lab.locator('summary').click();
    assert.ok(await lab.evaluate(el => el.open), 'details.studio-lab opened after clicking summary');

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

      const picker = page.locator('select[data-studio-project-select]');
      assert.ok(await picker.isVisible(), `picker is visible at width ${width}`);

      for (const slug of PROJECTS) {
        await picker.selectOption(slug);
        await lenisIdle(page);
        assert.equal(await picker.inputValue(), slug, `picker value is ${slug}`);
        assert.equal(await page.evaluate(() => window.location.hash), `#project-${slug}`);
        const article = page.locator(`article#project-${slug}`);
        await article.waitFor({ state: 'visible', timeout: 5000 });
        const box = await article.boundingBox();
        const headerBox = await page.locator('.studio-header').boundingBox();
        const pickerBox = await picker.boundingBox();
        const topBoundary = pickerBox ? pickerBox.y + pickerBox.height : (headerBox ? headerBox.y + headerBox.height : 0);
        assert.ok(box && box.y >= topBoundary - 2, `article#project-${slug} is visible under header/picker (box.y=${box?.y}, topBoundary=${topBoundary})`);
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
