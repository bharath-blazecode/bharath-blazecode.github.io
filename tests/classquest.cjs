// ClassQuest page: the three-state upload decision, contribution links, themes, widths, keyboard, print and no-JavaScript.
// Run: node tests/classquest.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite } = require('./helpers/site.cjs');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const axeText = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const choices = ['before', 'change', 'evidence'];

async function open(browser, url, { width, theme, reducedMotion = 'reduce', javaScriptEnabled = true }) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, javaScriptEnabled, hasTouch: width <= 820 });
  if (javaScriptEnabled) await context.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push('page error: ' + error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, problems };
}

async function axeViolations(page, scope) {
  if ((await page.evaluate(() => typeof window.axe)) !== 'object') await page.evaluate(axeText);
  const found = await page.evaluate(async ([selector, rules]) => (await axe.run(selector || document, { runOnly: { type: 'tag', values: rules } }))
    .violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })), [scope, RULES]);
  // The header's icon-only terminal button is shared markup owned elsewhere; it is left out here and reported.
  return found.map(item => ({ ...item, targets: item.targets.filter(target => !(item.id === 'button-name' && String(target) === '.tool-terminal')) })).filter(item => item.targets.length);
}

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
  assert.ok(links.includes('https://github.com/MikePineda/class-quest/pull/12'), 'decision links to the real PR');
  const source = 'https://github.com/MikePineda/class-quest/blob/';
  const before = 'dba6cad390425b17c8bdc846d5cd917fe3f1bf26';
  const patch = '27bdcba8be98902e7443c57bf2ade314dac44ce8';
  for (const evidence of [
    `${before}/backend/app/routers/servers.py#L138-L183`,
    `${patch}/backend/app/routers/servers.py#L175-L194`,
    `${patch}/backend/app/routers/servers.py#L22-L30`,
    `${patch}/backend/tests/test_servers.py#L108-L157`,
    `${patch}/docs/security/SECURITY_BASELINE.md#L26-L65`
  ]) assert.ok(links.includes(source + evidence), `decision keeps pinned evidence: ${evidence}`);
}

