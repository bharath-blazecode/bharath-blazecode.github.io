const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.CLASSQUEST_PORT) || 48766;
const url = `http://127.0.0.1:${port}/work/classquest/`;
const choices = ['before', 'change', 'evidence'];
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

async function assertNoOverflow(page, label) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page overflow`);
  const clipped = await page.locator('#upload-decision button, #upload-decision pre').evaluateAll(elements => elements.filter(element => {
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden' || style.display === 'none') return false;
    const box = element.getBoundingClientRect();
    return box.left < -1 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
  }).map(element => element.textContent.trim()));
  assert.deepEqual(clipped, [], `${label}: clipped decision controls or code`);
}

async function assertSelected(page, selected, label) {
  for (const choice of choices) {
    const active = choice === selected;
    const button = page.locator(`button[data-upload-choice="${choice}"]`);
    const panel = page.locator(`#upload-${choice}`);
    assert.equal(await button.getAttribute('aria-controls'), `upload-${choice}`, `${label}: control target`);
    assert.equal(await button.getAttribute('aria-pressed'), String(active), `${label}: pressed state`);
    assert.equal(await panel.getAttribute('aria-hidden'), String(!active), `${label}: panel accessibility state`);
    assert.equal(await panel.evaluate(element => element.inert), !active, `${label}: inactive panel focus exclusion`);
    assert.equal(await panel.isVisible(), active, `${label}: visible panel`);
  }
  assert.equal(await page.locator('#upload-status').getAttribute('aria-live'), 'polite');
  assert.ok((await page.locator('#upload-status').textContent()).trim().length, `${label}: announced selection`);
  assert.ok(await page.locator('.upload-limits').isVisible(), `${label}: limits remain available`);
}

async function assertSourceLinks(page) {
  // These links expose the actual evidence; this test does not run the ClassQuest application or its tests.
  const links = await page.locator('#upload-decision a').evaluateAll(anchors => anchors.map(anchor => anchor.href));
  assert.ok(links.includes('https://github.com/MikePineda/class-quest/pull/12'), 'Decision links to the real PR');
  const source = 'https://github.com/MikePineda/class-quest/blob/';
  const before = 'dba6cad390425b17c8bdc846d5cd917fe3f1bf26';
  const patch = '27bdcba8be98902e7443c57bf2ade314dac44ce8';
  for (const evidence of [
    `${before}/backend/app/routers/servers.py#L138-L183`,
    `${patch}/backend/app/routers/servers.py#L175-L194`,
    `${patch}/backend/app/routers/servers.py#L22-L30`,
    `${patch}/backend/tests/test_servers.py#L108-L157`,
    `${patch}/docs/security/SECURITY_BASELINE.md#L26-L65`
  ]) assert.ok(links.includes(source + evidence), `Decision retains pinned evidence: ${evidence}`);
}

