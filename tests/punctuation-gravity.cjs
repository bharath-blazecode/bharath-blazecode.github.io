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

async function startAtDesk(page) {
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const box = await page.locator('[data-investigation-desk]').boundingBox();
  await page.mouse.move(box.x + box.width * .35, box.y + box.height * .4);
  await page.waitForSelector('[data-punctuation-gravity]');
  return box;
}

async function monitorPoint(page) {
  await page.waitForSelector('[data-investigation-desk].has-3d');
  await page.waitForTimeout(1900); // Let the illustrated desk finish its entrance.
  return page.locator('[data-desk-canvas]').evaluate(canvas => {
    const bounds = canvas.getBoundingClientRect();
    const points = [];
    for (let y = .08; y < .9; y += .035) for (let x = .08; x < .92; x += .035) {
      const point = { x: bounds.left + bounds.width * x, y: bounds.top + bounds.height * y };
      canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: point.x, clientY: point.y, pointerType: 'mouse' }));
      if (document.querySelector('[data-desk-link="security"].is-desk-hovered')) points.push(point);
    }
    if (!points.length) return null;
    const centre = points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
    return points.sort((a, b) => Math.hypot(a.x - centre.x, a.y - centre.y) - Math.hypot(b.x - centre.x, b.y - centre.y))[0];
  });
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
          // CSS transforms are rounded to tenths of a pixel when rendered.
          if ([desk.left, desk.right].some(edge => Math.abs(x - edge) < .2) ||
              [desk.top, desk.bottom].some(edge => Math.abs(y - edge) < .2)) return true;
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
      assert.equal(await layer.locator('[data-liquid-surface]').getAttribute('filter'), 'url(#field-map-liquid)', `${colorScheme}: droplets blend together`);
      await page.waitForFunction(() => {
        const layer = document.querySelector('[data-punctuation-gravity]');
        if (layer?.dataset.liquid !== 'fused') return false;
        const box = layer.querySelector('[data-liquid-surface]').getBBox();
        return box.width <= 14 && box.height <= 14;
      }, null, { timeout: 6000 });
      const core = await layer.locator('.liquid-core').evaluate(el => ({ width: el.getBBox().width }));
      assert.ok(core.width >= 10 && core.width <= 12, `${colorScheme}: fused drop stays compact`);
      await page.mouse.move(box.x + box.width * .65, box.y + box.height * .55);
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.liquid === 'splitting');
      await page.waitForFunction(() => {
        const box = document.querySelector('[data-liquid-surface]').getBBox();
        return box.width > 20 || box.height > 20;
      });
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.liquid === 'fused', null, { timeout: 6000 });
      await page.evaluate(({ x, y }) => {
        for (let step = 1; step <= 8; step++) {
          const target = document.elementFromPoint(x + step * 3, y);
          target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerType: 'mouse', clientX: x + step * 3, clientY: y }));
        }
      }, { x: box.x + box.width * .65, y: box.y + box.height * .55 });
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.liquid === 'splitting');
      await page.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.liquid === 'fused', null, { timeout: 6000 });
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const violations = await page.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${colorScheme}: accessibility checks with particles active`);

      await page.mouse.move(box.x - 30, box.y + box.height * .5);
      assert.equal(await layer.getAttribute('data-phase'), 'return', `${colorScheme}: leaving immediately sends copies home`);
      await page.mouse.move(box.x + 20, box.y + 20);
      assert.equal(await layer.getAttribute('data-phase'), 'inside', `${colorScheme}: re-entering during the return works`);
      await page.mouse.move(box.x - 180, box.y + box.height * .5);
      await page.waitForFunction(() => !document.querySelector('[data-punctuation-gravity]'), null, { timeout: 5000 });
      assert.equal(await page.locator('.hero').innerText(), originalText, `${colorScheme}: text remains intact after copies return`);
      await page.mouse.move(box.x + 20, box.y + 20);
      await page.waitForSelector('[data-punctuation-gravity]');
      await page.evaluate(() => {
        window.__mapClicks = 0;
        document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          window.__mapClicks++;
        }, { capture: true });
      });
      await page.locator('[data-desk-link="projects"]').click();
      assert.equal(await layer.getAttribute('data-phase'), 'splatter', `${colorScheme}: a selection starts the return`);
      assert.equal(await page.evaluate(() => window.__mapClicks), 0, `${colorScheme}: selection waits for the return`);
      await page.waitForFunction(() => window.__mapClicks === 1, null, { timeout: 4000 });
      assert.equal(await page.locator('[data-punctuation-gravity]').count(), 0, `${colorScheme}: the selection runs after the copies return`);
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

    const navigation = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(navigation);
    await navigation.locator('[data-desk-link="projects"]').click();
    assert.equal(await navigation.locator('[data-punctuation-gravity]').getAttribute('data-phase'), 'splatter', 'link selection begins a splatter');
    assert.equal(new URL(navigation.url()).hash, '', 'link does not scroll before the splatter');
    await navigation.waitForURL('**/#work', { timeout: 4000 });
    assert.equal(await navigation.locator('[data-punctuation-gravity]').count(), 0, 'link scroll happens after the copies return');
    await navigation.close();

    const research = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(research);
    await research.locator('[data-desk-link="research"]').click();
    assert.equal(await research.locator('[data-experience-target="experience-research"]').getAttribute('aria-expanded'), 'false', 'research is not opened before the return');
    await research.waitForURL('**/#experience', { timeout: 4000 });
    assert.equal(await research.locator('[data-experience-target="experience-research"]').getAttribute('aria-expanded'), 'true', 'research opens after the return');
    await research.close();

    const reselected = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(reselected);
    await reselected.locator('[data-desk-link="projects"]').click();
    await reselected.locator('[data-desk-link="research"]').click();
    await reselected.waitForURL('**/#experience', { timeout: 4000 });
    assert.equal(await reselected.locator('[data-experience-target="experience-research"]').getAttribute('aria-expanded'), 'true', 'a different desk selection replaces the pending destination');
    await reselected.waitForTimeout(500);
    assert.equal(new URL(reselected.url()).hash, '#experience', 'the earlier selection does not run afterward');
    await reselected.close();

    const object = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await object.goto(origin, { waitUntil: 'networkidle' });
    await object.evaluate(() => document.fonts.ready);
    const monitor = await monitorPoint(object);
    assert.ok(monitor, 'the 3D monitor has a clickable target');
    await object.mouse.move(monitor.x, monitor.y);
    await object.waitForFunction(() => document.querySelector('[data-punctuation-gravity]')?.dataset.liquid === 'fused', null, { timeout: 7000 });
    assert.ok(await object.locator('[data-desk-link="security"]').evaluate(el => el.classList.contains('is-desk-hovered')), 'pointer is over the monitor');
    await object.mouse.click(monitor.x, monitor.y);
    assert.equal(await object.locator('[data-punctuation-gravity]').getAttribute('data-phase'), 'splatter', 'the real 3D monitor begins a splatter');
    assert.equal(new URL(object.url()).pathname, '/', 'the 3D monitor waits before navigating');
    await object.waitForURL('**/work/homelab/', { timeout: 4000 });
    await object.close();

    const keyboard = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(keyboard);
    await keyboard.evaluate(() => {
      window.__keyboardSelection = 0;
      document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__keyboardSelection++;
      }, { capture: true });
    });
    await keyboard.locator('[data-desk-link="projects"]').focus();
    await keyboard.keyboard.press('Enter');
    assert.equal(await keyboard.evaluate(() => window.__keyboardSelection), 1, 'keyboard activation is immediate');
    await keyboard.close();

    const interrupted = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(interrupted);
    await interrupted.evaluate(() => {
      window.__interruptedSelections = 0;
      document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__interruptedSelections++;
      }, { capture: true });
    });
    await interrupted.locator('[data-desk-link="projects"]').dblclick({ delay: 50 });
    assert.equal(await interrupted.evaluate(() => window.__interruptedSelections), 0, 'double click does not trigger duplicate or early navigation');
    await interrupted.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await interrupted.evaluate(() => window.__interruptedSelections), 1, 'interruption completes the pending selection');
    await interrupted.waitForTimeout(1100);
    assert.equal(await interrupted.evaluate(() => window.__interruptedSelections), 1, 'the fallback timer does not repeat the selection');
    await interrupted.close();

    const superseded = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(superseded);
    await superseded.locator('[data-desk-link="projects"]').click();
    await superseded.locator('.desktop-nav a[href="#about"]').click();
    await superseded.waitForURL('**/#about', { timeout: 4000 });
    await superseded.waitForTimeout(1100);
    assert.equal(new URL(superseded.url()).hash, '#about', 'a new outside selection supersedes pending navigation');
    await superseded.close();

    const cancel = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(cancel);
    await cancel.locator('[data-desk-link="projects"]').click();
    await cancel.keyboard.press('Escape');
    await cancel.waitForTimeout(1100);
    assert.equal(new URL(cancel.url()).hash, '', 'Escape cancels a pending selection');
    assert.equal(await cancel.locator('[data-punctuation-gravity]').count(), 0, 'Escape clears the animation');
    await cancel.close();

    const leaving = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await startAtDesk(leaving);
    await leaving.evaluate(() => {
      window.__leavingSelections = 0;
      document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__leavingSelections++;
      }, { capture: true });
    });
    await leaving.locator('[data-desk-link="projects"]').click();
    await leaving.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await leaving.waitForTimeout(1100);
    assert.equal(await leaving.evaluate(() => window.__leavingSelections), 0, 'leaving the page cancels a pending selection');
    await leaving.close();

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const modified = await context.newPage();
    await startAtDesk(modified);
    const newTab = context.waitForEvent('page', { timeout: 5000 });
    await modified.locator('[data-desk-link="security"]').click({ modifiers: ['Control'] });
    const opened = await newTab;
    await opened.waitForURL('**/work/homelab/', { timeout: 5000 });
    assert.equal(new URL(modified.url()).pathname, '/', 'modified click keeps its normal new-tab behaviour');
    await context.close();

    const duringContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    const during = await duringContext.newPage();
    await startAtDesk(during);
    await during.locator('[data-desk-link="projects"]').click();
    const secondTab = duringContext.waitForEvent('page', { timeout: 5000 });
    await during.locator('[data-desk-link="security"]').click({ modifiers: ['Control'] });
    const secondOpened = await secondTab;
    await secondOpened.waitForURL('**/work/homelab/', { timeout: 5000 });
    await during.waitForTimeout(1100);
    assert.equal(new URL(during.url()).hash, '', 'a modified click during the splatter replaces the earlier pending selection');
    await duringContext.close();

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

    const touchObject = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
    await touchObject.goto(origin, { waitUntil: 'networkidle' });
    await touchObject.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
    await touchObject.waitForTimeout(300);
    const touchMonitor = await monitorPoint(touchObject);
    assert.ok(touchMonitor, 'the 3D monitor is available on touch screens');
    await touchObject.touchscreen.tap(touchMonitor.x, touchMonitor.y);
    await touchObject.waitForURL('**/work/homelab/', { timeout: 4000 });
    assert.equal(await touchObject.locator('[data-punctuation-gravity]').count(), 0, 'touch navigation does not wait for particles');
    await touchObject.close();

    const nojs = await browser.newPage({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await nojs.goto(origin);
    assert.ok(await nojs.locator('#intro-title').isVisible(), 'the heading is readable without JavaScript');
    assert.equal(await nojs.locator('[data-desk-link]').count(), 4, 'desk links remain available without JavaScript');
    assert.equal(await nojs.locator('[data-punctuation-gravity]').count(), 0, 'no copies without JavaScript');
    await nojs.close();
    console.log('PASS: text sources, liquid fusion and splitting, colour, delayed selection, return and re-entry, themes, accessibility, touch and fallbacks.');
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
