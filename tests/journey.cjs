const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.JOURNEY_PORT) || 48775;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'], ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const width of [320, 390, 820, 1180, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        const steps = page.locator('.journey-steps li');
        assert.deepEqual(await steps.locator('strong').allTextContents(), ['Question', 'Investigate', 'Decide', 'Evidence'], `${label}: four ordered steps`);
        for (const step of await steps.all()) assert.ok(await step.isVisible(), `${label}: step is visible`);
        assert.equal(await page.locator('[data-project][aria-expanded="true"]').count(), 0, `${label}: no project selected`);
        assert.equal(await page.locator('[data-experience-target][aria-expanded="true"]').count(), 0, `${label}: no role selected`);
        assert.equal(await page.locator('[data-evidence-journey]').evaluate(el => el.style.getPropertyValue('--journey-progress')), '1', `${label}: reduced-motion path is complete`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no overflow`);
        assert.deepEqual(errors, [], `${label}: page errors`);
        await page.close();
      }
    }

    const motion = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await motion.goto(origin);
    const journey = motion.locator('[data-evidence-journey]');
    const initial = Number(await journey.evaluate(el => el.style.getPropertyValue('--journey-progress')));
    await journey.scrollIntoViewIfNeeded();
    await motion.waitForTimeout(150);
    const progressed = Number(await journey.evaluate(el => el.style.getPropertyValue('--journey-progress')));
    assert.ok(progressed > initial, `native scrolling advances the path (${initial} -> ${progressed})`);
    await motion.evaluate(() => window.scrollTo({ top: document.querySelector('[data-evidence-journey]').offsetTop + 500, behavior: 'instant' }));
    await motion.waitForTimeout(150);
    assert.equal(Number(await journey.evaluate(el => el.style.getPropertyValue('--journey-progress'))), 1, 'path completes as the visitor scrolls');
    const desk = motion.locator('.desk-stage');
    await desk.scrollIntoViewIfNeeded();
    const box = await desk.boundingBox();
    await motion.mouse.move(box.x + box.width * .15, box.y + box.height * .2);
    await motion.waitForFunction(() => document.querySelector('[data-desk-signals]').classList.contains('is-tracking'));
    assert.ok(await motion.locator('[data-desk-signals]').evaluate(el => el.style.getPropertyValue('--signal-x').endsWith('%')), 'pointer positions the signal');
    await motion.mouse.move(0, 0);
    assert.equal(await motion.locator('[data-desk-signals]').evaluate(el => el.classList.contains('is-tracking')), false, 'signal clears on leaving desk');
    await motion.close();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    await touch.goto(origin);
    await touch.locator('.desk-stage').scrollIntoViewIfNeeded();
    const touchBox = await touch.locator('.desk-stage').boundingBox();
    await touch.touchscreen.tap(touchBox.x + 5, touchBox.y + 5);
    assert.equal(await touch.locator('[data-desk-signals]').evaluate(el => el.classList.contains('is-pulsing')), true, 'touch creates a signal');
    await touch.waitForTimeout(900);
    assert.equal(await touch.locator('[data-desk-signals]').evaluate(el => el.classList.contains('is-pulsing')), false, 'touch signal settles');
    await touch.close();

    const nojs = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await nojs.goto(origin);
    assert.equal(await nojs.locator('.journey-steps li:visible').count(), 4, 'all steps remain readable without JavaScript');
    assert.equal(await nojs.locator('.journey-track > span').evaluate(el => getComputedStyle(el).transform), 'matrix(1, 0, 0, 1, 0, 0)', 'the path is complete without JavaScript');
    await nojs.close();

    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await page.goto(origin);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${colorScheme}: accessibility checks`);
      await page.close();
    }
    console.log('PASS: scroll journey, pointer and touch signals, responsive themes, reduced motion, no-JavaScript and accessibility checks.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