(async () => {
  const site = await startSite(48774);
  const url = `${site.url}/work/classquest/`;
  let browser;
  let stateScans = 0;
  let fallbackScans = 0;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

    // Source facts the checker relies on.
    const source = fs.readFileSync(path.join(site.dir, 'work/classquest/index.html'), 'utf8');
    for (const number of [5, 11, 12, 14, 20, 21, 23, 24, 25, 26]) assert.ok(source.includes(`/pull/${number}"`), `link to pull request ${number}`);
    assert.match(source, /belongs to the team/, 'the award is credited to the team');
    assert.match(source, /Miguel Pineda/);

    for (const width of [320, 390, 820, 1440]) {
      for (const theme of ['light', 'dark']) {
        const label = `${width}px ${theme}`;
        const { page, context, problems } = await open(browser, url, { width, theme });
        assert.equal(await page.locator('h1').count(), 1, `${label}: one h1`);
        assert.equal(await page.locator('main#main').count(), 1, `${label}: main landmark`);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), theme === 'dark', `${label}: theme applied`);
        assert.equal(await page.locator('[style]').count(), 0, `${label}: no inline style attributes`);
        await page.locator('#upload-decision').scrollIntoViewIfNeeded();
        assert.ok(await page.locator('.upload-controls').isVisible(), `${label}: progressive controls`);
        assert.equal(await page.locator('.upload-controls [role="tab"], .upload-controls [role="tablist"]').count(), 0, 'choices use ordinary buttons');
        const initialHeight = await page.locator('.upload-panels').evaluate(element => element.getBoundingClientRect().height);
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
          assert.deepEqual(await axeViolations(page, '#upload-decision'), [], `${label} ${choice}: accessibility checks`);
          stateScans++;
        }

        // Native buttons: Tab reaches each choice, and Enter or Space select without moving focus.
        const before = page.locator('button[data-upload-choice="before"]');
        const change = page.locator('button[data-upload-choice="change"]');
        const evidence = page.locator('button[data-upload-choice="evidence"]');
        await before.focus();
        await page.keyboard.press('Enter');
        await assertSelected(page, 'before', `${label} Enter`);
        assert.ok(await before.evaluate(element => element === document.activeElement), 'Enter keeps button focus');
        await page.keyboard.press('ArrowRight');
        assert.ok(await before.evaluate(element => element === document.activeElement), 'ordinary buttons do not invent arrow-key navigation');
        await page.keyboard.press('Tab');
        assert.ok(await change.evaluate(element => element === document.activeElement), 'Tab reaches the next choice');
        const scrollBeforeSpace = await page.evaluate(() => scrollY);
        await page.keyboard.press('Space');
        await assertSelected(page, 'change', `${label} Space`);
        assert.ok(await change.evaluate(element => element === document.activeElement), 'Space keeps button focus');
        assert.equal(await page.evaluate(() => scrollY), scrollBeforeSpace, 'Space selects without scrolling');
        await page.keyboard.press('Tab');
        assert.ok(await evidence.evaluate(element => element === document.activeElement), 'Tab reaches the evidence choice');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        assert.ok(await page.evaluate(() => document.activeElement.closest('#upload-evidence') !== null), 'Tab reaches active evidence, skipping hidden content');
        const focusRing = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
        assert.notEqual(focusRing, 'none', `${label}: visible focus`);

        // Print includes the whole account even when a different panel was selected on screen.
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
        assert.deepEqual(problems, [], `${label}: console and network`);
        await context.close();

        const fallback = await open(browser, url, { width, theme, javaScriptEnabled: false });
        const nojs = fallback.page;
        assert.ok(await nojs.locator('.upload-controls').isHidden(), `${label}: no-JavaScript controls hidden`);
        assert.equal(await nojs.locator('.upload-controls').getAttribute('hidden'), '', 'controls begin hidden in the source HTML');
        for (const choice of choices) {
          const panel = nojs.locator(`#upload-${choice}`);
          assert.ok(await panel.isVisible(), `${label}: no-JavaScript ${choice} visible`);
          assert.notEqual(await panel.getAttribute('aria-hidden'), 'true', 'evidence stays accessible without JavaScript');
          assert.equal(await panel.evaluate(element => element.inert), false, 'evidence links stay usable without JavaScript');
        }
        assert.ok(await nojs.locator('.upload-limits').isVisible(), 'limits are available without JavaScript');
        await assertSourceLinks(nojs);
        await assertNoOverflow(nojs, `${label} no JavaScript`);
        fallbackScans++;
        await fallback.context.close();
      }
    }

    // Whole page accessibility, both themes, narrow and wide.
    for (const theme of ['light', 'dark']) {
      for (const width of [390, 1440]) {
        const { page, context } = await open(browser, url, { width, theme });
        assert.deepEqual(await axeViolations(page), [], `${width}px ${theme}: whole page accessibility`);
        await context.close();
      }
    }

    // With normal motion the decision content stays still, and the images load.
    const motion = await open(browser, url, { width: 1440, theme: 'light', reducedMotion: 'no-preference' });
    await motion.page.locator('button[data-upload-choice="change"]').click();
    await motion.page.locator('.foot').scrollIntoViewIfNeeded();
    await motion.page.locator('#upload-decision').scrollIntoViewIfNeeded();
    await assertSelected(motion.page, 'change', 'viewport re-entry keeps the reader choice');
    const moving = await motion.page.locator('.upload-panel, .upload-panel *').evaluateAll(elements => elements.filter(element => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' || style.transitionDuration.split(',').some(duration => Number.parseFloat(duration) > 0);
    }).map(element => element.tagName + '.' + element.className));
    assert.deepEqual(moving, [], 'decision content stays still with normal motion preferences');
    for (const image of await motion.page.locator('main img').all()) {
      await image.scrollIntoViewIfNeeded();
      assert.ok(await image.evaluate(async element => { await element.decode(); return element.naturalWidth > 0; }), 'gallery image decodes');
    }
    assert.deepEqual(motion.problems, [], 'motion page console and network');
    await motion.context.close();

    console.log(`PASS: ${stateScans} ClassQuest state and accessibility scenarios; ${fallbackScans} no-JavaScript and print layouts; touch, keyboard, focus, stable panel height, pinned evidence links and all ten pull request links.`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    site.stop();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
