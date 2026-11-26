const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const axeSource = fs.readFileSync(path.join(root, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');

const PAGES = ['/', '/404.html', '/work/homelab/', '/work/classquest/', '/work/luna/', '/work/competitions/'];
const WIDTHS = [1440, 820, 390, 320];
const THEMES = ['light', 'dark'];

// Known site defects. Each entry is "<check>" or "<check>|<page>". Remove an entry once the site is fixed.
// A page part matches the page exactly or with " at <width> <theme>" after it.
const KNOWN_FAILURES = [];

const failures = [];
function expect(ok, check, page, message) {
  if (!ok) failures.push({ check, page, message });
}

function listen(page, problems) {
  page.on('pageerror', error => problems.push('page error: ' + error.message));
  page.on('console', message => {
    if (message.type() === 'error') problems.push('console error: ' + message.text());
    else if (/content security policy/i.test(message.text())) problems.push('csp message: ' + message.text());
  });
  page.on('requestfailed', request => problems.push('request failed: ' + request.url()));
  page.on('response', response => {
    if (response.status() >= 400) problems.push('http ' + response.status() + ': ' + response.url());
  });
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(innerHeight * 0.7));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    scrollTo(0, 0);
  });
}

async function newContext(browser, { width, theme, bypassCSP = false, reducedMotion = 'reduce', javaScriptEnabled = true }) {
  const context = await browser.newContext({
    viewport: { width, height: 900 }, reducedMotion, bypassCSP, javaScriptEnabled, colorScheme: 'light'
  });
  if (theme) await context.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
  return context;
}

