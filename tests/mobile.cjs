const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

/*
 * Mobile alignment regression suite. "No horizontal overflow" is necessary but not enough, so this also
 * measures what makes small layouts feel deliberate: optical alignment to the margin, touch-sized controls,
 * headline wraps, the responder's placement, disclosure affordances, and diagram legibility.
 */
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.MOBILE_PORT) || 48767;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

const WIDTHS = [320, 360, 390, 430, 768, 820];
const PAGES = ['/', '/work/homelab/', '/work/classquest/', '/work/luna/'];
// 44px is the target; 43 absorbs sub-pixel rounding of full-width display links.
const MIN_TARGET = 43;

/* Helpers injected into the page: visual lines of a text container, grouped by vertical position. */
const helpers = () => {
  window.__lines = element => {
    const rows = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || parseFloat(getComputedStyle(element).fontSize) * 1.2;
    let node;
    while ((node = walker.nextNode())) {
      // Visually hidden separators (clipped to 1px) are not part of the visible wrap.
      if (node.parentElement.closest('.sep') && getComputedStyle(node.parentElement.closest('.sep')).position === 'absolute') continue;
      const re = /\S+/g;
      let match;
      while ((match = re.exec(node.nodeValue))) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const rect = range.getClientRects()[0];
        if (!rect) continue;
        const centre = (rect.top + rect.bottom) / 2;
        const last = rows[rows.length - 1];
        if (!last || Math.abs(centre - last.y) > lineHeight * 0.6) rows.push({ y: centre, words: [match[0]] });
        else last.words.push(match[0]);
      }
    }
    return rows.map(row => row.words);
  };
  // A short single word left alone after a multi-word line ("check?", "path?", "it") reads as a mistake.
  window.__stranded = lines => lines.length > 1 && lines[lines.length - 1].length === 1 && lines[lines.length - 1][0].length <= 7 && lines[lines.length - 2].length >= 2;
  window.__visible = element => {
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  };
};

async function load(browser, route, width, colorScheme) {
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 1180 }, colorScheme,
    hasTouch: width <= 850, reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin + route);
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: `(${helpers})()` });
  await page.evaluate(async () => {
    const height = document.documentElement.scrollHeight;
    for (let y = 0; y < height; y += 500) { window.scrollTo(0, y); await new Promise(resolve => setTimeout(resolve, 30)); }
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
    window.scrollTo(0, 0);
  });
  return { context, page, errors };
}

/* ---- checks shared by every page ---- */
async function checkEveryPage(page, label, width) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);

  // The skip link must stay out of view until it receives focus.
  assert.ok(await page.locator('.skip').evaluate(element => element.getBoundingClientRect().bottom <= 0), `${label}: skip link visible without focus`);

  // Touch-sized, standalone controls. Inline links inside running text, heading links and image links are exempt.
  const small = await page.evaluate(min => [...document.querySelectorAll('a[href], button, summary, input, [role="button"]')]
    .filter(window.__visible)
    .filter(element => !element.matches('.skip, .project-art > a, .case-media a') && !element.closest('h1, h2, h3'))
    .filter(element => !(getComputedStyle(element).display === 'inline' && element.closest('p, li, figcaption, dd')))
    .map(element => {
      // The effective hit area includes an absolutely positioned ::after that extends the control.
      const pseudo = getComputedStyle(element, '::after');
      const extended = pseudo.position === 'absolute' ? parseFloat(pseudo.height) || 0 : 0;
      return { name: (element.textContent || element.getAttribute('aria-label') || element.tagName).trim().slice(0, 40), height: Math.max(element.getBoundingClientRect().height, extended) };
    })
    .filter(item => item.height < min), MIN_TARGET);
  assert.deepEqual(small, [], `${label}: controls under ${MIN_TARGET}px tall`);

  // Header: both controls share one height; the brand link is touch-sized even at 320px.
  const header = await page.evaluate(() => {
    const height = selector => document.querySelector(selector).getBoundingClientRect().height;
    const border = selector => parseFloat(getComputedStyle(document.querySelector(selector)).borderTopWidth);
    return { brand: height('.brand'), night: height('.theme-toggle'), menu: height('.mobile-menu > summary'), nightBorder: border('.theme-toggle'), menuBorder: border('.mobile-menu > summary') };
  });
  assert.ok(header.brand >= MIN_TARGET, `${label}: brand link ${header.brand}px`);
  assert.ok(Math.abs(header.night - header.menu) <= 1, `${label}: Night (${header.night}) and Menu (${header.menu}) differ in height`);
  assert.ok(header.menu >= MIN_TARGET && header.menuBorder === header.nightBorder, `${label}: Menu control styling`);

  // The open menu is reachable and every link is touch-sized.
  await page.locator('.mobile-menu > summary').click();
  const menuLinks = await page.locator('.mobile-menu nav a').evaluateAll(links => links.map(link => link.getBoundingClientRect()));
  assert.equal(menuLinks.length, 5, `${label}: menu links`);
  assert.ok(menuLinks.every(box => box.height >= MIN_TARGET && box.left >= 0 && box.right <= width), `${label}: menu link geometry`);
  await page.keyboard.press('Escape');
}

