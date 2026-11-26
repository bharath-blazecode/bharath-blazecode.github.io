const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const LIGHT_PAPER = 'rgb(243, 244, 239)';
const DARK_PAPER = 'rgb(20, 25, 20)';

const watchers = () => {
  window.__csp = [];
  window.__dcl = null;
  document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ' ' + event.blockedURI));
  document.addEventListener('DOMContentLoaded', () => { window.__dcl = document.documentElement.dataset.theme || ''; });
};

async function open(browser, site, options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width || 1440, height: options.height || 900 },
    reducedMotion: options.reducedMotion || 'no-preference',
    colorScheme: options.colorScheme || 'light',
    javaScriptEnabled: options.javaScriptEnabled !== false,
    hasTouch: Boolean(options.touch),
    bypassCSP: Boolean(options.bypassCSP)
  });
  if (options.saved) await context.addInitScript(value => localStorage.setItem('bs-shift', value), options.saved);
  if (options.javaScriptEnabled !== false) await context.addInitScript(watchers);
  const page = await context.newPage();
  const problems = [];
  const foreign = [];
  page.on('pageerror', error => problems.push('pageerror: ' + error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text() + ' ' + (message.location().url || '')); });
  page.on('request', request => { if (!/^(data|blob):/.test(request.url()) && new URL(request.url()).origin !== site.url) foreign.push(request.url()); });
  await page.goto(site.url + '/', { waitUntil: 'load' });
  return { context, page, problems, foreign };
}

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y <= height; y += 500) {
    await page.evaluate(top => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

const running = page => page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
const transform = (page, selector) => page.locator(selector).evaluate(el => getComputedStyle(el).transform);
const paper = page => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

(async () => {
  const site = await startSite(48775);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });

    // 1. Light by default, saved dark applied before first paint.
    {
      const { context, page } = await open(browser, site, { colorScheme: 'dark' });
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), undefined, 'no theme attribute with an empty store');
      assert.equal(await paper(page), LIGHT_PAPER, 'page is light when the system is dark');
      assert.equal(await page.evaluate(() => window.__dcl), '', 'no theme attribute at DOMContentLoaded');
      await context.close();

      const saved = await open(browser, site, { saved: 'dark' });
      assert.equal(await saved.page.evaluate(() => window.__dcl), 'dark', 'dark already set at DOMContentLoaded');
      assert.equal(await paper(saved.page), DARK_PAPER, 'saved dark theme gives the dark paper colour');
      await saved.context.close();

      const html = await (await fetch(site.url + '/')).text();
      const head = html.slice(0, html.indexOf('</head>'));
      const theme = head.indexOf('bs-shift');
      assert.ok(theme > 0, 'theme script is inline in the head');
      for (const later of ['<style', '<link rel="preload"', '<body']) {
        const at = html.indexOf(later);
        assert.ok(at === -1 || theme < at, `theme script comes before ${later}`);
      }
      const light = await open(browser, site, { saved: 'light', colorScheme: 'dark' });
      assert.equal(await paper(light.page), LIGHT_PAPER, 'saved light wins over a dark system');
      await light.context.close();
    }

    // 2. Toggle, label, aria-pressed and persistence.
    {
      const { context, page } = await open(browser, site);
      const toggle = page.locator('[data-theme-toggle]');
      assert.ok(await toggle.isVisible(), 'theme toggle is visible');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'false');
      const before = (await toggle.innerText() + await toggle.locator('[data-theme-label]').textContent()).trim();
      await toggle.click();
      assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
      assert.notEqual((await toggle.innerText() + await toggle.locator('[data-theme-label]').textContent()).trim(), before, 'label changes');
      assert.equal(await page.evaluate(() => localStorage.getItem('bs-shift')), 'dark');
      await page.reload({ waitUntil: 'load' });
      assert.equal(await paper(page), DARK_PAPER, 'dark survives a reload');
      assert.equal(await toggle.getAttribute('aria-pressed'), 'true', 'pressed state survives a reload');
      await toggle.click();
      assert.equal(await page.evaluate(() => localStorage.getItem('bs-shift')), 'light');
      await page.reload({ waitUntil: 'load' });
      assert.equal(await paper(page), LIGHT_PAPER, 'light survives a reload');
      await context.close();
    }

    // 3. Navigation count and the mobile menu.
    {
      const { context, page } = await open(browser, site, { width: 390, touch: true });
      assert.equal(await page.locator('nav').count(), 2, 'exactly two nav elements');
      assert.equal(await page.locator('nav[aria-label="Main"]').count(), 1);
      assert.equal(await page.locator('details.menu nav[aria-label="Mobile"]').count(), 1);
      assert.ok(!(await page.locator('nav[aria-label="Main"]').isVisible()), 'main nav is hidden at 390');
      const menu = page.locator('details.menu');
      const summary = menu.locator('summary');
      await summary.click();
      assert.ok(await menu.evaluate(el => el.open), 'menu opens');
      await page.keyboard.press('Escape');
      assert.ok(!(await menu.evaluate(el => el.open)), 'Escape closes the menu');
      assert.ok(await summary.evaluate(el => el === document.activeElement), 'focus returns to the summary');
      await summary.click();
      await menu.locator('nav a[href$="#about"]').click();
      assert.ok(!(await menu.evaluate(el => el.open)), 'choosing a link closes the menu');
      assert.ok((await page.evaluate(() => location.hash)) === '#about');
      await context.close();

      const wide = await open(browser, site, { width: 901 });
      assert.ok(await wide.page.locator('nav[aria-label="Main"]').isVisible(), 'main nav shows above 900');
      assert.ok(!(await wide.page.locator('details.menu').isVisible()), 'mobile menu hidden above 900');
      await wide.page.setViewportSize({ width: 900, height: 900 });
      assert.ok(await wide.page.locator('details.menu').isVisible(), 'mobile menu shows at 900');
      assert.ok(!(await wide.page.locator('nav[aria-label="Main"]').isVisible()), 'main nav hidden at 900');
      await wide.context.close();
    }

    // 4. Hero content within the first screen at 1440.
    {
      const { context, page } = await open(browser, site);
      assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), 'Security is in the details.');
      assert.equal(await page.locator('h1').count(), 1, 'one h1');
      const targets = [
        page.locator('h1'), page.locator('.hero .lede'), page.locator('.hero .hero-sub'),
        page.locator('.hero a.button[href$=".pdf"]'), page.locator('.hero a[href^="mailto:"]'), page.locator('.glance')
      ];
      for (const label of ['Areas', 'Now', 'Studying', 'Based in', 'Work rights']) targets.push(page.locator('.glance dt', { hasText: label }), page.locator('.glance > div', { hasText: label }));
      for (const target of targets) {
        assert.ok(await target.first().isVisible(), 'hero item is visible: ' + await target.first().evaluate(el => el.className || el.tagName));
        const box = await target.first().boundingBox();
        assert.ok(box.y + box.height <= 900, `hero item ends within 900px (${Math.round(box.y + box.height)})`);
      }
      assert.equal(await page.locator('.glance dt').count(), 5, 'five at-a-glance entries');
      assert.ok(await page.locator('[data-terminal-open]').isVisible(), 'terminal button is present');
      await context.close();
    }

    // 5. Reduced motion.
    {
      const { context, page } = await open(browser, site, { reducedMotion: 'reduce' });
      // The desk poster hides after a 0.5s visibility delay once the scene loads, so let that settle first.
      await page.waitForTimeout(1500);
      assert.equal(await running(page), 0, 'no animation running after load');
      await scrollThrough(page);
      await page.waitForTimeout(1200);
      assert.equal(await running(page), 0, 'no animation running after scrolling');
      const opacities = await page.$$eval('.reveal', items => items.map(item => getComputedStyle(item).opacity));
      assert.ok(opacities.length > 5 && opacities.every(value => value === '1'), 'every .reveal has opacity 1');
      const stroke = await page.locator('.stroke-wrap').boundingBox();
      const h1 = await page.locator('.details').boundingBox();
      assert.ok(stroke.width > 50 && stroke.x >= h1.x - h1.width * 0.05 && stroke.x + stroke.width <= h1.x + h1.width * 1.05, 'marker stroke sits fully under "details."');
      assert.equal(await page.locator('.stroke').evaluate(el => getComputedStyle(el).transform), 'none', 'marker stroke is not shifted');
      assert.equal(await page.locator('.stroke-wrap').evaluate(el => getComputedStyle(el).transform), 'none');
      await context.close();
    }

    // 6. Motion allowed: reveals, folders, keyboard.
    {
      const { context, page } = await open(browser, site);
      await page.waitForTimeout(1400);
      assert.match(await page.locator('.stroke-wrap').evaluate(el => getComputedStyle(el).transform), /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/, 'marker sweep has finished');
      const count = await page.locator('.reveal').count();
      for (let i = 0; i < count; i++) {
        const item = page.locator('.reveal').nth(i);
        await item.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForFunction(el => getComputedStyle(el).opacity === '1', await item.elementHandle(), { timeout: 3000 })
          .catch(() => assert.fail(`.reveal #${i} did not reach opacity 1 when scrolled to`));
      }

      const folders = page.locator('.folder');
      assert.equal(await folders.count(), 3);
      for (let i = 0; i < 3; i++) {
        const folder = folders.nth(i);
        const key = await folder.getAttribute('data-object');
        const sheet = `.folder[data-object="${key}"] .sheet-shot`;
        await page.mouse.move(2, 2);
        await folder.scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        const rest = await transform(page, sheet);
        await folder.locator('.folder-front').hover();
        await page.waitForFunction(([s, from]) => getComputedStyle(document.querySelector(s)).transform !== from, [sheet, rest], { timeout: 3000 })
          .catch(() => assert.fail(`${key}: sheet did not move on hover`));
        await page.mouse.move(2, 2);
        await page.waitForTimeout(700);
        assert.equal(await transform(page, sheet), rest, `${key}: sheet returns after hover`);
      }

      for (const [key, href] of [['homelab', 'work/homelab/'], ['classquest', 'work/classquest/'], ['luna', 'work/luna/']]) {
        const link = `.folder[data-object="${key}"] h3 a`;
        assert.equal(await page.locator(link).getAttribute('href'), href);
        const sheet = `.folder[data-object="${key}"] .sheet-shot`;
        await page.evaluate(() => { window.scrollTo(0, 0); document.activeElement.blur(); });
        await page.mouse.move(2, 2);
        await page.waitForTimeout(700);
        const rest = await transform(page, sheet);
        let reached = false;
        for (let i = 0; i < 80 && !reached; i++) {
          await page.keyboard.press('Tab');
          reached = await page.locator(link).evaluate(el => el === document.activeElement);
        }
        assert.ok(reached, `${key}: link reachable with Tab`);
        await page.waitForFunction(([s, from]) => getComputedStyle(document.querySelector(s)).transform !== from, [sheet, rest], { timeout: 3000 })
          .catch(() => assert.fail(`${key}: sheet did not move on keyboard focus`));
        await Promise.all([page.waitForURL(url => url.pathname.endsWith('/' + href)), page.keyboard.press('Enter')]);
        await page.goBack({ waitUntil: 'load' });
      }
      await context.close();
    }

    // 7. No JavaScript.
    {
      const { context, page } = await open(browser, site, { javaScriptEnabled: false });
      assert.ok(!(await page.locator('[data-theme-toggle]').isVisible()), 'theme toggle not shown');
      assert.ok(!(await page.locator('[data-terminal-open]').isVisible()), 'terminal button not shown');
      assert.ok(await page.locator('h1').isVisible() && await page.locator('.glance').isVisible(), 'hero is readable');
      const count = await page.locator('.reveal').count();
      for (let i = 0; i < count; i++) {
        const item = page.locator('.reveal').nth(i);
        await item.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(40);
        assert.equal(await item.evaluate(el => getComputedStyle(el).opacity), '1', `.reveal #${i} is visible without JavaScript`);
      }
      for (const key of ['homelab', 'classquest', 'luna']) {
        const link = page.locator(`.folder[data-object="${key}"] h3 a`);
        assert.ok(await link.isVisible(), `${key} link visible`);
        assert.equal(await link.getAttribute('href'), `work/${key}/`);
      }
      assert.ok(await page.locator('.desk-poster img').isVisible(), 'desk still image shows');
      assert.equal(await page.locator('[data-experience-path]').isVisible(), false, 'experience path stays hidden');
      assert.equal(await page.locator('#experience.has-experience-path').count(), 0, 'no path class without JavaScript');
      const roleOpen = await page.locator('[data-experience-roles] > details.role').evaluateAll(items => items.map(item => item.open));
      assert.deepEqual(roleOpen, [true, false, false, false, false, false, false], 'seven native details, only the first open');
      for (const item of await page.locator('[data-experience-roles] > details.role').all()) assert.ok(await item.locator('summary').isVisible(), 'role summary is visible');
      assert.equal(await page.locator('[data-chess-start]').count(), 1, 'chess start button exists');
      assert.equal(await page.locator('[data-chess-start]').evaluate(el => getComputedStyle(el).display), 'none', 'chess start button is hidden without JavaScript');
      await context.close();
    }

    // 8. Research teaser, header link and chess on request.
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const requested = [];
      page.on('request', request => requested.push(new URL(request.url()).pathname));
      await page.goto(site.url + '/', { waitUntil: 'load' });
      await page.waitForTimeout(500);

      const research = page.locator('section#research');
      assert.equal((await research.locator('h2').innerText()).trim(), 'AI Cyber Risk Assessment Research');
      assert.ok((await research.innerText()).includes('Can AI help assess cyber risk?'), 'research question is shown');
      assert.ok((await research.innerText()).includes('There are no results to report yet.'), 'no results claimed');
      assert.equal(await research.locator('a.button').getAttribute('href'), 'research/');
      assert.equal((await research.locator('a.button').innerText()).trim(), 'Read about the research');
      assert.equal(await page.locator('header a[href="research/"]').first().innerText(), 'Research', 'header Research link goes to research/');
      assert.equal(await page.locator('[data-explainer]').count(), 0, 'the explainer is not on the homepage');
      assert.ok(!requested.some(file => /explainer/.test(file)), 'explainer.js is not loaded');

      const start = page.locator('[data-chess-start]');
      assert.ok(await start.isVisible(), 'chess start button is visible');
      assert.equal((await start.innerText()).trim(), 'Play a short game');
      assert.equal(await page.locator('[data-chess-game]').isHidden(), true, 'game is hidden until asked for');
      assert.ok(!requested.some(file => /chess/i.test(file)), 'no chess file is requested before the button is pressed');
      await context.close();
    }

    // 9. Budget and hygiene.
    {
      const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await context.addInitScript(watchers);
      const page = await context.newPage();
      const scripts = [];
      const problems = [];
      const foreign = [];
      page.on('response', async response => {
        const url = new URL(response.url());
        if (url.pathname.endsWith('.js') && !/desk-scene/.test(url.pathname)) scripts.push(url.pathname);
      });
      page.on('pageerror', error => problems.push('pageerror: ' + error.message));
      page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text()); });
      page.on('request', request => { if (!/^(data|blob):/.test(request.url()) && new URL(request.url()).origin !== site.url) foreign.push(request.url()); });
      await page.goto(site.url + '/', { waitUntil: 'load' });
      await page.waitForTimeout(500);
      let bytes = 0;
      for (const file of new Set(scripts)) bytes += zlib.gzipSync(fs.readFileSync(path.join(site.dir, file))).length;
      assert.ok(scripts.length >= 2 && scripts.some(file => /home.js/.test(file)), 'page scripts were loaded');
      assert.ok(bytes < 80 * 1024, `JavaScript before interaction is ${bytes} bytes gzipped, limit 81920`);
      assert.deepEqual(foreign, [], 'no requests to other origins');
      assert.deepEqual(problems, [], 'no console errors');
      assert.deepEqual(await page.evaluate(() => window.__csp), [], 'no Content-Security-Policy violations');
      await context.close();

      for (const width of [320, 390, 820, 1440]) {
        const view = await open(browser, site, { width });
        await scrollThrough(view.page);
        const { scrollWidth, innerWidth } = await view.page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth }));
        assert.ok(scrollWidth <= innerWidth, `no horizontal overflow at ${width} (${scrollWidth} > ${innerWidth})`);
        assert.deepEqual(view.problems, [], `no console errors at ${width}`);
        await view.context.close();
      }

      const printed = await open(browser, site);
      await printed.page.emulateMedia({ media: 'print' });
      const hidden = await printed.page.$$eval('main details', items => items.flatMap(item => [...item.children].filter(child => child.tagName !== 'SUMMARY')
        .filter(child => { const box = child.getBoundingClientRect(); return getComputedStyle(child).display === 'none' || box.height === 0; })
        .map(child => item.id || item.className)));
      assert.deepEqual(hidden, [], 'print shows the content of every details');
      await printed.context.close();
    }

    // 10. Touch targets at 390.
    {
      const { context, page } = await open(browser, site, { width: 390, touch: true });
      await page.locator('details.menu summary').click();
      const small = await page.evaluate(() => [...document.querySelectorAll('a, button, summary')].filter(el => {
        const box = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        if (!box.width || !box.height || style.visibility === 'hidden' || el.closest('[hidden]') || el.classList.contains('skip')) return false;
        if (el.tagName === 'A' && el.closest('p, dd')) return false;
        // Folder links stretch over the whole card; check the card centre really hits the link.
        const card = el.closest('.folder');
        if (card && el.matches('h3 a')) { card.scrollIntoView({ block: 'center' }); const c = card.getBoundingClientRect(); if (document.elementFromPoint(c.x + c.width / 2, c.y + c.height / 2) === el) return false; }
        return box.width < 44 || box.height < 44;
      }).map(el => `${el.tagName.toLowerCase()}.${el.className} "${el.textContent.trim().slice(0, 30)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
      assert.deepEqual(small, [], 'every control is at least 44 by 44');
      await context.close();
    }

    // Accessibility scans run last so every other check reports first.
    {
      const axeSource = fs.readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
      for (const width of [390, 1440]) {
        for (const theme of ['light', 'dark']) {
          const { context: axeContext, page: axePage } = await open(browser, site, { width, reducedMotion: 'reduce', bypassCSP: true, saved: theme });
          await scrollThrough(axePage);
          await axePage.evaluate(axeSource);
          const result = await axePage.evaluate(() => axe.run());
          const summary = result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 4).join(' | ')}`);
          assert.deepEqual(summary, [], `axe violations at ${width} ${theme}`);
          await axeContext.close();
        }
      }
    }

    console.log('PASS homepage: theme, navigation, hero, motion, no-JS, research teaser, chess on request, budget, hygiene, axe, touch targets');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