async function checkPage(browser, site, pagePath, width, theme, backgrounds) {
  const label = `${pagePath} at ${width} ${theme}`;
  const context = await newContext(browser, { width, theme });
  try {
    const page = await context.newPage();
    const problems = [];
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ' ' + event.blockedURI));
    });
    listen(page, problems);
    const response = await page.goto(site.url + pagePath, { waitUntil: 'load' });
    expect(response.status() === 200, 'page status', label, 'status ' + response.status());
    await page.evaluate(() => document.fonts.ready);
    await scrollThrough(page);
    for (const item of await page.evaluate(() => window.__csp)) problems.push('csp violation: ' + item);
    expect(problems.length === 0, 'clean load', label, problems.join(' | '));

    const facts = await page.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      main: document.querySelectorAll('main#main').length,
      title: document.title.trim(),
      description: (document.querySelector('meta[name="description"]') || {}).content || '',
      lang: document.documentElement.lang,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth,
      theme: document.documentElement.dataset.theme || 'light',
      background: getComputedStyle(document.documentElement).backgroundColor + '/' + getComputedStyle(document.body).backgroundColor,
      brokenImages: [...document.images].filter(image => !(image.naturalWidth > 0)).map(image => image.getAttribute('src'))
    }));
    expect(facts.h1 === 1, 'one h1', label, `found ${facts.h1}`);
    expect(facts.main === 1, 'main#main', label, `found ${facts.main}`);
    expect(facts.title.length > 0, 'title', label, 'empty title');
    expect(facts.description.trim().length > 0, 'meta description', label, 'empty description');
    expect(facts.lang === 'en-AU', 'lang', label, `lang is "${facts.lang}"`);
    expect(facts.scrollWidth <= facts.innerWidth, 'no horizontal overflow', label, `scrollWidth ${facts.scrollWidth} > innerWidth ${facts.innerWidth}`);
    expect(facts.brokenImages.length === 0, 'images decoded', label, 'not decoded: ' + facts.brokenImages.join(', '));
    expect(facts.theme === theme, 'theme applied', label, `theme is ${facts.theme}`);
    backgrounds.set(`${pagePath}|${width}|${theme}`, facts.background);
  } finally {
    await context.close();
  }

  const axeContext = await newContext(browser, { width, theme, bypassCSP: true });
  try {
    const page = await axeContext.newPage();
    await page.goto(site.url + pagePath, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await scrollThrough(page);
    await page.evaluate(axeSource);
    const result = await page.evaluate(() => axe.run(document, { resultTypes: ['violations'] }));
    const summary = result.violations.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join('; ')}`);
    expect(summary.length === 0, 'axe', label, summary.join(' | '));
  } finally {
    await axeContext.close();
  }
}

async function checkReveals(browser, site, pagePath) {
  const context = await newContext(browser, { width: 1440, theme: 'light', reducedMotion: 'no-preference' });
  try {
    const page = await context.newPage();
    await page.goto(site.url + pagePath, { waitUntil: 'load' });
    await page.evaluate(async () => {
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await wait(40); }
      scrollTo(0, document.documentElement.scrollHeight);
      await wait(900);
    });
    const faded = await page.evaluate(() => [...document.querySelectorAll('.reveal')]
      .filter(item => Number(getComputedStyle(item).opacity) !== 1)
      .map(item => (item.id ? '#' + item.id : item.tagName.toLowerCase() + '.' + [...item.classList].join('.')) + ' opacity ' + getComputedStyle(item).opacity));
    expect(faded.length === 0, 'reveal reaches opacity 1', pagePath, faded.join('; '));
  } finally {
    await context.close();
  }
}

async function checkSite(browser, site) {
  const origin = new URL(site.url).origin;

  // Skip link, keyboard order and theme persistence.
  {
    const context = await newContext(browser, { width: 1440, theme: null });
    const page = await context.newPage();
    await page.goto(site.url + '/', { waitUntil: 'load' });
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({ cls: document.activeElement.className, href: document.activeElement.getAttribute('href') }));
    expect(/\bskip\b/.test(first.cls) && first.href === '#main', 'skip link first', '/', `first focus is ${JSON.stringify(first)}`);
    await page.keyboard.press('Enter');
    const landed = await page.evaluate(() => ({ id: document.activeElement.id, inMain: !!document.activeElement.closest('main'), hash: location.hash }));
    expect(landed.hash === '#main' && (landed.id === 'main' || landed.inMain), 'skip link moves focus to main', '/', JSON.stringify(landed));

    await page.goto(site.url + '/', { waitUntil: 'load' });
    const expected = await page.$$eval('nav[aria-label="Main"] a', links => links.map(link => link.getAttribute('href')));
    const seen = [];
    for (let i = 0; i < 12 && seen.length < expected.length; i++) {
      await page.keyboard.press('Tab');
      const href = await page.evaluate(() => {
        const el = document.activeElement;
        return el.closest('nav[aria-label="Main"]') ? el.getAttribute('href') : null;
      });
      if (href) seen.push(href);
    }
    assert.deepEqual(seen, expected, 'Tab should reach the main navigation links in order');

    await page.click('[data-theme-toggle]');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'dark', 'the toggle switches to dark');
    await page.click('a[href*="work/"]:visible');
    await page.waitForLoadState('load');
    const carried = await page.evaluate(() => ({ path: location.pathname, theme: document.documentElement.dataset.theme }));
    expect(/^\/work\//.test(carried.path) && carried.theme === 'dark', 'theme persists to a case study', carried.path, JSON.stringify(carried));
    await context.close();
  }

  // Internal links.
  {
    const context = await newContext(browser, { width: 1440, theme: null });
    const page = await context.newPage();
    const links = new Map();
    for (const pagePath of PAGES) {
      await page.goto(site.url + pagePath, { waitUntil: 'load' });
      for (const href of await page.$$eval('a[href]', anchors => anchors.map(a => a.href))) {
        const url = new URL(href);
        if (url.origin !== origin) continue;
        url.hash = '';
        if (!links.has(url.href)) links.set(url.href, pagePath);
      }
    }
    for (const [href, from] of links) {
      const response = await page.request.get(href);
      expect(response.status() === 200, 'internal link resolves', from, `${href} gave ${response.status()}`);
    }
    await context.close();
  }

  // Missing nested address.
  {
    const context = await newContext(browser, { width: 1440, theme: null });
    const page = await context.newPage();
    const problems = [];
    page.on('requestfailed', request => problems.push('request failed: ' + request.url()));
    page.on('pageerror', error => problems.push(error.message));
    const response = await page.goto(site.url + '/work/nope/deeper/', { waitUntil: 'load' });
    assert.equal(response.status(), 404, 'a missing nested address returns 404');
    assert.ok(await page.locator('h1').isVisible(), 'the 404 h1 is visible');
    const styled = await page.evaluate(() => getComputedStyle(document.querySelector('h1')).fontFamily);
    assert.ok(!/^"?Times/.test(styled), 'the 404 page is styled, h1 font is ' + styled);
    const fonts = await page.evaluate(() => document.fonts.ready.then(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family)));
    expect(fonts.length === 0 && problems.length === 0, '404 loads its assets', '/work/nope/deeper/', problems.concat(fonts).join(' | '));
    await page.click('nav[aria-label="Main"] a:text-is("Work")');
    await page.waitForLoadState('load');
    let where = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, h1: document.querySelector('h1').textContent }));
    assert.ok(where.path === '/' && where.hash === '#work' && !/filed/.test(where.h1), 'the Work link on the 404 page leads to the homepage, got ' + JSON.stringify(where));
    await page.goto(site.url + '/work/nope/deeper/');
    await page.click('a.brand');
    await page.waitForLoadState('load');
    where = await page.evaluate(() => ({ path: location.pathname, h1: document.querySelector('h1').textContent }));
    assert.ok(where.path === '/' && !/filed/.test(where.h1), 'the brand link on the 404 page leads to the homepage, got ' + JSON.stringify(where));
    await context.close();
  }

  // No JavaScript.
  {
    const context = await newContext(browser, { width: 1440, theme: null, javaScriptEnabled: false });
    const page = await context.newPage();
    for (const pagePath of PAGES) {
      await page.goto(site.url + pagePath, { waitUntil: 'load' });
      const facts = await page.evaluate(() => {
        const visible = selector => [...document.querySelectorAll(selector)].filter(el => el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 1);
        const main = document.querySelector('main');
        return {
          h1: visible('h1').length, mainText: main.innerText.trim().length, mainOpacity: getComputedStyle(main).opacity,
          toggle: visible('[data-theme-toggle]').length, terminal: visible('[data-terminal-open]').length
        };
      });
      expect(facts.h1 === 1 && facts.mainText > 50 && facts.mainOpacity === '1', 'no-JavaScript content', pagePath, JSON.stringify(facts));
      expect(facts.toggle === 0 && facts.terminal === 0, 'no-JavaScript hides script-only controls', pagePath, `toggle ${facts.toggle}, terminal ${facts.terminal} visible`);
    }
    await context.close();
  }

  // Print.
  {
    const context = await newContext(browser, { width: 1440, theme: null });
    const page = await context.newPage();
    for (const pagePath of PAGES) {
      await page.goto(site.url + pagePath, { waitUntil: 'load' });
      await page.emulateMedia({ media: 'print' });
      const facts = await page.evaluate(() => {
        const shown = el => el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true }) && el.getBoundingClientRect().height > 0;
        const hiddenDetails = [...document.querySelectorAll('details')].filter(details => !details.closest('header')).flatMap((details, index) =>
          [...details.children].filter(child => child.tagName !== 'SUMMARY' && !shown(child)).map(() => `details ${index} "${(details.querySelector('summary') || {}).textContent}"`));
        return {
          header: [...document.querySelectorAll('header.mast')].filter(shown).length,
          footer: [...document.querySelectorAll('footer')].filter(shown).length,
          hiddenDetails
        };
      });
      expect(facts.header === 0 && facts.footer === 0, 'print hides header and footer', pagePath, JSON.stringify(facts));
      expect(facts.hiddenDetails.length === 0, 'print shows details content', pagePath, [...new Set(facts.hiddenDetails)].join('; '));
    }
    await context.close();
  }
}

(async () => {
  const site = await startSite(48777);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const backgrounds = new Map();
    for (const pagePath of PAGES) {
      for (const width of WIDTHS) {
        for (const theme of THEMES) await checkPage(browser, site, pagePath, width, theme, backgrounds);
      }
      await checkReveals(browser, site, pagePath);
    }
    for (const pagePath of PAGES) {
      for (const width of WIDTHS) {
        const light = backgrounds.get(`${pagePath}|${width}|light`);
        const dark = backgrounds.get(`${pagePath}|${width}|dark`);
        expect(light && dark && light !== dark, 'themes differ in background', `${pagePath} at ${width}`, `light ${light}, dark ${dark}`);
      }
    }
    await checkSite(browser, site);

    const isKnown = failure => KNOWN_FAILURES.some(key => {
      const [check, page] = key.split('|');
      return check === failure.check && (page === undefined || failure.page === page || failure.page.startsWith(page + ' at '));
    });
    const real = failures.filter(failure => !isKnown(failure));
    const known = failures.filter(isKnown);
    for (const failure of known) console.log(`KNOWN ${failure.check} | ${failure.page} | ${failure.message}`);
    for (const failure of real) console.error(`FAIL ${failure.check} | ${failure.page} | ${failure.message}`);
    assert.equal(real.length, 0, `${real.length} browser checks failed`);
    console.log(`PASS browser: ${PAGES.length} pages, ${WIDTHS.length} widths, 2 themes${known.length ? `, ${known.length} known failures` : ''}`);
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
