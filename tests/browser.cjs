const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT) || 48764;
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
          assert.equal(await page.locator('#motion-toggle, .motion-toggle').count(), 0, `${route} exposes a motion toggle`);
          assert.equal(await page.evaluate(() => localStorage.getItem('bs-motion')), null, `${route} persists motion state`);
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

    const motionContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference'
    });
    const motionPage = await motionContext.newPage();
    await motionPage.goto(url);
    assert.equal(await motionPage.locator('#motion-toggle, .motion-toggle').count(), 0);
    assert.equal(await motionPage.evaluate(() => localStorage.getItem('bs-motion')), null);

    const roleReel = motionPage.locator('#role-reel');
    await roleReel.scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(
      expected => {
        const item = document.querySelector('#role-reel .role-reel-item');
        return item?.textContent === expected && !item.classList.contains('changed');
      },
      'Blue team · Identity & access · GRC · IT automation · SOC opportunities',
      { timeout: 6500 }
    );
    const settledRole = await roleReel.innerText();
    await delay(750);
    assert.equal(await roleReel.innerText(), settledRole, 'Role reel did not settle');

    await motionPage.locator('#contact').scrollIntoViewIfNeeded();
    await delay(500);
    await roleReel.scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(
      () => document.querySelector('#role-reel .role-reel-item')?.textContent === 'Blue team',
      null,
      { timeout: 2000 }
    );
    await motionPage.waitForFunction(
      () => document.querySelector('#role-reel .role-reel-item')?.textContent === 'Identity & access',
      null,
      { timeout: 2500 }
    );

    await motionPage.goto(url + '/work/homelab/');
    const flow = motionPage.locator('[data-telemetry-flow]');
    await flow.scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(() => document.querySelector('[data-telemetry-flow]')?.classList.contains('is-flowing'));
    const packetTiming = await flow.locator('[data-flow-packet]').evaluateAll(packets => packets.map(packet => {
      const style = getComputedStyle(packet);
      return {
        delay: Number.parseFloat(style.animationDelay) || 0,
        iterations: style.animationIterationCount
      };
    }));
    assert.equal(packetTiming.length, 3);
    assert.ok(packetTiming[0].delay < packetTiming[1].delay && packetTiming[1].delay < packetTiming[2].delay);
    assert.ok(packetTiming.every(packet => packet.iterations === '1'));
    await motionPage.waitForFunction(() => {
      const diagram = document.querySelector('[data-telemetry-flow]');
      return diagram?.classList.contains('is-complete') && !diagram.classList.contains('is-flowing');
    }, null, { timeout: 6500 });

    const trace = motionPage.locator('[data-event-trace]');
    await trace.scrollIntoViewIfNeeded();
    await motionPage.waitForFunction(() => document.querySelector('[data-event-trace]')?.classList.contains('is-playing'));
    assert.ok(await trace.locator('[data-trace-step].is-revealed').count() < 5, 'Trace skipped its bounded reveal');
    await motionPage.waitForFunction(() => {
      const panel = document.querySelector('[data-event-trace]');
      return panel?.classList.contains('is-complete') && panel.querySelectorAll('[data-trace-step].is-revealed').length === 5;
    }, null, { timeout: 5000 });
    await delay(500);
    assert.equal(await trace.locator('[data-trace-step].is-revealed').count(), 5, 'Trace did not remain visible');
    await motionContext.close();

    const backgroundContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference'
    });
    const backgroundPage = await backgroundContext.newPage();
    await backgroundPage.addInitScript(() => {
      window.__testDocumentHidden = true;
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get: () => window.__testDocumentHidden
      });
    });
    await backgroundPage.goto(url + '/work/homelab/#example');
    const backgroundTrace = backgroundPage.locator('[data-event-trace]');
    await backgroundTrace.scrollIntoViewIfNeeded();
    await backgroundPage.waitForFunction(() => (
      getComputedStyle(document.querySelector('[data-trace-step]')).opacity === '0'
    ));
    await backgroundPage.evaluate(() => {
      window.__testDocumentHidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await backgroundPage.waitForFunction(() => (
      document.querySelector('[data-event-trace]')?.classList.contains('is-playing')
    ));
    await backgroundPage.waitForFunction(() => (
      document.querySelectorAll('[data-event-trace] [data-trace-step].is-revealed').length === 5
    ), null, { timeout: 5000 });
    await backgroundContext.close();

    const reducedContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce'
    });
    const reducedPage = await reducedContext.newPage();
    await reducedPage.goto(url);
    assert.equal(
      (await reducedPage.locator('#role-reel').innerText()).trim(),
      'Blue team · Identity & access · GRC · IT automation · SOC opportunities'
    );
    assert.equal(
      await reducedPage.locator('.responder.is-static.is-complete').count(),
      await reducedPage.locator('.responder').count()
    );
    await reducedPage.goto(url + '/work/homelab/');
    assert.ok(await reducedPage.locator('[data-telemetry-flow]').evaluate(element => element.classList.contains('is-static')));
    const reducedPackets = await reducedPage.locator('[data-flow-packet]').evaluateAll(packets => packets.map(packet => {
      const style = getComputedStyle(packet);
      return { animation: style.animationName, display: style.display };
    }));
    assert.ok(reducedPackets.every(packet => packet.animation === 'none' && packet.display === 'none'));
    assert.ok(await reducedPage.locator('[data-event-trace]').evaluate(element => element.classList.contains('is-static')));
    assert.equal(await reducedPage.locator('[data-trace-step].is-revealed').count(), 5);
    await reducedContext.close();

    const tabletContext = await browser.newContext({
      viewport: { width: 768, height: 900 },
      reducedMotion: 'reduce'
    });
    const tabletPage = await tabletContext.newPage();
    await tabletPage.goto(url);
    const tabletBackground = tabletPage.locator('.background-index');
    await tabletBackground.locator(':scope > summary').click();
    await tabletPage.locator('.background-ledger').scrollIntoViewIfNeeded();
    const tabletLedgerBoxes = await tabletPage.locator('.background-ledger > section').evaluateAll(sections => sections.map(section => {
      const rect = section.getBoundingClientRect();
      return { width: rect.width, top: rect.top, bottom: rect.bottom };
    }));
    assert.equal(tabletLedgerBoxes.length, 3);
    assert.ok(tabletLedgerBoxes.every(box => box.width >= 250));
    assert.ok(tabletLedgerBoxes[1].top >= tabletLedgerBoxes[0].bottom - 1);
    assert.ok(tabletLedgerBoxes[2].top >= tabletLedgerBoxes[1].bottom - 1);
    await tabletContext.close();

    const mobileContext = await browser.newContext({
      viewport: { width: 320, height: 900 },
      reducedMotion: 'reduce'
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.goto(url);
    const menu = mobilePage.locator('.mobile-menu');
    const menuSummary = menu.locator(':scope > summary');
    await menuSummary.focus();
    await menuSummary.press('Enter');
    assert.ok(await menu.evaluate(element => element.open));
    await menuSummary.press('Escape');
    assert.equal(await menu.evaluate(element => element.open), false);
    assert.ok(await menuSummary.evaluate(element => element === document.activeElement));

    const offshift = mobilePage.locator('.offshift');
    const offshiftSummary = offshift.locator(':scope > summary');
    await offshiftSummary.focus();
    await offshiftSummary.press('Enter');
    assert.ok(await offshift.evaluate(element => element.open));

    const background = mobilePage.locator('.background-index');
    const backgroundSummary = background.locator(':scope > summary');
    await backgroundSummary.focus();
    await backgroundSummary.press('Enter');
    assert.ok(await background.evaluate(element => element.open));
    await mobilePage.locator('.background-ledger').scrollIntoViewIfNeeded();
    const ledgerBoxes = await mobilePage.locator('.background-ledger > section').evaluateAll(sections => sections.map(section => {
      const rect = section.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));
    assert.equal(ledgerBoxes.length, 3);
    assert.ok(ledgerBoxes.every(box => box.left >= -1 && box.right <= 321));
    assert.ok(ledgerBoxes[1].top >= ledgerBoxes[0].bottom - 1);
    assert.ok(ledgerBoxes[2].top >= ledgerBoxes[1].bottom - 1);

    await mobilePage.goto(url + '/work/homelab/');
    const mobileTrace = mobilePage.locator('[data-event-trace]');
    await mobileTrace.scrollIntoViewIfNeeded();
    const traceBox = await mobileTrace.boundingBox();
    const fourthStepBox = await mobilePage.locator('.example-grid > div:first-child details:nth-of-type(4)').boundingBox();
    assert.ok(traceBox && fourthStepBox && traceBox.y >= fourthStepBox.y + fourthStepBox.height - 1);
    assert.ok(traceBox.x >= -1 && traceBox.x + traceBox.width <= 321);
    assert.equal(await mobilePage.locator('[data-trace-step].is-revealed').count(), 5);
    assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await mobileContext.close();

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
      `PASS: ${scans} browser/accessibility scenarios; persisted theme, bounded and reduced motion, ` +
      'telemetry, trace, mobile keyboard/layout, safe terminal and no-JavaScript paths.'
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
