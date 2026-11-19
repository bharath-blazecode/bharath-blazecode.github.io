const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.RESPONDER_TRAY_PORT) || 48776;
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
    for (const width of [320, 390, 820, 1100, 1101, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        const tray = page.locator('[data-tray-details]');
        const summary = tray.locator('summary');
        assert.equal(await tray.evaluate(el => el.open), false, `${label}: index starts closed`);
        assert.equal(await page.locator('[data-case-guide]').isVisible(), false, `${label}: no guide before selection`);
        await summary.click();
        assert.equal(await tray.evaluate(el => el.open), true, `${label}: index opens`);
        assert.deepEqual(await tray.locator('nav a').evaluateAll(links => links.map(link => link.getAttribute('href'))), ['#work', '#experience', '#contact', 'resume/Barry_Sampath_Resume.pdf'], `${label}: index routes`);
        for (const control of await tray.locator('summary, nav a, button').all()) {
          const box = await control.boundingBox();
          assert.ok(box && box.height >= 44 && box.width >= 44, `${label}: accessible control size`);
          assert.ok(box.x >= -1 && box.x + box.width <= width + 1, `${label}: control fits viewport`);
        }
        await page.locator('[data-tray-close]').click();
        assert.equal(await tray.evaluate(el => el.open), false, `${label}: close button`);
        assert.ok(await summary.evaluate(el => el === document.activeElement), `${label}: focus returns to index`);
        assert.equal(await page.locator('[data-tray-shards]').evaluate(el => el.classList.contains('is-shattering')), false, `${label}: no reduced-motion fragments`);
        for (const [id, expected] of [['project-lab', /signal.*evidence/], ['project-quest', /team build/], ['project-luna', /Zhirui Lu/]]) {
          await page.locator(`[data-project="${id}"]`).click();
          assert.ok(await page.locator('[data-case-guide]').isVisible(), `${label}: guide appears for ${id}`);
          assert.match(await page.locator('[data-guide-message]').textContent(), expected, `${label}: project-specific cue`);
          assert.equal(await page.locator('.case-guide-avatar').evaluate(el => getComputedStyle(el).animationName), 'none', `${label}: guide stays still for reduced motion`);
        }
        await page.locator('[data-project-close]').click();
        assert.equal(await page.locator('[data-case-guide]').isVisible(), false, `${label}: guide closes with project`);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no overflow`);
        assert.deepEqual(errors, [], `${label}: no page errors`);
        await page.close();
      }
    }

    const motion = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await motion.goto(origin);
    const summary = motion.locator('[data-tray-details] summary');
    await summary.focus();
    await summary.press('Enter');
    assert.equal(await motion.locator('[data-tray-details]').evaluate(el => el.open), true, 'keyboard opens index');
    await motion.keyboard.press('Escape');
    assert.equal(await motion.locator('[data-tray-details]').evaluate(el => el.open), false, 'Escape closes index');
    assert.ok(await summary.evaluate(el => el === document.activeElement), 'Escape restores focus');
    assert.equal(await motion.locator('[data-tray-shards]').evaluate(el => el.classList.contains('is-shattering')), true, 'closing animates fragments');
    await summary.press('Enter');
    assert.equal(await motion.locator('[data-tray-shards]').evaluate(el => el.classList.contains('is-shattering')), false, 'reopening clears fragments');
    await motion.locator('[data-tray-close]').click();
    await motion.waitForTimeout(1200);
    assert.equal(await motion.locator('[data-tray-shards]').evaluate(el => el.classList.contains('is-shattering')), false, 'fragments settle');
    await motion.locator('[data-project="project-lab"]').click();
    assert.equal(await motion.locator('.case-guide-avatar').evaluate(el => el.classList.contains('is-gesturing')), true, 'selecting a project starts a gesture');
    await motion.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await motion.locator('.case-guide-avatar').evaluate(el => el.classList.contains('is-gesturing')), false, 'gesture stops in a background tab');
    await motion.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await motion.locator('[data-project="project-quest"]').click();
    assert.equal(await motion.locator('.case-guide-avatar').evaluate(el => el.classList.contains('is-gesturing')), true, 'switching project starts a new gesture');
    await motion.waitForTimeout(1300);
    assert.equal(await motion.locator('.case-guide-avatar').evaluate(el => el.classList.contains('is-gesturing')), false, 'gesture settles');
    await motion.locator('[data-project="project-quest"]').click();
    assert.equal(await motion.locator('[data-case-guide]').isVisible(), false, 'reselecting project closes guide');
    await motion.close();

    const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await touch.goto(origin);
    await touch.locator('[data-tray-details] summary').tap();
    assert.equal(await touch.locator('[data-tray-details]').evaluate(el => el.open), true, 'touch opens the index');
    await touch.locator('[data-tray-close]').tap();
    assert.equal(await touch.locator('[data-tray-details]').evaluate(el => el.open), false, 'touch closes the index');
    await touch.locator('[data-project="project-luna"]').tap();
    assert.match(await touch.locator('[data-guide-message]').textContent(), /Zhirui Lu/, 'touch opens the matching project guide');
    await touch.close();

    const shortScreen = await browser.newPage({ viewport: { width: 1200, height: 320 }, reducedMotion: 'reduce' });
    await shortScreen.goto(origin);
    await shortScreen.locator('[data-tray-details] summary').click();
    const panelBox = await shortScreen.locator('.field-tray-panel').boundingBox();
    assert.ok(panelBox.y + panelBox.height <= 320, 'the fixed index fits a short desktop viewport');
    await shortScreen.locator('[data-tray-close]').click();
    assert.equal(await shortScreen.locator('[data-tray-details]').evaluate(el => el.open), false, 'the close control remains reachable on a short screen');
    await shortScreen.close();

    const nojs = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await nojs.goto(origin);
    const native = nojs.locator('[data-tray-details]');
    await native.locator('summary').focus();
    await native.locator('summary').press('Enter');
    assert.equal(await native.evaluate(el => el.open), true, 'native index opens without JavaScript');
    assert.equal(await native.locator('nav a:visible').count(), 4, 'native index links remain available');
    assert.equal(await nojs.locator('[data-tray-close]').isVisible(), false, 'script-only close button is hidden');
    await native.locator('summary').press('Enter');
    assert.equal(await native.evaluate(el => el.open), false, 'native index closes without JavaScript');
    assert.equal(await nojs.locator('[data-project-details] > .project:visible').count(), 3, 'all project summaries remain available without JavaScript');
    await nojs.close();

    for (const colorScheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 900 }, colorScheme, reducedMotion: 'reduce' });
      await page.goto(origin);
      await page.locator('[data-tray-details] summary').click();
      await page.locator('[data-project="project-lab"]').click();
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${colorScheme}: expanded accessibility checks`);
      await page.close();
    }
    console.log('PASS: project guide, responsive quick index, keyboard, bounded motion, reduced motion, no-JavaScript and accessibility checks.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
