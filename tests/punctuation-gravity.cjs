const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.GRAVITY_PORT) || 48777;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

async function meanDistance(page, x, y) {
  return page.locator('[data-source-kind]').evaluateAll((elements, point) => elements.reduce((total, element) => {
    const box = element.getBoundingClientRect();
    return total + Math.hypot(box.x + box.width / 2 - point.x, box.y + box.height / 2 - point.y);
  }, 0) / elements.length, { x, y });
}

(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'], ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, colorScheme, reducedMotion: 'no-preference' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      const desk = page.locator('[data-investigation-desk]');
      const box = await desk.boundingBox();
      const originalText = await page.locator('.hero').innerText();
      assert.equal(await page.locator('[data-punctuation-gravity]').count(), 0, `${colorScheme}: no particles at rest`);
      assert.equal(await page.locator('[data-desk-signals] span').count(), 1, `${colorScheme}: old decorative points and dash are gone`);

      const x = box.x - 70;
      const y = box.y + box.height * .5;
      await page.mouse.move(x, y);
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.phase === 'approach');
      await page.waitForTimeout(50);
      const initialDistance = await meanDistance(page, x, y);
      const layer = page.locator('[data-punctuation-gravity]');
      const kinds = await layer.locator('[data-source-kind]').evaluateAll(elements => [...new Set(elements.map(element => element.dataset.sourceKind))]);
      assert.ok(kinds.includes('i') && kinds.includes('punctuation'), `${colorScheme}: copies come from dotted letters and punctuation`);
      assert.ok((await layer.locator('[data-source-kind]').count()) >= 10, `${colorScheme}: visible opening provides multiple sources`);
      assert.equal(await layer.getAttribute('aria-hidden'), 'true', `${colorScheme}: decorative copies stay out of the accessibility tree`);
      assert.equal(await layer.evaluate(element => getComputedStyle(element).pointerEvents), 'none', `${colorScheme}: copies do not intercept input`);
      await page.waitForTimeout(500);
      assert.ok(await meanDistance(page, x, y) < initialDistance * .7, `${colorScheme}: copies move towards the approaching pointer`);

      // The heading is inside the field map but outside the 3D canvas.
      await page.mouse.move(box.x + 10, box.y + 10, { steps: 6 });
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.phase === 'inside');
      const coloursFollowBounds = await layer.evaluate(element => {
        const desk = document.querySelector('[data-investigation-desk]').getBoundingClientRect();
        return [...element.querySelectorAll('[data-source-kind]')].every(dot => {
          const box = dot.getBoundingClientRect();
          const x = box.left + box.width / 2;
          const y = box.top + box.height / 2;
          const inside = x >= desk.left && x <= desk.right && y >= desk.top && y <= desk.bottom;
          return dot.classList.contains('is-in-desk') === inside;
        });
      });
      assert.ok(coloursFollowBounds, `${colorScheme}: each dot changes colour at the map boundary`);
      await page.waitForFunction(() => {
        const layer = document.querySelector('[data-punctuation-gravity]');
        const dots = [...layer.querySelectorAll('[data-source-kind]')];
        return dots.length > 0 && dots.every(dot => dot.classList.contains('is-in-desk'));
      }, null, { timeout: 5000 });
      const color = await layer.locator('[data-source-kind]').first().evaluate(el => getComputedStyle(el).backgroundColor);
      assert.equal(color, 'rgb(220, 230, 78)', `${colorScheme}: dots turn yellow in the map`);
      const cursor = await layer.locator('.gravity-cursor').boundingBox();
      assert.ok(Math.abs(cursor.x + cursor.width / 2 - (box.x + 10)) < 1 && Math.abs(cursor.y + cursor.height / 2 - (box.y + 10)) < 1, `${colorScheme}: central dot follows the pointer`);
      assert.equal(await page.locator('.hero').innerText(), originalText, `${colorScheme}: original text is unchanged`);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${colorScheme}: accessibility checks with particles active`);

      await page.evaluate(() => {
        window.__mapClick = false;
        document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.__mapClick = true;
        }, { capture: true });
      });
      await page.locator('[data-desk-link="projects"]').click();
      assert.equal(await page.evaluate(() => window.__mapClick), true, `${colorScheme}: field-map links remain clickable through the copies`);
      await page.mouse.move(box.x - 30, box.y + box.height * .5);
      assert.equal(await layer.getAttribute('data-phase'), 'return', `${colorScheme}: leaving immediately sends copies home`);
      await page.mouse.move(box.x + 20, box.y + 20);
      assert.equal(await layer.getAttribute('data-phase'), 'inside', `${colorScheme}: re-entering during the return works`);
      await page.mouse.move(box.x - 180, box.y + box.height * .5);
      await page.waitForFunction(() => !document.querySelector('[data-punctuation-gravity]'), null, { timeout: 5000 });
      assert.equal(await page.locator('.hero').innerText(), originalText, `${colorScheme}: text remains intact after copies return`);
      assert.deepEqual(errors, [], `${colorScheme}: no page errors`);
      await page.close();
    }

    for (const width of [820, 1180]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'no-preference' });
      await page.goto(origin, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300); // Let the scroll event finish before moving the pointer.
      const box = await page.locator('[data-investigation-desk]').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('[data-punctuation-gravity]', { timeout: 5000 });
      assert.ok(await page.locator('[data-source-kind]').count() > 0, `${width}px: visible text supplies particles`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px: no horizontal overflow`);
      await page.setViewportSize({ width: width + 5, height: 900 });
      await page.waitForFunction(() => !document.querySelector('[data-punctuation-gravity]'));
      await page.close();
    }

    const preferences = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await preferences.goto(origin, { waitUntil: 'networkidle' });
    await preferences.evaluate(() => document.fonts.ready);
    const box = await preferences.locator('[data-investigation-desk]').boundingBox();
    await preferences.mouse.move(box.x + 50, box.y + 60);
    await preferences.waitForSelector('[data-punctuation-gravity]');
    await preferences.emulateMedia({ reducedMotion: 'reduce' });
    await preferences.waitForFunction(() => !document.querySelector('[data-punctuation-gravity]'));
    await preferences.mouse.move(box.x + 80, box.y + 90);
    assert.equal(await preferences.locator('[data-punctuation-gravity]').count(), 0, 'reduced motion does not start the effect');
    await preferences.emulateMedia({ reducedMotion: 'no-preference' });
    await preferences.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await preferences.mouse.move(box.x + 90, box.y + 100);
    await preferences.waitForSelector('[data-punctuation-gravity]', { timeout: 5000 });
    await preferences.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await preferences.locator('[data-punctuation-gravity]').count(), 0, 'background tabs stop and remove the effect');
    await preferences.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await preferences.mouse.move(box.x + 100, box.y + 110);
    await preferences.waitForSelector('[data-punctuation-gravity]');
    await preferences.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await preferences.waitForFunction(() => !document.querySelector('[data-punctuation-gravity]'));
    await preferences.close();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'no-preference' });
    await touch.goto(origin);
    await touch.locator('.desk-stage').scrollIntoViewIfNeeded();
    const touchBox = await touch.locator('.desk-stage').boundingBox();
    await touch.touchscreen.tap(touchBox.x + 5, touchBox.y + 5);
    assert.equal(await touch.locator('[data-punctuation-gravity]').count(), 0, 'touch does not create mouse-following particles');
    assert.equal(await touch.locator('[data-desk-signals]').evaluate(el => el.classList.contains('is-pulsing')), true, 'existing touch feedback remains');
    await touch.close();

    const nojs = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await nojs.goto(origin);
    assert.ok(await nojs.locator('#intro-title').isVisible(), 'the heading is readable without JavaScript');
    assert.equal(await nojs.locator('[data-desk-link]').count(), 4, 'desk links remain available without JavaScript');
    assert.equal(await nojs.locator('[data-punctuation-gravity]').count(), 0, 'no copies without JavaScript');
    await nojs.close();
    console.log('PASS: real opening-text sources, attraction, colour, return and re-entry, pointer access, themes, reduced motion, touch and no-JavaScript.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
