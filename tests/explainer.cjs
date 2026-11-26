const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const LABEL = 'An illustration of the research question. The evidence samples are made up for this page. Nothing here is a result or the output of a model.';
const samples = [
  { tab: 'Conditional Access policy export', id: 'PRO-13', name: 'Identity, credential and access management', action: 'Use phishing-resistant MFA for users authenticating to systems, including from untrusted, external or high-risk locations.', domain: 'Identity services' },
  { tab: 'Monitoring agent inventory', id: 'DET-05', name: 'Detection capability efficacy', action: 'Review detection coverage periodically to identify gaps arising from new assets, services or architectural changes.', domain: 'Visibility and response' },
  { tab: 'Incident response plan cover page', id: 'RES-03', name: 'Cyber security incident response', action: 'Use documented, tested and approved cyber security incident response procedures when responding to cyber security incidents.', domain: 'Visibility and response' }
];
const bannedWords = ['delve', 'seamless', 'leverage', 'robust', 'elevate', 'tapestry', 'testament', 'journey', 'crafted', 'passionate', 'cutting-edge', 'game-changer', 'unlock', 'empower', 'meticulous', 'showcase'];
const tokens = { '--paper': '#f3f4ef', '--panel': '#e7eae0', '--ink': '#1d231c', '--muted': '#3f4a3b', '--line': 'rgba(29,35,28,.28)', '--marker': '#dde84a' };

