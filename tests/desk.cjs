const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.DESK_PORT) || 48774;
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
    for (const width of [320, 390, 820, 1180, 1350, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
        await page.waitForSelector('[data-investigation-desk].has-3d', { timeout: 15000 });
        assert.ok(await page.locator('#intro-title').isVisible(), `${label}: heading`);
        assert.ok(await page.locator('.hero-actions a[href$=".pdf"]').isVisible(), `${label}: résumé link`);
        assert.equal(await page.locator('[data-desk-link]').count(), 4, `${label}: four map links`);
        assert.equal(await page.locator('[data-experience-target][aria-expanded="true"]').count(), 0, `${label}: no preselected role`);
        for (const link of await page.locator('[data-desk-link]').all()) {
          const rect = await link.boundingBox();
          assert.ok(rect.height >= 44 && rect.x >= -1 && rect.x + rect.width <= width + 1, `${label}: usable map link`);
        }
        const shape = await page.locator('[data-desk-canvas]').evaluate(canvas => ({ width: canvas.width, height: canvas.height }));
        assert.ok(shape.width > 100 && shape.height > 50, `${label}: 3D canvas rendered`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
        assert.deepEqual(errors, [], `${label}: page errors`);
        await page.close();
      }
    }

    // Find each real 3D object by moving over the rendered canvas, then click it.
    const objects = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await objects.goto(origin);
    await objects.waitForSelector('[data-investigation-desk].has-3d');
    const coordinates = await objects.locator('[data-desk-canvas]').evaluate(canvas => {
      const bounds = canvas.getBoundingClientRect();
      const found = {};
      for (let y = .1; y < .95; y += .04) for (let x = .08; x < .95; x += .04) {
        canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: bounds.left + bounds.width * x, clientY: bounds.top + bounds.height * y, pointerType: 'mouse' }));
        const selected = document.querySelector('[data-desk-link].is-desk-hovered');
        if (selected && !found[selected.dataset.deskLink]) found[selected.dataset.deskLink] = { x: bounds.left + bounds.width * x, y: bounds.top + bounds.height * y };
      }
      return found;
    });
    assert.deepEqual(Object.keys(coordinates).sort(), ['people', 'projects', 'research', 'security'], 'Each desk object can be targeted');
    await objects.evaluate(() => {
      window.__deskClicks = [];
      document.querySelectorAll('[data-desk-link]').forEach(link => link.addEventListener('click', event => {
        event.preventDefault();
        window.__deskClicks.push(link.dataset.deskLink);
      }, { capture: true }));
    });
    for (const key of ['security', 'research', 'projects', 'people']) {
      await objects.mouse.click(coordinates[key].x, coordinates[key].y);
      assert.equal(await objects.evaluate(() => window.__deskClicks.at(-1)), key, `${key}: object opens its matching link`);
    }
    await objects.close();

    const keyboard = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await keyboard.goto(origin);
    const research = keyboard.locator('[data-desk-link="research"]');
    await research.focus();
    await research.press('Enter');
    assert.equal(await keyboard.locator('[data-experience-target="experience-research"]').getAttribute('aria-expanded'), 'true', 'Research link opens the selected role');
    await keyboard.reload();
    assert.equal(await keyboard.locator('[data-experience-target][aria-expanded="true"]').count(), 0, 'Refreshing starts with no role selected');
    await keyboard.close();

    const fallback = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await fallback.route('**/assets/desk/desk-scene.js', route => route.abort());
    await fallback.goto(origin);
    await fallback.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
    await fallback.waitForTimeout(300);
    assert.equal(await fallback.locator('[data-investigation-desk]').evaluate(element => element.classList.contains('has-3d')), false, 'Failed 3D load leaves fallback');
    assert.ok(await fallback.locator('.desk-stage img').isVisible(), 'Static desk illustration remains visible');
    assert.ok(await fallback.locator('[data-desk-link="security"]').isVisible(), 'Map links survive a failed 3D load');
    await fallback.close();

    const nojs = await browser.newPage({ viewport: { width: 390, height: 900 }, javaScriptEnabled: false, reducedMotion: 'reduce' });
    await nojs.goto(origin);
    assert.ok(await nojs.locator('.desk-stage img').isVisible(), 'Static illustration works without JavaScript');
    assert.equal(await nojs.locator('[data-desk-link]').count(), 4, 'All links work without JavaScript');
    assert.equal(await nojs.locator('[data-desk-link="security"]').getAttribute('href'), 'work/homelab/');
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
    console.log('PASS: 3D objects and map links, mobile and desktop, themes, keyboard, reduced motion, failed WebGL loading, no-JavaScript and accessibility checks.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