(async () => {
  let browser;
  let stateScans = 0;
  let fallbackScans = 0;
  try {
    await ready;
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
    });

    for (const width of [320, 390, 820, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const context = await browser.newContext({
          viewport: { width, height: 900 }, colorScheme,
          hasTouch: width <= 820, reducedMotion: 'reduce'
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(url);
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#upload-decision').scrollIntoViewIfNeeded();
        assert.ok(await page.locator('.upload-controls').isVisible(), `${label}: progressive controls`);
        assert.equal(await page.locator('.upload-controls [role="tab"], .upload-controls [role="tablist"]').count(), 0, 'Choices use ordinary buttons');
        const initialHeight = await page.locator('.upload-panels').evaluate(element => element.getBoundingClientRect().height);
        await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
        await assertSourceLinks(page);

        for (const choice of choices) {
          const button = page.locator(`button[data-upload-choice="${choice}"]`);
          const box = await button.boundingBox();
          assert.ok(box && box.height >= 44 && box.width >= 44, `${label}: ${choice} touch target`);
          if (width <= 820) await button.tap();
          else await button.click();
          await assertSelected(page, choice, `${label} ${choice}`);
          const height = await page.locator('.upload-panels').evaluate(element => element.getBoundingClientRect().height);
          if (width > 850) assert.ok(Math.abs(height - initialHeight) <= 1, `${label}: selecting ${choice} shifted desktop panel height`);
          else {
            const activeHeight = await page.locator(`#upload-${choice}`).evaluate(element => element.getBoundingClientRect().height);
            assert.ok(Math.abs(height - activeHeight) <= 1, `${label}: inactive panels must not reserve empty mobile space`);
          }
          await assertNoOverflow(page, `${label} ${choice}`);
          const violations = await page.evaluate(async () => (await axe.run('#upload-decision', {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
          })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
          assert.deepEqual(violations, [], `${label} ${choice}: accessibility checks`);
          stateScans++;
        }

        // Native button behavior: Tab reaches each choice; Enter/Space select without stealing focus.
        const before = page.locator('button[data-upload-choice="before"]');
        const change = page.locator('button[data-upload-choice="change"]');
        const evidence = page.locator('button[data-upload-choice="evidence"]');
        await before.focus();
        await page.keyboard.press('Enter');
        await assertSelected(page, 'before', `${label} Enter`);
        assert.ok(await before.evaluate(element => element === document.activeElement), 'Enter keeps button focus');
        await page.keyboard.press('ArrowRight');
        assert.ok(await before.evaluate(element => element === document.activeElement), 'Ordinary buttons do not invent arrow-key navigation');
        await page.keyboard.press('Tab');
        assert.ok(await change.evaluate(element => element === document.activeElement), 'Tab reaches the next choice');
        const scrollBeforeSpace = await page.evaluate(() => scrollY);
        await page.keyboard.press('Space');
        await assertSelected(page, 'change', `${label} Space`);
        assert.ok(await change.evaluate(element => element === document.activeElement), 'Space keeps button focus');
        assert.equal(await page.evaluate(() => scrollY), scrollBeforeSpace, 'Space selects without scrolling');
        await page.keyboard.press('Tab');
        assert.ok(await evidence.evaluate(element => element === document.activeElement), 'Tab reaches evidence choice');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement.closest('#upload-evidence') !== null), 'Tab reaches active evidence, skipping hidden content');

        // Print must include the entire account even if a different panel was selected on screen.
        await before.click();
        await page.emulateMedia({ media: 'print' });
        assert.ok(await page.locator('.upload-controls').isHidden(), `${label}: controls hidden in print`);
        let previousBottom = -Infinity;
        for (const choice of choices) {
          const panel = page.locator(`#upload-${choice}`);
          assert.ok(await panel.isVisible(), `${label}: ${choice} available in print`);
          const box = await panel.boundingBox();
          assert.ok(box && box.y >= previousBottom - 1, `${label}: print panels must not overlap`);
          previousBottom = box.y + box.height;
        }
        await page.emulateMedia({ media: 'screen' });
        await assertSelected(page, 'before', `${label} return from print`);
        assert.deepEqual(errors, [], `${label}: browser errors`);
        await context.close();

        const fallback = await browser.newContext({
          javaScriptEnabled: false, viewport: { width, height: 900 }, colorScheme
        });
        const nojs = await fallback.newPage();
        await nojs.goto(url);
        assert.ok(await nojs.locator('.upload-controls').isHidden(), `${label}: no-JS controls hidden`);
        assert.equal(await nojs.locator('.upload-controls').getAttribute('hidden'), '', 'Controls begin hidden in source HTML');
        for (const choice of choices) {
          const panel = nojs.locator(`#upload-${choice}`);
          assert.ok(await panel.isVisible(), `${label}: no-JS ${choice} visible`);
          assert.notEqual(await panel.getAttribute('aria-hidden'), 'true', 'No-JS evidence stays accessible');
          assert.equal(await panel.evaluate(element => element.inert), false, 'No-JS evidence links remain usable');
        }
        assert.ok(await nojs.locator('.upload-limits').isVisible(), 'No-JS limits are available');
        await assertSourceLinks(nojs);
        await assertNoOverflow(nojs, `${label} no-JS`);
        fallbackScans++;
        await fallback.close();
      }
    }
    const normalMotion = await browser.newContext({
      viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference'
    });
    const motionPage = await normalMotion.newPage();
    await motionPage.goto(url);
    await motionPage.locator('button[data-upload-choice="change"]').click();
    await motionPage.locator('.footer').scrollIntoViewIfNeeded();
    await motionPage.locator('#upload-decision').scrollIntoViewIfNeeded();
    await assertSelected(motionPage, 'change', 'Viewport re-entry preserves reader choice');
    const movingContent = await motionPage.locator('.upload-panel, .upload-panel *').evaluateAll(elements => elements.filter(element => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' || style.transitionDuration.split(',').some(duration => Number.parseFloat(duration) > 0);
    }).map(element => element.tagName + '.' + element.className));
    assert.deepEqual(movingContent, [], 'Decision content stays still with normal motion preferences');
    await normalMotion.close();
    console.log(`PASS: ${stateScans} ClassQuest state/accessibility scenarios; ${fallbackScans} no-JavaScript and print layouts; touch, native keyboard, focus, stable panel height and pinned evidence links.`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