async function open(browser, site, options = {}) {
  const context = await browser.newContext({
    viewport: { width: options.width || 1440, height: 900 },
    reducedMotion: options.reducedMotion || 'no-preference',
    colorScheme: options.theme === 'dark' ? 'dark' : 'light',
    javaScriptEnabled: options.javaScriptEnabled !== false
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push('pageerror: ' + error.message));
  // Images owned by other parts of the page may be missing while it is rebuilt, so only other failed loads count.
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push('console: ' + message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !/\/assets\//.test(response.url())) problems.push('http ' + response.status() + ': ' + response.url()); });
  page.on('requestfailed', request => problems.push('request failed: ' + request.url()));
  await page.goto(site.url + '/');
  if (options.javaScriptEnabled !== false) {
    await page.evaluate(([theme, pins]) => {
      if (theme) document.documentElement.dataset.theme = theme;
      const band = document.querySelector('.research');
      for (const [name, value] of Object.entries(pins)) band.style.setProperty(name, value);
      band.style.background = pins['--marker'];
      band.style.color = pins['--ink'];
    }, [options.theme || '', tokens]);
    await page.evaluate(() => document.fonts.ready);
  }
  return { context, page, problems };
}

(async () => {
  const site = await startSite(48772);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });

    // Label, content and ARIA structure.
    {
      const { context, page, problems } = await open(browser, site);
      const note = page.locator('.explainer .ex-note');
      assert.equal(await note.count(), 1, 'label is present');
      assert.ok(await note.isVisible(), 'label is visible');
      assert.equal((await note.innerText()).replace(/\s+/g, ' ').trim(), LABEL);

      const tablist = page.locator('[role=tablist]');
      assert.equal(await tablist.count(), 1);
      assert.equal(await page.locator('[role=tab]').count(), 3);
      assert.equal(await page.locator('[role=tabpanel]').count(), 3);
      for (let i = 0; i < 3; i++) {
        const tab = page.locator('[role=tab]').nth(i);
        const panel = page.locator('[role=tabpanel]').nth(i);
        assert.equal(await tab.getAttribute('aria-controls'), await panel.getAttribute('id'));
        assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'));
        assert.equal((await tab.innerText()).replace(/\s+/g, ' ').includes(samples[i].tab), true);
        const box = await tab.boundingBox();
        assert.ok(box.height >= 44 && box.width >= 44, 'tab is at least 44px');
      }

      for (let i = 0; i < 3; i++) {
        await page.locator('[role=tab]').nth(i).click();
        for (let j = 0; j < 3; j++) {
          const tab = page.locator('[role=tab]').nth(j);
          const panel = page.locator('[role=tabpanel]').nth(j);
          const on = i === j;
          assert.equal(await tab.getAttribute('aria-selected'), String(on));
          assert.equal(await tab.getAttribute('tabindex'), on ? '0' : '-1');
          assert.equal(await panel.isVisible(), on, 'only the chosen panel is visible');
          assert.equal(await panel.evaluate(el => el.hidden), !on, 'inactive panel is hidden');
          assert.equal(await panel.evaluate(el => getComputedStyle(el).display === 'none'), !on);
        }
        const text = (await page.locator('[role=tabpanel]').nth(i).textContent()).replace(/\s+/g, ' ');
        const s = samples[i];
        assert.ok(text.includes(s.id), `${s.id} shown`);
        assert.ok(text.includes(s.name), `${s.name} shown`);
        assert.ok(text.includes(s.action), `action shown for ${s.id}`);
        assert.ok(text.includes(s.domain), `domain shown for ${s.id}`);
        assert.ok(text.includes('Invented sample'));
        for (const word of ['Coverage', 'Consistency', 'Currency', 'Evidence quality', 'Can be read from the document', 'Cannot be known from this document', 'What a person would check next', 'deployment but not sustained effectiveness']) {
          assert.ok(text.includes(word), `${word} shown for ${s.id}`);
        }
        assert.equal(await page.locator('[role=tabpanel]:not([hidden]) .ex-next li').count() >= 3, true);
        assert.ok(await page.locator('.explainer .ex-note').isVisible(), 'label stays on screen');
      }

      // Tab key goes from the selected tab to its panel, never into hidden panels.
      await page.locator('[role=tab]').nth(0).click();
      await page.locator('[role=tab]').nth(0).focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'tabpanel');
      assert.equal(await page.evaluate(() => document.activeElement.hidden), false);

      // Keyboard.
      const selected = () => page.evaluate(() => [...document.querySelectorAll('[role=tab]')].findIndex(t => t.getAttribute('aria-selected') === 'true'));
      const focused = () => page.evaluate(() => [...document.querySelectorAll('[role=tab]')].findIndex(t => t === document.activeElement));
      await page.locator('[role=tab]').nth(0).focus();
      for (const [key, expected] of [['ArrowRight', 1], ['ArrowRight', 2], ['ArrowRight', 0], ['ArrowLeft', 2], ['Home', 0], ['End', 2], ['ArrowUp', 1], ['ArrowDown', 2]]) {
        await page.keyboard.press(key);
        assert.equal(await selected(), expected, `${key} selects tab ${expected}`);
        assert.equal(await focused(), expected, `${key} moves focus to tab ${expected}`);
        assert.equal(await page.locator('[role=tabpanel]:not([hidden])').count(), 1);
      }
      const outline = await page.locator('[role=tab]').nth(2).evaluate(el => getComputedStyle(el).outlineStyle + ' ' + getComputedStyle(el).outlineWidth);
      assert.notEqual(outline.split(' ')[0], 'none', 'focus is visible');

      // Source rules.
      const stored = await page.evaluate(() => localStorage.length + sessionStorage.length + document.cookie.length);
      assert.equal(stored, 0, 'nothing is stored');
      assert.equal(await page.locator('.explainer [style]').count(), 0, 'no inline style attributes');
      assert.deepEqual(problems, [], 'no console errors');
      await context.close();
    }

    // Requests: switching samples makes no network request.
    {
      const { context, page } = await open(browser, site);
      let requests = 0;
      // Sprite frames and the desk scene load on their own schedule after the page loads; they are not caused by switching.
      page.on('request', request => { if (!request.url().includes('/assets/')) requests++; });
      await page.locator('[role=tab]').nth(1).click();
      await page.keyboard.press('ArrowRight');
      assert.equal(requests, 0, 'no network requests when switching');
      await context.close();
    }

    // Without JavaScript all three samples are readable and stacked.
    {
      const { context, page } = await open(browser, site, { javaScriptEnabled: false });
      assert.equal(await page.locator('[role=tablist]').count(), 0);
      assert.equal(await page.locator('.ex-pick').isVisible(), false);
      assert.ok(await page.locator('.ex-note').isVisible());
      const panels = page.locator('.ex-panel');
      assert.equal(await panels.count(), 3);
      let lastBottom = -1;
      for (let i = 0; i < 3; i++) {
        const panel = panels.nth(i);
        assert.ok(await panel.isVisible(), `sample ${i + 1} visible without script`);
        assert.ok(await panel.locator('.ex-panel-title').isVisible(), 'sample title visible');
        const text = (await panel.textContent()).replace(/\s+/g, ' ');
        const s = samples[i];
        for (const part of [s.id, s.name, s.action, s.domain, 'Invented sample', 'Coverage', 'Evidence quality', 'What a person would check next']) assert.ok(text.includes(part), `${part} readable without script`);
        const box = await panel.boundingBox();
        assert.ok(box.y > lastBottom, 'samples are stacked');
        lastBottom = box.y + box.height - 1;
      }
      await context.close();
    }

    // Print shows all three.
    {
      const { context, page } = await open(browser, site);
      await page.emulateMedia({ media: 'print' });
      for (let i = 0; i < 3; i++) assert.ok(await page.locator('.ex-panel').nth(i).isVisible(), 'print shows every sample');
      assert.equal(await page.locator('.ex-pick').isVisible(), false);
      await context.close();
    }

    // Motion.
    {
      const checks = [['reduce', false], ['no-preference', true]];
      for (const [mode, expectMotion] of checks) {
        const { context, page } = await open(browser, site, { reducedMotion: mode });
        await page.locator('[role=tab]').nth(1).click();
        const animation = await page.locator('.ex-panel').nth(1).evaluate(el => {
          const style = getComputedStyle(el);
          return { name: style.animationName, duration: style.animationDuration };
        });
        if (expectMotion) {
          assert.notEqual(animation.name, 'none', 'transition runs when motion is allowed');
          assert.equal(animation.duration, '0.25s');
        } else {
          assert.equal(animation.name, 'none', 'transition is skipped under reduced motion');
        }
        await context.close();
      }
    }

    // Layout at four widths: the component has no horizontal overflow (the rest of the page is still being rebuilt), with every sample selected, and without script.
    for (const width of [320, 390, 820, 1440]) {
      const { context, page } = await open(browser, site, { width });
      for (let i = 0; i < 3; i++) {
        await page.locator('[role=tab]').nth(i).click();
        const fit = await page.evaluate(() => {
          const right = [...document.querySelectorAll('.explainer *')].filter(el => el.offsetParent && !el.closest('.is-on .ex-panel-title')).reduce((m, el) => Math.max(m, el.getBoundingClientRect().right), 0);
          return { right: right - innerWidth };
        });
        assert.ok(fit.right <= 1, `component overflows at ${width}px, sample ${i + 1}`);
      }
      if (width === 1440) {
        const boxes = await page.evaluate(() => {
          const panel = document.querySelector('.ex-panel:not([hidden])');
          const rect = selector => panel.querySelector(selector).getBoundingClientRect();
          return { doc: rect('.ex-doc'), map: rect('.ex-mapcol') };
        });
        assert.ok(boxes.map.left >= boxes.doc.right, 'wide layout puts the mapping beside the document');
      }
      await context.close();
      const plain = await open(browser, site, { width, javaScriptEnabled: false });
      const overflow = await plain.page.evaluate(() => Math.max(...[...document.querySelectorAll('.explainer *')].filter(el => el.offsetParent).map(el => el.getBoundingClientRect().right)) - innerWidth);
      assert.ok(overflow <= 1, `component overflows at ${width}px without script`);
      await plain.context.close();
    }

    // Accessibility, both themes, every sample.
    const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
    for (const theme of ['light', 'dark']) {
      for (const width of [1440, 390]) {
        const { context, page } = await open(browser, site, { theme, width });
        await page.evaluate(source => (0, eval)(source), axeSource);
        for (let i = 0; i < 3; i++) {
          await page.locator('[role=tab]').nth(i).click();
          await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 350)));
          const violations = await page.evaluate(async () => (await axe.run('.explainer', {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
          })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target.join(' ')) })));
          assert.deepEqual(violations, [], `axe, ${theme} theme, ${width}px, sample ${i + 1}`);
        }
        await context.close();
      }
    }

    // Writing rules: plain ASCII, no banned words, no inline script or storage in the source.
    {
      const { context, page } = await open(browser, site);
      const text = await page.evaluate(() => {
        const el = document.querySelector('.explainer');
        const attrs = [...el.querySelectorAll('*')].flatMap(n => [...n.attributes].map(a => a.value));
        return el.textContent + '\n' + attrs.join('\n');
      });
      const odd = [...text].filter(c => !/[\x20-\x7E\n\r\t]/.test(c));
      assert.deepEqual(odd, [], 'component text must be plain ASCII');
      for (const word of bannedWords) assert.ok(!new RegExp('\\b' + word + '\\b', 'i').test(text), `banned word: ${word}`);
      assert.ok(!/ndash|mdash/i.test(text));
      await context.close();
    }
    for (const file of ['src/partials/explainer.html', 'css/explainer.css', 'js/explainer.js', 'tests/explainer.cjs']) {
      const source = fs.readFileSync(path.join(root, file), 'utf8');
      assert.deepEqual([...source].filter(c => c.charCodeAt(0) > 126), [], `${file} is plain ASCII`);
    }
    const partial = fs.readFileSync(path.join(root, 'src/partials/explainer.html'), 'utf8');
    assert.ok(!/\sstyle\s*=/.test(partial) && !/<script/i.test(partial) && !/\son[a-z]+\s*=/i.test(partial), 'partial has no inline style or script');
    const script = fs.readFileSync(path.join(root, 'js/explainer.js'), 'utf8');
    assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest|localStorage|sessionStorage|eval\(/.test(script), 'script avoids unsafe or networked calls');

    console.log('PASS explainer: label, mappings, tabs, keyboard, no-script, motion, overflow, axe in both themes, writing rules');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
