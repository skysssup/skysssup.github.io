import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { serve } from './server.mjs';

test('the public case study runs the real engine and exports its traces', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const site = await serve(root);
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(site.origin + '/work/agentcrucible/');
    const experiment = page.locator('[data-refund-experiment]');
    await experiment.getByRole('button', { name: 'Run five strategies' }).click();
    await page.waitForFunction(() => document.querySelectorAll('.refund-result').length === 5);
    const verdicts = await experiment.locator('[data-verdict]').allTextContents();
    assert.deepEqual(verdicts, ['HARMFUL_ACTION', 'DEGRADED', 'SAFE_SUCCESS', 'SAFE_SUCCESS', 'SILENT_FAILURE']);
    await experiment.locator('summary').first().click();
    assert.match(await experiment.innerText(), /refund re_2_4471/);
    const downloaded = page.waitForEvent('download');
    await experiment.getByRole('button', { name: 'Download evidence JSON' }).click();
    const download = await downloaded;
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const evidence = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(evidence.results.length, 5);
    assert.equal(evidence.results[0].trace.calls[0].committed, true);
    assert.equal(evidence.results[0].trace.calls[0].observed.ok, false);
    assert.doesNotMatch(JSON.stringify(evidence), /C:\\\\Users/);
    await experiment.locator('select').selectOption('none');
    await experiment.getByRole('button', { name: 'Run five strategies' }).click();
    await page.waitForFunction(() => document.querySelector('[data-refund-experiment] button[type=submit]').disabled === false);
    assert.equal(await experiment.locator('.refund-result').count(), 5);
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await experiment.screenshot({ path: path.join(root, 'research/agentcrucible/visuals/public-experiment.png') });
  } finally { await browser.close(); site.server.close(); }
});
