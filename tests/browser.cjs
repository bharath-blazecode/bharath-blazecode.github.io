const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const root = path.resolve(__dirname, '..');
const port = 48764;
const url = `http://127.0.0.1:${port}`;
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
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
    });

    let scans = 0;
    for (const width of [1440, 320]) {
      for (const colorScheme of ['light', 'dark']) {
        for (const route of ['/', '/work/homelab/', '/work/classquest/', '/work/luna/', '/404.html']) {
          const context = await browser.newContext({
            viewport: { width, height: 900 },
            colorScheme,
            reducedMotion: 'reduce'
          });
          const page = await context.newPage();
          const errors = [];
          page.on('pageerror', error => errors.push(error.message));
          await page.goto(url + route);
          await page.evaluate(() => document.fonts.ready);
          for (const image of await page.locator('img').all()) await image.scrollIntoViewIfNeeded();
          assert.ok(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            `${route} overflows`
          );
          assert.deepEqual(errors, []);
          await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
          const violations = await page.evaluate(async () => (
            await axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
            })
          ).violations.map(violation => ({
            id: violation.id,
            targets: violation.nodes.map(node => node.target)
          })));
          assert.deepEqual(violations, [], `${route} accessibility checks`);
          scans++;
          await context.close();
        }
      }
    }

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url);

    await page.locator('#theme-toggle').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');

    await page.locator('#terminal > summary').click();
    await page.locator('#terminal-input').fill('<img src=x onerror=alert(1)>');
    await page.locator('#terminal-form').evaluate(form => form.requestSubmit());
    assert.equal(await page.locator('#terminal-log img').count(), 0);

    await page.locator('#terminal-input').fill('constructor');
    await page.locator('#terminal-form').evaluate(form => form.requestSubmit());
    assert.match(await page.locator('#terminal-log').innerText(), /Unknown command/);

    await page.locator('#terminal-input').fill('help');
    await page.locator('#terminal-form').evaluate(form => form.requestSubmit());
    assert.match(await page.locator('#terminal-log').innerText(), /whoami/);
    await context.close();

    const motionContext = await browser.newContext({ reducedMotion: 'no-preference' });
    const motionPage = await motionContext.newPage();
    await motionPage.goto(url);
    assert.equal(await motionPage.locator('html').getAttribute('data-motion'), 'running');
    await motionPage.locator('#role-reel').scrollIntoViewIfNeeded();
    const initialRole = await motionPage.locator('#role-reel').innerText();
    await motionPage.waitForFunction(
      role => document.querySelector('#role-reel')?.textContent !== role,
      initialRole,
      { timeout: 5000 }
    );
    await motionPage.locator('#motion-toggle').click();
    assert.equal(await motionPage.locator('html').getAttribute('data-motion'), 'paused');
    await motionPage.reload();
    assert.equal(await motionPage.locator('html').getAttribute('data-motion'), 'paused');
    assert.match(await motionPage.locator('#motion-toggle').innerText(), /Play motion/);
    await motionContext.close();

    const fallback = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 320, height: 900 }
    });
    const nojs = await fallback.newPage();
    await nojs.goto(url);
    assert.equal(await nojs.locator('#theme-toggle').isVisible(), false);
    assert.ok(await nojs.locator('a[href="mailto:barry.sampath@outlook.com"]').count());
    await fallback.close();

    console.log(
      `PASS: ${scans} browser/accessibility scenarios; persisted theme and motion, ` +
      'running motion, safe terminal and no-JavaScript paths.'
    );
  } finally {
    if (browser) {
      // Installed browser channels can occasionally stall while their driver exits on Windows.
      // The assertions have finished at this point, so bound teardown rather than hanging CI.
      await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    }
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
