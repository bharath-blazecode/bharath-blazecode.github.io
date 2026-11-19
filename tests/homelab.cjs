const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.HOMELAB_PORT) || 48773;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const width of [320, 390, 820, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${origin}/work/homelab/`);
        const notebook = page.locator('[data-lab-notebook]');
        const first = page.locator('#notebook-collection');
        const second = page.locator('#notebook-storage');
        const previous = page.locator('[data-notebook-previous]');
        const next = page.locator('[data-notebook-next]');
        assert.equal(await first.isVisible(), true, `${label}: first note`);
        assert.equal(await second.isVisible(), false, `${label}: second note initially hidden`);
        assert.equal(await previous.getAttribute('aria-disabled'), 'true', `${label}: first-page boundary`);
        assert.equal(await next.getAttribute('aria-disabled'), 'false', `${label}: next note available`);
        const image = first.locator('img');
        await image.scrollIntoViewIfNeeded();
        assert.ok(await image.evaluate(async element => { await element.decode(); return element.naturalWidth > 0; }), `${label}: original dashboard image`);
        const originalLink = first.locator('a');
        assert.equal(await originalLink.getAttribute('href'), await image.getAttribute('src'), `${label}: image link opens the original`);
        assert.ok((await page.request.get(new URL(await originalLink.getAttribute('href'), page.url()).href)).ok(), `${label}: original image resolves`);
        await next.click();
        assert.equal(await first.isVisible(), false, `${label}: first note closes`);
        assert.equal(await second.isVisible(), true, `${label}: second note opens`);
        assert.match(await page.locator('[data-notebook-status]').textContent(), /Note 2 of 2: Indexer storage fault/);
        assert.equal(await next.getAttribute('aria-disabled'), 'true', `${label}: last-page boundary`);
        await next.press('Enter');
        assert.equal(await second.isVisible(), true, `${label}: cannot advance beyond the final note`);
        assert.ok(await next.evaluate(element => element === document.activeElement), `${label}: focus stays on the control`);
        await previous.focus();
        await previous.press('Enter');
        assert.equal(await first.isVisible(), true, `${label}: keyboard returns to first note`);
        assert.match(await notebook.innerText(), /not a recorded incident/);

        for (const stage of ['observe', 'consider', 'interpret', 'ask']) {
          const link = page.locator(`[data-guide="${stage}"]`);
          assert.ok((await link.boundingBox()).height >= 44, `${label}: stage link is touch-sized`);
          await link.click();
          assert.equal(await page.locator(`#example-${stage}`).evaluate(element => element.open), true, `${label}: ${stage} opens`);
          assert.notEqual(await link.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', `${label}: ${stage} highlights`);
        }
        assert.equal(await page.locator('.investigation-arrow path').first().evaluate(element => getComputedStyle(element).animationName), 'none', `${label}: reduced motion`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
        assert.deepEqual(errors, [], `${label}: page errors`);
        await page.close();
      }
    }

    const motion = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await motion.goto(`${origin}/work/homelab/`);
    await motion.locator('[data-notebook-next]').click();
    assert.equal(await motion.locator('#notebook-storage').evaluate(element => getComputedStyle(element).animationName), 'notebook-next', 'Next note turns in');
    await motion.locator('[data-notebook-previous]').click();
    assert.equal(await motion.locator('#notebook-collection').evaluate(element => getComputedStyle(element).animationName), 'notebook-previous', 'Previous note turns back');
    await motion.locator('[data-investigation-flow]').scrollIntoViewIfNeeded();
    await motion.waitForFunction(() => document.querySelector('[data-investigation-flow]').classList.contains('is-drawing'));
    assert.equal(await motion.locator('.investigation-arrow path').first().evaluate(element => getComputedStyle(element).animationName), 'investigation-draw');
    await motion.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await motion.locator('[data-investigation-flow]').evaluate(element => element.classList.contains('is-drawing')), false, 'Drawing stops in a background tab');
    assert.equal(await motion.locator('#notebook-collection').evaluate(element => getComputedStyle(element).animationPlayState), 'paused', 'Page turn pauses in a background tab');
    await motion.close();

    const fallback = await browser.newPage({ viewport: { width: 390, height: 900 }, javaScriptEnabled: false, reducedMotion: 'reduce' });
    await fallback.goto(`${origin}/work/homelab/`);
    assert.equal(await fallback.locator('[data-notebook-controls]').isVisible(), false, 'No-JavaScript controls stay hidden');
    assert.ok(await fallback.locator('#notebook-collection').isVisible());
    assert.ok(await fallback.locator('#notebook-storage').isVisible(), 'Both notes remain readable without JavaScript');
    await fallback.locator('[data-guide="consider"]').click();
    await fallback.locator('#example-consider > summary').click();
    assert.ok(await fallback.locator('#example-consider').evaluate(element => element.open), 'Stage links still reach usable disclosures without JavaScript');
    await fallback.close();

    const print = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await print.goto(`${origin}/work/homelab/`);
    await print.emulateMedia({ media: 'print' });
    assert.ok(await print.locator('#notebook-collection').isVisible());
    assert.ok(await print.locator('#notebook-storage').isVisible(), 'Print includes both notes');
    assert.equal(await print.locator('[data-notebook-controls]').isVisible(), false);
    await print.close();

    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await page.goto(`${origin}/work/homelab/`);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      for (const note of [1, 2]) {
        if (note === 2) await page.locator('[data-notebook-next]').click();
        const violations = await page.evaluate(async () => (await axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
        })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
        assert.deepEqual(violations, [], `${colorScheme}: note ${note} accessibility`);
      }
      await page.close();
    }
    console.log('PASS: notebook pages, original image, investigation stages, mobile, themes, keyboard, reduced motion, no-JavaScript, print and accessibility checks.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
