const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { startSite } = require('./helpers/site.cjs');

const PAGES = ['/', '/404.html', '/research/', '/work/homelab/', '/work/classquest/', '/work/luna/', '/work/competitions/'];
const WIDTHS = [320, 360, 390, 430, 768, 820];
const THEMES = ['light', 'dark'];
const MIN_TARGET = 44;

// Known site defects. Each entry is "<check>" or "<check>|<page>". Remove an entry once the site is fixed.
// Format "<check>|<page>|<text the message must contain>". A page matches exactly or with " at <width> <theme>" after it.
const KNOWN_FAILURES = [];

const failures = [];
function expect(ok, check, page, message) {
  if (!ok) failures.push({ check, page, message });
}

// Runs in the page. Returns facts about layout, targets, headings and text size.
const measure = ({ minTarget }) => {
  const describe = el => {
    let text = el.tagName.toLowerCase();
    if (el.id) text += '#' + el.id;
    if (el.classList.length) text += '.' + [...el.classList].slice(0, 3).join('.');
    return text;
  };
  const shown = el => el.checkVisibility({ checkVisibilityCSS: true }) && el.getBoundingClientRect().width > 1 && el.getBoundingClientRect().height > 1;
  const clippedByAncestor = el => {
    for (let node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflowX !== 'visible') return true;
    }
    return false;
  };
  const sizeOf = el => el.getBoundingClientRect();

  const wide = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('.skip') || el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (!el.checkVisibility({ checkVisibilityCSS: true })) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1) continue;
    if (rect.width > innerWidth + 0.5 || rect.right > innerWidth + 1 || rect.left < -1) {
      if (!clippedByAncestor(el)) wide.push(`${describe(el)} left ${rect.left.toFixed(1)} right ${rect.right.toFixed(1)} width ${rect.width.toFixed(1)}`);
    }
  }

  const runningParents = new Set(['P', 'LI', 'DD', 'FIGCAPTION', 'SPAN']);
  const small = [];
  for (const el of document.querySelectorAll('a, button, summary, input, [role="tab"]')) {
    if (el.closest('.skip') || !shown(el)) continue;
    if (el.closest('details:not([open]) > :not(summary)')) continue;
    const parent = el.parentElement;
    const own = (el.textContent || '').trim();
    const around = parent ? (parent.textContent || '').trim() : '';
    if (el.tagName === 'A' && parent && runningParents.has(parent.tagName) && around.length > own.length + 3) continue;
    const rect = sizeOf(el);
    if (rect.width < minTarget - 0.5 || rect.height < minTarget - 0.5) {
      small.push({ selector: describe(el), text: (own || el.getAttribute('aria-label') || '').slice(0, 40), width: +rect.width.toFixed(1), height: +rect.height.toFixed(1) });
    }
  }

  const clipped = [...document.querySelectorAll('h1, h2, h3')].filter(shown)
    .filter(el => el.scrollWidth > el.clientWidth + 1)
    .map(el => `${describe(el)} scrollWidth ${el.scrollWidth} clientWidth ${el.clientWidth}`);

  const bodySize = parseFloat(getComputedStyle(document.body).fontSize);
  const smallText = [...document.querySelectorAll('main p')].filter(shown)
    .filter(el => (el.textContent || '').trim().length >= 60 && parseFloat(getComputedStyle(el).fontSize) < 15)
    .map(el => `${describe(el)} ${getComputedStyle(el).fontSize}`);

  const h1 = document.querySelector('h1').getBoundingClientRect();
  return {
    scrollWidth: document.documentElement.scrollWidth, innerWidth, wide: wide.slice(0, 5), small, clipped, bodySize, smallText,
    h1: { left: +h1.left.toFixed(1), right: +h1.right.toFixed(1) }
  };
};