/* ---- homepage ---- */
async function checkHome(page, label, width) {
  const phone = width <= 600;
  const inkGeometry = await page.evaluate(() => {
    const responder = document.querySelector('.hero-responder');
    const box = responder.getBoundingClientRect();
    const hero = document.querySelector('.hero');
    const contentRight = hero.getBoundingClientRect().right - parseFloat(getComputedStyle(hero).paddingRight);
    // The idle sheet's visible pixels are x 42..91, y 5..123 of a 128px frame.
    const ink = { left: box.left + box.width * 42 / 128, right: box.left + box.width * 91 / 128, top: box.top + box.height * 5 / 128, bottom: box.top + box.height * 123 / 128 };
    const overlaps = [];
    const walker = document.createTreeWalker(hero, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.nodeValue.trim() || node.parentElement.closest('.hero-responder')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width > 0 && Math.min(rect.right, ink.right) - Math.max(rect.left, ink.left) > 2 && Math.min(rect.bottom, ink.bottom) - Math.max(rect.top, ink.top) > 2) overlaps.push(node.nodeValue.trim().slice(0, 30));
      }
    }
    const note = document.querySelector('.current-note').getBoundingClientRect();
    const intro = document.querySelector('.hero-intro').getBoundingClientRect();
    return { gap: contentRight - ink.right, overlaps, bottomVsNote: ink.bottom - note.bottom, bottomVsIntro: ink.bottom - intro.bottom, scrollWidth: document.documentElement.scrollWidth, innerWidth };
  });
  assert.ok(Math.abs(inkGeometry.gap) <= 1.5, `${label}: responder ink is ${inkGeometry.gap.toFixed(1)}px from the right margin`);
  assert.deepEqual(inkGeometry.overlaps, [], `${label}: responder overlaps text`);
  if (phone) assert.ok(Math.abs(inkGeometry.bottomVsNote) <= 3, `${label}: responder does not stand on the Currently row (${inkGeometry.bottomVsNote}px)`);
  if (phone) {
    // The employer link stays on one line at default text size (a wrapped link is 60px+ tall).
    const linkHeight = await page.locator('.current-note a').evaluate(link => link.getBoundingClientRect().height);
    assert.ok(linkHeight < 50, `${label}: the Currently link wraps (${linkHeight.toFixed(0)}px tall)`);
  }
  else assert.ok(Math.abs(inkGeometry.bottomVsIntro) <= 8, `${label}: responder does not stand on the intro baseline (${inkGeometry.bottomVsIntro}px)`);

  // Big numerals use negative tracking; their painted glyphs must not pass the right margin on phones.
  if (phone) {
    const overshoot = await page.evaluate(() => [...document.querySelectorAll('.project-number')].map(element => {
      const style = getComputedStyle(element);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      canvas.letterSpacing = style.letterSpacing;
      const metrics = canvas.measureText(element.textContent.trim());
      const shell = element.closest('.shell');
      const contentRight = shell.getBoundingClientRect().right - parseFloat(getComputedStyle(shell).paddingRight);
      return element.getBoundingClientRect().left + metrics.actualBoundingBoxRight - contentRight;
    }));
    assert.ok(overshoot.every(value => value <= 1), `${label}: numeral overshoot ${overshoot.map(value => value.toFixed(1))}`);
  }

  // Hero facts stack on phones instead of breaking at a slash.
  if (phone) {
    const stacked = await page.evaluate(() => {
      const eyebrow = document.querySelector('.hero-meta .eyebrow');
      const first = document.createRange(); first.selectNodeContents(eyebrow.firstChild);
      const last = document.createRange(); last.selectNodeContents(eyebrow.lastChild);
      return last.getBoundingClientRect().top >= first.getBoundingClientRect().bottom - 2 && !/^\s*\//.test(eyebrow.lastChild.nodeValue);
    });
    assert.ok(stacked, `${label}: hero facts do not stack`);
  }

  // Project and experiment labels: segments stack up to tablet, and no line starts or ends on a separator.
  const eyebrows = await page.evaluate(() => [...document.querySelectorAll('.project-copy .eyebrow, .experiment .eyebrow')].map(element => {
    const segments = [...element.querySelectorAll('.seg')];
    const tops = segments.map(segment => segment.getBoundingClientRect().top);
    return { stacked: tops[1] > tops[0] + 4, sepHidden: getComputedStyle(element.querySelector('.sep')).position === 'absolute', dangling: window.__lines(element).some(line => /^[/·]$/.test(line[0]) || /^[/·]$/.test(line[line.length - 1])) };
  }));
  assert.equal(eyebrows.length, 4, `${label}: project labels`);
  if (width <= 850) assert.ok(eyebrows.every(item => item.stacked && item.sepHidden), `${label}: project label segments should stack`);
  assert.ok(eyebrows.every(item => !item.dangling), `${label}: project label wraps on a separator`);

  // Interests: a tidy two-column grid on phones; each topic stays on one line everywhere.
  const interests = await page.evaluate(() => {
    const topics = [...document.querySelectorAll('.interest-topics > span:not(.sep)')];
    const grid = getComputedStyle(document.querySelector('.interest-topics')).display;
    return { count: topics.length, grid, split: topics.filter(topic => topic.getClientRects().length > 1).map(topic => topic.textContent), sepsHidden: [...document.querySelectorAll('.interest-topics .sep')].every(sep => getComputedStyle(sep).display === 'none') };
  });
  assert.equal(interests.count, 5);
  assert.deepEqual(interests.split, [], `${label}: interest topic split across lines`);
  if (phone) assert.ok(interests.grid === 'grid' && interests.sepsHidden, `${label}: interests grid`);

  // Headlines: balanced phrases never strand a word or end a line on "&".
  const headlines = await page.evaluate(() => [...document.querySelectorAll('.note-grid h2 .hl, .experience h2 .hl')].map(block => {
    const lines = window.__lines(block);
    return { text: lines.map(line => line.join(' ')).join(' / '), badEnd: lines.slice(0, -1).some(line => line[line.length - 1] === '&'), stranded: window.__stranded(lines) };
  }));
  assert.equal(headlines.length, 4, `${label}: balanced headline phrases`);
  for (const item of headlines) {
    assert.ok(!item.badEnd, `${label}: headline line ends on "&": ${item.text}`);
    assert.ok(!item.stranded, `${label}: headline strands a word: ${item.text}`);
  }

  // One disclosure language: +/- markers, no outbound arrow on a disclosure, 44px rows on small screens.
  const disclosures = await page.evaluate(() => ['.offshift', '.background-index', '.resume-note'].map(selector => {
    const details = document.querySelector(selector);
    const summary = details.querySelector(':scope > summary');
    const closed = getComputedStyle(summary, '::after').content;
    details.open = true;
    const open = getComputedStyle(summary, '::after').content;
    details.open = false;
    return { selector, closed, open, arrow: /↗/.test(summary.textContent), height: summary.getBoundingClientRect().height };
  }));
  for (const item of disclosures) {
    assert.deepEqual([item.closed, item.open, item.arrow], ['"+"', '"−"', false], `${label}: ${item.selector} marker`);
    if (width <= 850) assert.ok(item.height >= MIN_TARGET, `${label}: ${item.selector} summary ${item.height}px`);
  }

  // Terminal invitation and layout on phones.
  if (phone) {
    const terminal = await page.evaluate(() => {
      const summary = document.querySelector('.terminal-disclosure > summary');
      const invite = summary.querySelector('.terminal-invite');
      const before = invite.getBoundingClientRect();
      const row = summary.getBoundingClientRect();
      return { inviteWidth: before.width, summaryWidth: row.width, inviteHeight: before.height, floated: getComputedStyle(document.querySelector('.terminal-layout .responder')).float };
    });
    assert.ok(terminal.inviteWidth >= terminal.summaryWidth - 1 && terminal.inviteHeight >= 44, `${label}: terminal invitation row`);
    assert.equal(terminal.floated, 'none', `${label}: terminal responder should be a grid cell, not a float`);
    await page.locator('.terminal-disclosure > summary').click();
    await page.locator('.terminal-section').scrollIntoViewIfNeeded();
    const open = await page.evaluate(() => {
      const layout = document.querySelector('.terminal-layout > div:first-child');
      const heading = layout.querySelector('h3').getBoundingClientRect();
      const responder = layout.querySelector('.responder').getBoundingClientRect();
      const paragraph = layout.querySelector('p').getBoundingClientRect();
      const small = (selector) => [...document.querySelectorAll(selector)].filter(window.__visible).map(element => element.getBoundingClientRect().height);
      const columns = getComputedStyle(layout).gridTemplateColumns.split(' ').map(parseFloat);
      const widths = [...layout.children].filter(window.__visible).map(child => child.getBoundingClientRect().width);
      return { columns, heightOfHeading: heading.height, headingWidth: heading.width, widest: Math.max(...widths), sideBySide: Math.abs(heading.bottom - responder.bottom) < 40, below: paragraph.top >= heading.bottom - 1, targets: small('.terminal-input-row input, .terminal-input-row button, .terminal-shortcuts button'), marker: getComputedStyle(document.querySelector('.terminal-invite > span'), '::after').content };
    });
    assert.ok(open.sideBySide && open.below, `${label}: terminal heading and responder layout`);
    // The text column keeps its width: the heading is a few lines, not one letter per line.
    assert.ok(open.headingWidth >= 120 && open.heightOfHeading <= 120 && open.columns[0] > open.columns[1], `${label}: terminal text column collapsed (${open.columns}, heading ${open.headingWidth}x${open.heightOfHeading})`);
    assert.ok(open.targets.length === 6 && open.targets.every(height => height >= MIN_TARGET), `${label}: terminal controls ${open.targets}`);
    assert.equal(open.marker, '"−"', `${label}: terminal marker when open`);
  }
}

