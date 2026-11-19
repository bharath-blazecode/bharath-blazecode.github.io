const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.EXPERIENCE_PORT) || 48769;
const origin = `http://127.0.0.1:${port}`;
const entries = [
  { id: 'experience-research', start: '2026-11', text: 'Dr Gowri Ramachandran' },
  { id: 'experience-tech', start: '2026-10', text: 'Coordinate two Technical Officers' },
  { id: 'experience-engagement', start: '2026-09', text: 'Engagement Coordinator' },
  { id: 'experience-sciencegears', start: '2026-04', text: 'Conditional Access' },
  { id: 'experience-dynamx', start: '2026-04', text: 'Power Platform business system' },
  { id: 'experience-events', start: '2026-03', text: 'up to 40 participants' },
  { id: 'experience-coles', start: '2025-05', text: 'more than 20 team members' }
];
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

async function checkSelected(page, entry, label) {
  for (const item of entries) {
    const selected = item.id === entry.id;
    assert.equal(await page.locator(`[data-experience-target="${item.id}"]`).getAttribute('aria-expanded'), String(selected), `${label}: selected state`);
    assert.equal(await page.locator(`#${item.id}`).isVisible(), selected, `${label}: role visibility`);
  }
  const detail = page.locator(`#${entry.id}`);
  assert.equal(await detail.evaluate(element => element.open), true, `${label}: detail is open`);
  assert.ok((await detail.locator('.role-detail').innerText()).includes(entry.text), `${label}: retained role information`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page overflow`);
}

(async () => {
  let browser;
  let scenarios = 0;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const width of [320, 390, 820, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise(requestAnimationFrame));
        assert.equal(await page.evaluate(() => scrollY), 0, `${label}: initial selection must not scroll the page`);
        assert.equal(await page.locator('[data-experience-path]').isVisible(), true, `${label}: path is visible`);
        const targets = await page.locator('[data-experience-target]').evaluateAll(buttons => buttons.map(button => button.dataset.experienceTarget));
        assert.deepEqual(targets, entries.map(entry => entry.id), `${label}: ordered by start month`);
        assert.deepEqual(await page.locator('[data-experience-target]').evaluateAll(buttons => buttons.map(button => document.getElementById(button.dataset.experienceTarget).dataset.pathStart)), entries.map(entry => entry.start));
        await checkSelected(page, entries[3], `${label}: default selection`);
        if (width <= 600) {
          const geometry = await page.locator('[data-experience-stops]').evaluate(container => {
            const selected = container.querySelector('[aria-expanded="true"]');
            const frame = container.getBoundingClientRect(), button = selected.getBoundingClientRect();
            return { scrollable: container.scrollWidth > container.clientWidth, visible: button.left >= frame.left - 1 && button.right <= frame.right + 1 };
          });
          assert.ok(geometry.scrollable && geometry.visible, `${label}: mobile path keeps the selected role in view`);
          const scroller = page.locator('[data-experience-stops]');
          await scroller.scrollIntoViewIfNeeded();
          await scroller.evaluate(element => { element.scrollLeft = 0; });
          const partial = await scroller.evaluate(container => {
            const frame = container.getBoundingClientRect();
            const button = [...container.querySelectorAll('button')].find(element => {
              const box = element.getBoundingClientRect();
              return box.left < frame.right - 3 && box.right > frame.right + 1;
            });
            if (!button) return null;
            const box = button.getBoundingClientRect();
            return { id: button.dataset.experienceTarget, x: Math.min(box.left + 5, frame.right - 3), y: box.top + 20 };
          });
          assert.ok(partial, `${label}: a partially visible role offers a scroll cue`);
          await page.mouse.click(partial.x, partial.y);
          await page.waitForFunction(id => {
            const frame = document.querySelector('[data-experience-stops]').getBoundingClientRect();
            const button = document.querySelector(`[data-experience-target="${id}"]`).getBoundingClientRect();
            return button.left >= frame.left - 1 && button.right <= frame.right + 1;
          }, partial.id);
          await checkSelected(page, entries.find(entry => entry.id === partial.id), `${label}: partially visible point`);
        }
        for (const entry of entries) {
          const stop = page.locator(`[data-experience-target="${entry.id}"]`);
          assert.equal(await stop.getAttribute('aria-controls'), entry.id, label);
          const bounds = await stop.boundingBox();
          assert.ok(bounds.width >= 44 && bounds.height >= 44, `${label}: usable target for ${entry.id}`);
          await stop.locator('.experience-marker').click();
          await checkSelected(page, entry, `${label} ${entry.id}`);
        }
        const labels = await page.locator('.experience-stop-name').evaluateAll(elements => elements.map(element => element.scrollWidth <= element.clientWidth + 1));
        assert.ok(labels.every(Boolean), `${label}: role names fit their cards`);
        await page.locator('[data-experience-close]').click();
        assert.equal(await page.locator('[data-experience-roles]').isVisible(), false, `${label}: close hides the detail`);
        assert.ok(await page.locator('[data-experience-target="experience-coles"]').evaluate(element => element === document.activeElement), `${label}: close returns focus`);
        const first = page.locator('[data-experience-target="experience-research"]');
        await first.click();
        await first.click();
        assert.equal(await page.locator('[data-experience-roles]').isVisible(), false, `${label}: selecting the active point closes it`);
        assert.deepEqual(errors, [], `${label}: page errors`);
        await context.close();
        scenarios++;
      }
    }

    // With motion enabled, tapping a partially visible point brings it fully
    // into the phone's scroller without moving the page to another section.
    const touch = await browser.newPage({ viewport: { width: 320, height: 900 }, hasTouch: true, reducedMotion: 'no-preference' });
    await touch.goto(origin);
    const touchScroller = touch.locator('[data-experience-stops]');
    await touchScroller.scrollIntoViewIfNeeded();
    await touchScroller.evaluate(element => { element.scrollLeft = 0; });
    const touchPoint = touch.locator('[data-experience-target="experience-tech"]');
    const pointBox = await touchPoint.boundingBox();
    const frameBox = await touchScroller.boundingBox();
    assert.ok(pointBox.x < frameBox.x + frameBox.width && pointBox.x + pointBox.width > frameBox.x + frameBox.width, 'Touch target starts partially visible');
    await touch.touchscreen.tap(pointBox.x + 5, pointBox.y + 20);
    await touch.waitForFunction(() => {
      const frame = document.querySelector('[data-experience-stops]').getBoundingClientRect();
      const point = document.querySelector('[data-experience-target="experience-tech"]').getBoundingClientRect();
      return point.left >= frame.left - 1 && point.right <= frame.right + 1;
    });
    await checkSelected(touch, entries[1], 'touch with motion');
    assert.notEqual(await touchPoint.locator('.experience-marker').evaluate(element => getComputedStyle(element, '::before').transitionDuration), '0s');
    await touch.close();

    const keyboard = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await keyboard.goto(origin);
    const research = keyboard.locator('[data-experience-target="experience-research"]');
    await research.focus();
    await research.press('Enter');
    await checkSelected(keyboard, entries[0], 'keyboard Enter');
    await research.press('Space');
    assert.equal(await keyboard.locator('[data-experience-roles]').isVisible(), false, 'Space closes selected role');
    await research.press('Enter');
    await keyboard.locator('[data-experience-close]').focus();
    await keyboard.keyboard.press('Escape');
    assert.equal(await keyboard.locator('[data-experience-roles]').isVisible(), false, 'Escape closes role');
    assert.ok(await research.evaluate(element => element === document.activeElement), 'Escape restores focus');
    await research.press('Enter');
    await keyboard.locator('#experience-research > summary').click();
    await keyboard.waitForFunction(() => document.querySelector('[data-experience-roles]').hidden);
    assert.equal(await research.getAttribute('aria-expanded'), 'false', 'Closing the original summary updates its point');
    assert.ok(await research.evaluate(element => element === document.activeElement), 'Closing the summary restores focus');
    const reduced = await research.locator('.experience-marker').evaluate(element => getComputedStyle(element, '::before').transitionDuration);
    assert.equal(reduced, '0s', 'Reduced motion disables marker transitions');
    await keyboard.close();

    // Without JavaScript, the original disclosures and their content remain usable.
    const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    const nojs = await fallback.newPage();
    await nojs.goto(origin);
    assert.equal(await nojs.locator('[data-experience-path]').isVisible(), false);
    for (const entry of entries) assert.ok(await nojs.locator(`#${entry.id}`).isVisible(), `${entry.id}: no-JavaScript disclosure`);
    assert.equal(await nojs.locator('#experience-sciencegears').evaluate(element => element.open), true);
    await nojs.locator('#experience-research > summary').click();
    assert.ok((await nojs.locator('#experience-research .role-detail').innerText()).includes(entries[0].text));
    await fallback.close();

    // The beforeprint/afterprint lifecycle shows every role and restores the selected state.
    const print = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await print.goto(origin);
    await print.locator('[data-experience-target="experience-tech"]').click();
    await print.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await print.emulateMedia({ media: 'print' });
    for (const entry of entries) {
      assert.ok(await print.locator(`#${entry.id}`).isVisible(), `${entry.id}: print disclosure`);
      assert.ok(await print.locator(`#${entry.id} .role-detail`).isVisible(), `${entry.id}: print detail`);
    }
    assert.equal(await print.locator('[data-experience-path]').isVisible(), false, 'Print omits controls');
    await print.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await print.emulateMedia({ media: 'screen' });
    await checkSelected(print, entries[1], 'after printing');
    await print.close();

    // Check the expanded path with axe in both themes.
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await page.goto(origin);
      await page.locator('[data-experience-target="experience-research"]').click();
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${colorScheme}: accessibility checks`);
      await page.close();
    }
    console.log(`PASS: ${scenarios} experience-path scenarios; all seven roles, ordering, touch, keyboard, focus, reduced motion, print and no-JavaScript behavior.`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