async function checkPage(browser, site, pagePath, width, theme) {
  const label = `${pagePath} at ${width} ${theme}`;
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1024 }, hasTouch: true, isMobile: width < 600,
    reducedMotion: 'reduce', colorScheme: 'light'
  });
  await context.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
  try {
    const page = await context.newPage();
    await page.goto(site.url + pagePath, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const facts = await page.evaluate(measure, { minTarget: MIN_TARGET });

    expect(facts.scrollWidth <= facts.innerWidth, 'no horizontal overflow', label, `scrollWidth ${facts.scrollWidth} > innerWidth ${facts.innerWidth}`);
    expect(facts.wide.length === 0, 'no element wider than the viewport', label, facts.wide.join('; '));
    const worst = facts.small.sort((a, b) => Math.min(a.width, a.height) - Math.min(b.width, b.height));
    expect(worst.length === 0, 'touch targets 44 by 44', label,
      `${worst.length} too small, worst: ` + worst.slice(0, 4).map(t => `${t.selector} "${t.text}" ${t.width}x${t.height}`).join('; '));
    expect(facts.clipped.length === 0, 'headings not clipped', label, facts.clipped.join('; '));
    expect(facts.bodySize >= 15, 'body text size', label, `body font-size ${facts.bodySize}px`);
    expect(facts.smallText.length === 0, 'paragraph text at least 15px', label, facts.smallText.slice(0, 4).join('; '));
    expect(facts.h1.left >= 0 && facts.h1.right <= width, 'h1 inside the viewport', label, `h1 spans ${facts.h1.left} to ${facts.h1.right}`);

    if (width <= 900) {
      const menu = page.locator('details.menu');
      expect(await menu.isVisible(), 'mobile menu is shown', label, 'details.menu is not visible');
      await menu.locator('summary').tap();
      const open = await page.evaluate(() => document.querySelector('details.menu').open);
      expect(open, 'mobile menu opens by tap', label, 'details.menu did not open');
      const links = await page.$$eval('nav[aria-label="Mobile"] a', anchors => anchors.map(a => {
        const rect = a.getBoundingClientRect();
        return { text: a.textContent.trim(), height: +rect.height.toFixed(1), visible: a.checkVisibility({ checkVisibilityCSS: true }) && rect.width > 1 };
      }));
      expect(links.length > 0 && links.every(link => link.visible), 'mobile menu shows its links', label, JSON.stringify(links.filter(link => !link.visible)));
      expect(links.every(link => link.height >= MIN_TARGET), 'mobile menu links 44px tall', label,
        links.filter(link => link.height < MIN_TARGET).map(link => `${link.text} ${link.height}`).join('; '));
    }

    if (pagePath === '/' && width === 390) {
      const home = await page.evaluate(() => {
        const section = document.querySelector('#competitions');
        const h1 = document.querySelector('h1').getBoundingClientRect();
        const resume = [...document.querySelectorAll('a[href$=".pdf"]')].filter(a => a.checkVisibility({ checkVisibilityCSS: true }) && a.getBoundingClientRect().width > 1)
          .map(a => a.getBoundingClientRect()).filter(rect => rect.top >= 0 && rect.bottom <= 844);
        return { competitions: section ? Math.round(section.getBoundingClientRect().height) : null, h1Top: h1.top, h1Bottom: h1.bottom, resume: resume.length };
      });
      expect(home.competitions !== null && home.competitions <= 840, '#competitions height', label, `height ${home.competitions}px, limit 840px`);
      expect(home.h1Top >= 0 && home.h1Bottom <= 844, 'h1 in the first screen', label, `h1 spans ${home.h1Top} to ${home.h1Bottom}`);
      expect(home.resume > 0, 'resume link in the first screen', label, 'no visible resume link within the top 844px');
    }
  } finally {
    await context.close();
  }
}

async function checkDesktop(browser, site) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    for (const pagePath of PAGES) {
      await page.goto(site.url + pagePath, { waitUntil: 'load' });
      const facts = await page.evaluate(() => ({
        nav: document.querySelector('nav[aria-label="Main"]').checkVisibility({ checkVisibilityCSS: true }),
        menu: document.querySelector('details.menu').checkVisibility({ checkVisibilityCSS: true }),
        scrollWidth: document.documentElement.scrollWidth, innerWidth
      }));
      expect(facts.nav, 'desktop main navigation visible', pagePath + ' at 1440', 'nav[aria-label="Main"] is hidden');
      expect(!facts.menu, 'desktop mobile menu hidden', pagePath + ' at 1440', 'details.menu is visible');
      expect(facts.scrollWidth <= facts.innerWidth, 'desktop no overflow', pagePath + ' at 1440', `scrollWidth ${facts.scrollWidth} > ${facts.innerWidth}`);
    }
  } finally {
    await context.close();
  }
}

(async () => {
  const site = await startSite(48778);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const pagePath of PAGES) {
      for (const width of WIDTHS) {
        for (const theme of THEMES) await checkPage(browser, site, pagePath, width, theme);
      }
    }
    await checkDesktop(browser, site);

    const isKnown = failure => KNOWN_FAILURES.some(key => {
      const [check, page, text] = key.split('|');
      return check === failure.check && (page === undefined || failure.page === page || failure.page.startsWith(page + ' at ')) && (text === undefined || failure.message.includes(text));
    });
    const real = failures.filter(failure => !isKnown(failure));
    const known = failures.filter(isKnown);
    for (const failure of known) console.log(`KNOWN ${failure.check} | ${failure.page} | ${failure.message}`);
    for (const failure of real) console.error(`FAIL ${failure.check} | ${failure.page} | ${failure.message}`);
    assert.equal(real.length, 0, `${real.length} mobile checks failed`);
    console.log(`PASS mobile: ${PAGES.length} pages, ${WIDTHS.length} widths, 2 themes${known.length ? `, ${known.length} known failures` : ''}`);
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