/* ---- case studies ---- */
async function checkCase(page, route, label, width) {
  const phone = width <= 600;
  // The italic dek never ends on a single stranded word.
  const dek = await page.locator('.case-dek').evaluate(element => { const lines = window.__lines(element); return { text: lines.map(line => line.join(' ')).join(' / '), stranded: window.__stranded(lines) }; });
  assert.ok(!dek.stranded, `${label}: dek ends on one stranded word: ${dek.text}`);

  if (route === '/work/homelab/') {
    const diagram = await page.evaluate(() => {
      const wide = document.querySelector('.diagram-wide');
      const narrow = document.querySelector('.diagram-narrow');
      const region = document.querySelector('[data-telemetry-flow]');
      const visible = element => getComputedStyle(element).display !== 'none';
      const shown = visible(narrow) ? narrow : wide;
      const scale = shown.getScreenCTM().a;
      const texts = [...shown.querySelectorAll('text')].map(text => parseFloat(getComputedStyle(text).fontSize) * scale);
      const nodes = [...shown.querySelectorAll('rect.dnode')].map(rect => rect.getBoundingClientRect());
      return {
        wideVisible: visible(wide), narrowVisible: visible(narrow), nodeCount: nodes.length,
        nodesInside: nodes.every(box => box.left >= 0 && box.right <= innerWidth),
        fits: region.scrollWidth <= region.clientWidth + 1, minText: Math.min(...texts),
        tabindex: region.getAttribute('tabindex'), packets: document.querySelectorAll('[data-flow-packet]').length
      };
    });
    assert.equal(diagram.packets, 3, `${label}: telemetry packets retained`);
    assert.equal(diagram.nodeCount, 4);
    if (phone) {
      assert.deepEqual([diagram.wideVisible, diagram.narrowVisible], [false, true], `${label}: phone diagram variant`);
      assert.ok(diagram.fits && diagram.nodesInside, `${label}: all four nodes visible without sideways scrolling`);
      assert.ok(diagram.minText >= 9.5, `${label}: diagram text renders at ${diagram.minText.toFixed(1)}px`);
      assert.equal(diagram.tabindex, null, `${label}: nothing to scroll, so no focus stop`);
    } else {
      assert.deepEqual([diagram.wideVisible, diagram.narrowVisible], [true, false], `${label}: wide diagram variant`);
      assert.equal(diagram.tabindex, '0');
    }
    // The condensed example headline never strands "check?".
    const example = await page.locator('#example h2 .hl').evaluateAll(blocks => blocks.map(block => ({ text: window.__lines(block).map(line => line.join(' ')).join(' / '), stranded: window.__stranded(window.__lines(block)) })));
    assert.equal(example.length, 2, `${label}: example headline uses balanced phrases`);
    assert.ok(example.every(item => !item.stranded), `${label}: example headline wrap ${JSON.stringify(example)}`);
  }

  if (route === '/work/luna/') {
    const figure = await page.locator('.figure-open').evaluate(link => ({ shown: getComputedStyle(link).display !== 'none', height: link.getBoundingClientRect().height, href: link.getAttribute('href'), target: link.target, rel: link.rel }));
    assert.equal(figure.shown, phone, `${label}: full-size diagram link visibility`);
    if (phone) assert.ok(figure.height >= MIN_TARGET && figure.target === '_blank' && /noopener/.test(figure.rel), `${label}: full-size link`);
    const response = await page.request.get(new URL(figure.href, page.url()).href);
    assert.equal(response.status(), 200, `${label}: full-size diagram resolves`);
  }

  if (route === '/work/classquest/') {
    await page.locator('#upload-decision').scrollIntoViewIfNeeded();
    const title = await page.locator('#upload-title .hl').evaluateAll(blocks => blocks.map(block => ({ text: window.__lines(block).map(line => line.join(' ')).join(' / '), stranded: window.__stranded(window.__lines(block)) })));
    assert.equal(title.length, 2, `${label}: decision headline uses balanced phrases`);
    assert.ok(title.every(item => !item.stranded), `${label}: decision headline wrap ${JSON.stringify(title)}`);
    const labels = await page.locator('.upload-controls button').evaluateAll(buttons => buttons.map(button => {
      const text = [...button.childNodes].find(node => node.nodeType === 3);
      const range = document.createRange(); range.selectNodeContents(text);
      const lines = window.__lines(button).filter(line => !/^\d\d$/.test(line.join('')));
      return { text: lines.map(line => line.join(' ')).join(' / '), stranded: window.__stranded(lines), height: button.getBoundingClientRect().height };
    }));
    for (const item of labels) {
      assert.ok(!item.stranded, `${label}: decision label strands a word: ${item.text}`);
      assert.ok(item.height >= MIN_TARGET);
    }
  }

  // Case navigation targets (breadcrumb, section index, next/previous) are touch-sized on small screens.
  if (width <= 850) {
    const nav = await page.evaluate(() => [...document.querySelectorAll('.crumb a, .case-index a, .next-case a, .case-contact > a')].map(link => link.getBoundingClientRect().height));
    assert.ok(nav.length >= 8 && nav.every(height => height >= MIN_TARGET), `${label}: case navigation targets ${nav}`);
  }
}

