const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { startSite } = require('./helpers/site.cjs');

const SCENE = 'desk-scene.js';
const objects = [['homelab', 'work/homelab/'], ['classquest', 'work/classquest/'], ['luna', 'work/luna/'], ['research', 'research/']];

// Counts WebGL draw calls and lets a test pretend the tab is hidden.
function instruments() {
  window.__draws = 0;
  window.__hidden = false;
  for (const name of ['WebGLRenderingContext', 'WebGL2RenderingContext']) {
    const proto = window[name] && window[name].prototype;
    if (!proto) continue;
    for (const method of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced']) {
      const original = proto[method];
      if (original) proto[method] = function (...args) { window.__draws++; return original.apply(this, args); };
    }
  }
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__hidden });
}

function noWebGL() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    return /webgl/.test(String(type)) ? null : original.call(this, type, ...rest);
  };
}

async function open(browser, site, options = {}) {
  const context = await browser.newContext({
    viewport: options.viewport || { width: 1440, height: 900 },
    deviceScaleFactor: options.scale || 1,
    reducedMotion: options.reducedMotion || 'no-preference',
    hasTouch: Boolean(options.phone),
    isMobile: Boolean(options.phone)
  });
  await context.addInitScript(instruments);
  if (options.noWebGL) await context.addInitScript(noWebGL);
  const page = await context.newPage();
  const errors = [];
  const sceneRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes(SCENE)) sceneRequests.push(request.url()); });
  if (options.route) await page.route('**/' + SCENE, options.route);
  await page.goto(site.url + '/', options.wait ? { waitUntil: options.wait } : { waitUntil: 'load' });
  return { context, page, errors, sceneRequests };
}

const draws = page => page.evaluate(() => window.__draws);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function ready(page) {
  await page.waitForSelector('.desk.has-3d.has-tags', { timeout: 15000 });
  await page.waitForTimeout(1900); // the objects hop once when the desk first shows
}

// Fire a pointer move at the canvas directly, which works whether or not it is on screen.
const nudge = page => page.evaluate(() => {
  const canvas = document.querySelector('[data-desk-canvas]');
  const box = canvas.getBoundingClientRect();
  for (const fraction of [.3, .7]) {
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: box.x + box.width * fraction, clientY: box.y + box.height * .5, pointerType: 'mouse', isPrimary: true, bubbles: true }));
  }
});

async function settled(page) {
  let last = -1;
  for (let i = 0; i < 20; i++) {
    const now = await draws(page);
    if (now === last) return now;
    last = now;
    await page.waitForTimeout(300);
  }
  assert.fail('the scene keeps drawing when nothing is moving');
}

// Find a point over the object: first a little down and left of its tag anchor, then outwards in every direction.
const offsets = [[-6, 24]];
for (let dy = -60; dy <= 90; dy += 10) for (let dx = -60; dx <= 70; dx += 10) offsets.push([dx, dy]);
offsets.sort((a, b) => Math.hypot(a[0] + 6, a[1] - 24) - Math.hypot(b[0] + 6, b[1] - 24));
async function pointOn(page, key) {
  for (const [dx, dy] of offsets) {
    const tag = await page.locator(`[data-tag="${key}"]`).boundingBox();
    const x = tag.x - 10 + dx, y = tag.y + 14 + dy;
    await page.mouse.move(x - 40, y - 40);
    await page.mouse.move(x, y, { steps: 4 });
    await page.waitForTimeout(90);
    const active = () => page.locator(`[data-tag="${key}"]`).evaluate(el => el.classList.contains('is-active'));
    if (!(await active())) continue;
    // The object lifts when hovered, so confirm the point still hits it once it has settled.
    await page.waitForTimeout(500);
    let steady = true;
    for (const [ex, ey] of [[4, 0], [-4, 0], [0, 4], [0, -4], [0, 0]]) {
      await page.mouse.move(x + ex, y + ey);
      await page.waitForTimeout(350);
      steady = steady && await active();
    }
    if (steady) return [x, y];
  }
  assert.fail(`no point near the ${key} tag marks its folder`);
}

