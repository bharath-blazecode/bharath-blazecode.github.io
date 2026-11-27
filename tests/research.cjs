// Research page at /research/. Run: node tests/research.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const axeText = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const TITLE = 'AI Cyber Risk Assessment Research';
const QUESTION = 'Can AI help assess cyber risk?';
const WORK = 'Exploring how large language models can analyse security evidence against the ASD Essentials, the Australian Signals Directorate’s framework that succeeds the Essential Eight.';
const CONCERN = 'Helping design and evaluate experiments to test how far AI-based assessments can be trusted.';
const CREDITS = 'Supervised by Dr Gowri Sankar Ramachandran at QUT, with Kat McCrabb of Flame Tree Cyber as external supervisor. Atticus D’Mello is the QUT contact for the project.';
const STATEMENT = 'This is a question I am working on, not a finding. There are no results to report yet.';
const EXPLAINER_LABEL = 'An illustration of the research question. The evidence samples are made up for this page. Nothing here is a result or the output of a model.';
const QUT = 'https://www.qut.edu.au/research/study-with-us/vacation-research-experience-scheme-student-topics/vres/can-ai-be-your-security-consultant-exploring-cyber-risk-assessment-with-llms';
const tidy = text => text.replace(/\s+/g, ' ').trim();

async function open(browser, url, { width = 1440, theme = 'light', reducedMotion = 'reduce', javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, javaScriptEnabled, hasTouch: width <= 820 });
  if (javaScriptEnabled) await context.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push('page error: ' + error.message));
  page.on('console', message => { if (message.type() === 'error' || /Content Security Policy/i.test(message.text())) problems.push('console: ' + message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, problems };
}

async function scrollThrough(page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 700) {
    await page.evaluate(top => window.scrollTo(0, top), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

(async () => {
  const site = await startSite(48782);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const url = `${site.url}/research/`;

    // Content, structure and policy.
    {
      const { page, context, problems } = await open(browser, url);
      assert.equal(await page.locator('h1').count(), 1, 'one h1');
      assert.equal(tidy(await page.locator('h1').innerText()), TITLE, 'h1 is the role title');
      assert.equal(await page.locator('main#main').count(), 1, 'main landmark');
      assert.match(await page.title(), new RegExp('^' + TITLE));
      const text = tidy(await page.locator('main').innerText());
      for (const [name, wording] of [['question', QUESTION], ['work', WORK], ['concern', CONCERN], ['credits', CREDITS], ['statement', STATEMENT]]) {
        assert.ok(text.includes(wording), `${name} wording is present`);
      }
      assert.equal(tidy(await page.locator('.explainer .ex-note').innerText()), EXPLAINER_LABEL, 'explainer label');
      assert.equal(await page.locator('[role=tab]').count(), 3, 'explainer tabs');
      for (const label of ['Kind', 'Status', 'Dates', 'Framework', 'With']) assert.ok(await page.locator('.facts dt', { hasText: new RegExp('^' + label + '$') }).count() === 1, `fact: ${label}`);
      assert.match(tidy(await page.locator('.facts').innerText()), /Nov 2026 to present/);

      const link = page.locator(`a[href="${QUT}"]`);
      assert.equal(await link.count(), 1, 'QUT listing link');
      assert.ok((await link.getAttribute('class')).split(' ').includes('ext'));
      assert.equal(tidy(await link.locator('.sr-only').innerText()), '(external site)');
      assert.equal(await page.locator('.rs-band .reveal').count() > 0, true, 'sections reveal');
      assert.equal(await page.locator('a[href="../#work"]').count() >= 1, true, 'link back to Selected work');
      assert.equal(await page.locator('a[href="mailto:barry.sampath@outlook.com"]').count() >= 1, true, 'email link');
      assert.equal(await page.locator('[style]').count(), 0, 'no inline style attributes');
      assert.equal(await page.locator('main [onclick], main script').count(), 0, 'no inline handlers or scripts in main');
      const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
      assert.equal(ld.name, TITLE, 'JSON-LD names the role');
      assert.equal(await page.evaluate(() => /Content-Security-Policy/i.test(document.querySelector('meta[http-equiv]')?.httpEquiv || '')), true, 'policy is present');
      await scrollThrough(page);
      assert.deepEqual(problems, [], 'no console errors or policy violations');
      await context.close();
    }

    // Writing rules for the page text.
    {
      const source = fs.readFileSync(path.join(root, 'src/pages/research/index.html'), 'utf8');
      const visible = source.replace(/<!-- @include explainer -->/, '');
      const banned = ['delve', 'seamless', 'leverage', 'robust', 'elevate', 'tapestry', 'testament', 'journey', 'crafted', 'passionate', 'cutting-edge', 'game-changer', 'unlock', 'empower', 'meticulous', 'showcase'];
      for (const word of banned) assert.ok(!new RegExp('\\b' + word + '\\b', 'i').test(visible), `banned word: ${word}`);
      assert.ok(!/[–—→·…✓×]/.test(visible), 'no dashes, arrows, middle dots, ellipses, ticks or multiplication signs');
      assert.ok(!/ndash|mdash/i.test(visible));
      assert.ok(!/Essential Eight/.test(visible.replace('succeeds the Essential Eight', '')), 'the framework is not called the Essential Eight');
    }

    // No horizontal overflow.
    for (const width of [320, 390, 820, 1440]) {
      const { page, context } = await open(browser, url, { width });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow at ${width}px`);
      const right = await page.evaluate(() => Math.max(...[...document.querySelectorAll('main *')].filter(el => el.offsetParent && !el.closest('.is-on .ex-panel-title')).map(el => el.getBoundingClientRect().right)) - innerWidth);
      assert.ok(right <= 1, `an element runs past the edge at ${width}px`);
      await context.close();
    }

    // Accessibility in both themes.
    for (const theme of ['light', 'dark']) {
      for (const width of [1440, 390]) {
        const { page, context } = await open(browser, url, { width, theme });
        await scrollThrough(page);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), theme === 'dark', `${theme} theme applied`);
        await context.close();
        // Axe runs in a context that bypasses the page policy, for this check only.
        const bypass = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', bypassCSP: true });
        await bypass.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
        const axePage = await bypass.newPage();
        await axePage.goto(url);
        await axePage.evaluate(() => document.fonts.ready);
        await scrollThrough(axePage);
        await axePage.addScriptTag({ content: axeText });
        const violations = await axePage.evaluate(async rules => (await axe.run(document, { runOnly: { type: 'tag', values: rules } }))
          .violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target.join(' ')) })), RULES);
        assert.deepEqual(violations, [], `axe, ${theme} theme, ${width}px`);
        await bypass.close();
      }
    }

    // Without JavaScript everything is readable.
    {
      const { page, context } = await open(browser, url, { javaScriptEnabled: false });
      for (const selector of ['h1', '.facts', '.rs-thread', '.rs-credits', '.rs-status', '.explainer .ex-note']) assert.ok(await page.locator(selector).first().isVisible(), `${selector} visible without script`);
      const text = tidy(await page.locator('main').innerText());
      for (const wording of [QUESTION, WORK, CONCERN, CREDITS, STATEMENT]) assert.ok(text.includes(wording), 'wording readable without script');
      for (let i = 0; i < 3; i++) assert.ok(await page.locator('.ex-panel').nth(i).isVisible(), `sample ${i + 1} visible without script`);
      await context.close();
    }

    // Print shows everything.
    {
      const { page, context } = await open(browser, url);
      await page.emulateMedia({ media: 'print' });
      for (const selector of ['h1', '.facts', '.rs-thread', '.rs-credits', '.rs-status', '.explainer .ex-note', '.case-close .email']) assert.ok(await page.locator(selector).first().isVisible(), `${selector} visible in print`);
      for (let i = 0; i < 3; i++) assert.ok(await page.locator('.ex-panel').nth(i).isVisible(), `sample ${i + 1} visible in print`);
      assert.equal(await page.locator('main .reveal').evaluateAll(list => list.filter(el => getComputedStyle(el).opacity !== '1').length), 0, 'nothing is faded in print');
      await context.close();
    }

    // Touch targets at 390px. Links inside running text are exempt.
    {
      const { page, context } = await open(browser, url, { width: 390 });
      const small = await page.evaluate(() => [...document.querySelectorAll('main a, main button, main [role=tab], main summary')].filter(el => el.offsetParent).filter(el => {
        const inText = el.tagName === 'A' && el.parentElement && el.parentElement.textContent.replace(el.textContent, '').trim().length > 0 && !el.closest('.crumb');
        if (inText) return false;
        const box = el.getBoundingClientRect();
        return box.height < 44 || box.width < 44;
      }).map(el => `${el.tagName} ${el.textContent.trim().slice(0, 40)}`));
      assert.deepEqual(small, [], 'touch targets are at least 44px');
      await context.close();
    }

    console.log('PASS research: content, wording, link, overflow, axe in both themes, no script, print, touch targets');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