(async () => {
  let browser;
  let scans = 0;
  try {
    await ready;
    browser = await chromium.launch({
      headless: true,
      ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
    });

    for (const colorScheme of ['light', 'dark']) {
      for (const width of WIDTHS) {
        for (const route of PAGES) {
          const label = `${route} ${width}px ${colorScheme}`;
          const { context, page, errors } = await load(browser, route, width, colorScheme);
          await checkEveryPage(page, label, width);
          if (route === '/') await checkHome(page, label, width);
          else await checkCase(page, route, label, width);
          assert.deepEqual(errors, [], `${label}: page errors`);
          await context.close();
          scans += 1;
        }
      }
    }

    // Desktop contract: a fine pointer at desktop widths keeps the original, un-expanded layout.
    for (const colorScheme of ['light', 'dark']) {
      const { context, page } = await load(browser, '/', 1440, colorScheme);
      const desktop = await page.evaluate(() => ({
        sprite: getComputedStyle(document.querySelector('.hero-responder')).position,
        eyebrowStacked: document.querySelector('.project-lab .eyebrow .seg').getBoundingClientRect().top < document.querySelector('.project-lab .eyebrow .seg:last-child').getBoundingClientRect().top - 4,
        menuHidden: getComputedStyle(document.querySelector('.mobile-menu')).display === 'none',
        wideDiagramOnly: true
      }));
      assert.equal(desktop.sprite, 'relative', 'Desktop hero responder keeps its three-column placement');
      assert.equal(desktop.eyebrowStacked, false, 'Desktop project labels stay inline');
      assert.ok(desktop.menuHidden, 'Desktop keeps the full navigation');
      await context.close();
      const lab = await load(browser, '/work/homelab/', 1440, colorScheme);
      assert.equal(await lab.page.locator('.diagram-narrow').evaluate(element => getComputedStyle(element).display), 'none', 'Desktop keeps the wide diagram');
      await lab.context.close();
      scans += 2;
    }
    console.log(`PASS: ${scans} mobile alignment scenarios across 320, 360, 390, 430, 768 and 820px in light and dark: margin alignment, touch targets, wraps, responder, disclosures, diagrams and the desktop contract.`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