(async () => {
  const site = await startSite(48776);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });

    // Still image first, then desktop auto-load after the load event.
    {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      const { context, page, errors, sceneRequests } = await open(browser, site, {
        route: async route => { await gate; await route.continue(); }
      });
      await page.waitForTimeout(1200);
      assert.equal(sceneRequests.length, 1, 'scene is requested on a desktop once the page is loaded');
      const poster = await page.locator('.desk-poster img').evaluate(img => ({ done: img.complete, width: img.naturalWidth, shown: img.getBoundingClientRect().width }));
      assert.ok(poster.done && poster.width > 0, 'still image is decoded before the scene arrives');
      assert.ok(!(await page.locator('[data-desk]').evaluate(el => el.classList.contains('has-3d'))), 'no 3D class while the scene is pending');
      assert.equal(await page.locator('[data-desk-canvas]').evaluate(el => getComputedStyle(el).opacity), '0', 'canvas is invisible until ready');
      release();
      await ready(page);
      const timing = await page.evaluate(scene => ({
        asked: performance.getEntries().find(entry => entry.name.includes(scene)).startTime,
        loaded: performance.getEntriesByType('navigation')[0].loadEventStart
      }), SCENE);
      assert.ok(timing.asked >= timing.loaded, `scene fetched after the load event (${Math.round(timing.asked)} vs ${Math.round(timing.loaded)})`);
      assert.deepEqual(errors, [], 'no page errors');

      const desk = await page.locator('[data-desk]').boundingBox();
      for (const [key] of objects) {
        const tag = await page.locator(`[data-tag="${key}"]`).boundingBox();
        assert.ok(tag.x >= desk.x && tag.y >= desk.y && tag.x + tag.width <= desk.x + desk.width && tag.y + tag.height <= desk.y + desk.height,
          `${key} tag sits inside the desk box (${JSON.stringify(tag)} in ${JSON.stringify(desk)})`);
      }
      assert.equal(await page.locator('[data-desk-start]').isVisible(), false, 'start button is hidden on desktop');
      await context.close();
    }

    // Hover and click on each object.
    for (const [key, target] of objects) {
      const { context, page } = await open(browser, site);
      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await ready(page);
      await pointOn(page, key);
      if (key !== 'research') assert.ok(await page.locator(`.folder[data-object="${key}"]`).evaluate(el => el.classList.contains('is-linked')), `${key}: folder is linked`);
      for (const [other] of objects) {
        if (other !== key && other !== 'research') assert.ok(!(await page.locator(`.folder[data-object="${other}"]`).evaluate(el => el.classList.contains('is-linked'))), `${key}: ${other} is not linked`);
      }
      assert.equal(await page.locator('[data-desk-canvas]').evaluate(el => el.style.cursor), 'pointer', `${key}: pointer cursor`);
      await page.mouse.down();
      await page.mouse.up();
      if (target.startsWith('#')) await page.waitForFunction(hash => location.hash === hash, target, { timeout: 3000 });
      else await page.waitForURL(url => url.pathname.endsWith('/' + target), { timeout: 5000, waitUntil: 'commit' }).catch(error => assert.fail(key + ': click did not follow the link, now at ' + page.url() + ' ' + error.message.slice(0, 80)));
      await context.close();
    }

    // Phone: nothing is fetched until the visitor asks.
    {
      const { context, page, errors, sceneRequests } = await open(browser, site, { phone: true, scale: 2, viewport: { width: 390, height: 844 } });
      await page.waitForTimeout(1500);
      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(1500);
      assert.equal(sceneRequests.length, 0, 'scene is not requested on a phone before the button is pressed');
      const start = page.locator('[data-desk-start]');
      assert.ok(await start.isVisible(), 'start button is shown on a phone');
      assert.ok(await page.locator('.desk-poster img').evaluate(img => img.complete && img.naturalWidth > 0), 'still image shows on a phone');
      await start.tap();
      await page.waitForSelector('.desk.has-3d', { timeout: 15000 });
      assert.equal(sceneRequests.length, 1, 'scene is requested once after the tap');
      assert.ok(!(await start.isVisible()), 'start button goes away once the scene is ready');
      assert.deepEqual(errors, [], 'no page errors on a phone');
      await context.close();
    }

    // WebGL unavailable: the still image stays.
    {
      const { context, page, errors } = await open(browser, site, { noWebGL: true });
      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(2500);
      assert.ok(!(await page.locator('[data-desk]').evaluate(el => el.classList.contains('has-3d') || el.classList.contains('has-tags'))), 'no 3D or tag classes without WebGL');
      assert.ok(await page.locator('.desk-poster img').isVisible(), 'still image remains');
      assert.equal(await page.locator('.desk-poster').evaluate(el => getComputedStyle(el).visibility), 'visible');
      assert.ok(await page.locator('.folder h3 a').first().isVisible(), 'folders still work');
      assert.deepEqual(errors, [], 'no page errors without WebGL');
      await context.close();
    }

    // Draws stop off screen and while the tab is hidden.
    {
      const { context, page } = await open(browser, site);
      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await ready(page);
      await settled(page);
      let before = await draws(page);
      await nudge(page);
      await page.waitForTimeout(500);
      assert.ok(await draws(page) > before, 'a pointer move draws a frame while the desk is on screen');
      await settled(page);

      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(500);
      before = await draws(page);
      await nudge(page);
      await page.waitForTimeout(600);
      assert.equal(await draws(page), before, 'no drawing while the desk is off screen');

      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      await settled(page);
      await page.evaluate(() => { window.__hidden = true; document.dispatchEvent(new Event('visibilitychange')); });
      before = await draws(page);
      await nudge(page);
      await page.waitForTimeout(600);
      assert.equal(await draws(page), before, 'no drawing while the page is hidden');

      await page.evaluate(() => { window.__hidden = false; document.dispatchEvent(new Event('visibilitychange')); });
      await page.waitForTimeout(300);
      before = await draws(page);
      await nudge(page);
      await page.waitForTimeout(500);
      assert.ok(await draws(page) > before, 'drawing resumes when the page is visible again');
      await context.close();
    }

    // Reduced motion: the scene is static. The same pointer move tilts it when motion is allowed.
    {
      const shot = async page => {
        const box = await page.locator('[data-desk]').boundingBox();
        await page.mouse.move(box.x + 24, box.y + 24);
        await page.mouse.move(box.x + 30, box.y + 30, { steps: 6 });
        await page.waitForTimeout(1200);
        const image = await page.screenshot({ clip: box });
        await page.mouse.move(box.x + box.width - 24, box.y + box.height - 60, { steps: 6 });
        await page.waitForTimeout(1200);
        return [image, await page.screenshot({ clip: box })];
      };
      const still = await open(browser, site, { reducedMotion: 'reduce' });
      await still.page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await still.page.waitForSelector('.desk.has-3d.has-tags', { timeout: 15000 });
      await still.page.waitForTimeout(600);
      await settled(still.page);
      const [a, b] = await shot(still.page);
      assert.ok(a.equals(b), 'reduced motion: moving the pointer does not tilt or move the scene');
      await settled(still.page);
      await still.context.close();

      const live = await open(browser, site);
      await live.page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await ready(live.page);
      const [c, d] = await shot(live.page);
      assert.ok(!c.equals(d), 'motion allowed: the same pointer move does change the scene');
      await live.context.close();
    }

    // Backing store is at most twice the CSS size, even on a very dense screen.
    {
      const { context, page } = await open(browser, site, { scale: 3, viewport: { width: 1200, height: 800 } });
      await page.locator('[data-desk]').evaluate(el => el.scrollIntoView({ block: 'center' }));
      await ready(page);
      const size = await page.locator('[data-desk-canvas]').evaluate(el => ({ w: el.width, h: el.height, cw: el.clientWidth, ch: el.clientHeight, dpr: devicePixelRatio }));
      assert.equal(size.dpr, 3);
      assert.ok(size.w <= size.cw * 2 + 1 && size.h <= size.ch * 2 + 1, `canvas ${size.w}x${size.h} is within 2x of ${size.cw}x${size.ch}`);
      assert.ok(size.w >= size.cw, 'canvas is not smaller than its CSS size');
      await context.close();
    }

    console.log('PASS desk: still image, desktop load, tags, hover and click, phone, no WebGL, visibility, reduced motion, canvas size');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
