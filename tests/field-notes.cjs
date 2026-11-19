const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.FIELD_NOTES_PORT) || 48772;
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
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}/`);
    assert.ok(await page.locator('#intro-title').isVisible(), 'Opening text is immediately available');
    assert.ok(await page.locator('.hero-actions a[href$=".pdf"]').isVisible(), 'Résumé is immediately available');
    await page.waitForFunction(() => document.querySelector('.hero-responder').dataset.pose === 'point');
    await page.waitForFunction(() => document.querySelector('.hero-sketch').classList.contains('is-drawing'));
    assert.equal(await page.locator('.hero-sketch path').evaluate(element => getComputedStyle(element).animationName), 'hero-ink');
    await page.waitForFunction(() => !document.querySelector('.hero-sketch').classList.contains('is-drawing'));
    assert.equal(await page.locator('.hero-sketch path').evaluate(element => getComputedStyle(element).strokeDashoffset), '0px');
    assert.equal(await page.locator('.hero-responder').getAttribute('data-pose'), 'idle', 'The responder settles after pointing');

    const chapters = ['work', 'experience', 'competitions', 'about', 'contact'];
    for (const [index, id] of chapters.entries()) {
      await page.locator(`#${id}`).evaluate(element => {
        window.scrollTo({ top: element.getBoundingClientRect().top + scrollY - innerHeight * .3, behavior: 'instant' });
      });
      await page.waitForFunction(expected => {
        const stops = [...document.querySelectorAll('.chapter-rail-stop')];
        return stops.findIndex(stop => stop.classList.contains('is-current')) === expected;
      }, index);
      assert.equal(await page.locator('.chapter-rail-stop.is-past').count(), index, `${id}: previous chapters`);
    }
    assert.deepEqual(errors, [], 'Chapter motion does not produce script errors');
    await page.close();

    for (const width of [320, 390, 820, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const reduced = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        await reduced.goto(`http://127.0.0.1:${port}/`);
        const sketch = reduced.locator('.hero-sketch path');
        assert.equal(await sketch.evaluate(element => getComputedStyle(element).animationName), 'none', `${width}px: static underline`);
        assert.equal(await sketch.evaluate(element => getComputedStyle(element).strokeDashoffset), '0px', `${width}px: full underline visible`);
        const sprite = await reduced.locator('.hero-responder').boundingBox();
        assert.ok(sprite && sprite.x < width && sprite.x + sprite.width > 0, `${width}px: responder remains on screen`);
        assert.ok(await reduced.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${width}px: no page overflow`);
        if (width < 1180) assert.equal(await reduced.locator('[data-chapter-rail]').isVisible(), false, `${width}px: no floating rail`);
        await reduced.close();
      }
    }

    const fallback = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
    await fallback.goto(`http://127.0.0.1:${port}/`);
    assert.equal(await fallback.locator('[data-chapter-rail]').isVisible(), false, 'No-JavaScript rail remains hidden');
    assert.ok(await fallback.locator('#intro-title').isVisible());
    assert.equal(await fallback.locator('.hero-sketch path').evaluate(element => getComputedStyle(element).strokeDashoffset), '0px');
    await fallback.locator('#experience-research > summary').click();
    assert.ok(await fallback.locator('#experience-research .role-detail').isVisible(), 'Research remains available without JavaScript');
    await fallback.close();
    console.log('PASS: opening and chapter thread, scrolling, mobile visibility, themes, reduced motion and no-JavaScript fallback.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
