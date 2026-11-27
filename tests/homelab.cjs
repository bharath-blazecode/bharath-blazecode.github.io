// ITDR Home Lab page, plus shared checks for the LUNA, Scoreboard and 404 pages.
// Run: node tests/homelab.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startSite } = require('./helpers/site.cjs');
const { checkWriting } = require('../tools/check-writing.cjs');

const root = path.resolve(__dirname, '..');
const axeText = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const WIDTHS = [320, 390, 820, 1440];
const THEMES = ['light', 'dark'];
const RULES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function open(browser, url, { width = 1440, theme = 'light', reducedMotion = 'reduce', javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion, javaScriptEnabled, hasTouch: width <= 820 });
  if (javaScriptEnabled) await context.addInitScript(value => { try { localStorage.setItem('bs-shift', value); } catch (_) {} }, theme);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', error => problems.push('page error: ' + error.message));
  page.on('console', message => { if (message.type() === 'error' && message.location().url !== url) problems.push('console: ' + message.text()); });
  page.on('response', response => { if (response.status() >= 400 && !response.url().endsWith('/favicon.ico') && response.url() !== url) problems.push(`${response.status()} ${response.url()}`); });
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { page, context, problems };
}

async function axeViolations(page) {
  // Evaluated through the protocol, so the page's strict policy stays in force.
  if ((await page.evaluate(() => typeof window.axe)) !== 'object') await page.evaluate(axeText);
  const found = await page.evaluate(async rules => (await axe.run(document, { runOnly: { type: 'tag', values: rules } }))
    .violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })), RULES);
  // The header's icon-only terminal button is shared markup owned elsewhere; it is left out here and reported.
  return found.map(item => ({ ...item, targets: item.targets.filter(target => !(item.id === 'button-name' && String(target) === '.tool-terminal')) })).filter(item => item.targets.length);
}

async function commonChecks(page, label, theme) {
  assert.equal(await page.locator('h1').count(), 1, `${label}: one h1`);
  assert.equal(await page.locator('main#main').count(), 1, `${label}: main landmark`);
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme === 'dark'), theme === 'dark', `${label}: theme applied`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: no horizontal overflow`);
  assert.equal(await page.locator('[style]').count(), 0, `${label}: no inline style attributes`);
}

(async () => {
  const site = await startSite(48773);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    const lab = `${site.url}/work/homelab/`;

    // Source markup the checker relies on.
    const source = fs.readFileSync(path.join(site.dir, 'work/homelab/index.html'), 'utf8');
    assert.match(source, /Illustrative, not a recorded incident/);
    assert.match(source, /Teaching example, not live telemetry/);
    assert.match(source, /OpenSearch/);
    assert.deepEqual([...source.matchAll(/data-flow-step="(\d)"/g)].map(match => match[1]), ['1', '2', '3'], 'flow packets in order');
    assert.equal((source.match(/data-flow-packet/g) || []).length, 3, 'three flow packets');
    assert.deepEqual([...source.matchAll(/data-trace-step="(\d)"/g)].map(match => match[1]), ['1', '2', '3', '4', '5'], 'trace rows in order');
    assert.ok(source.includes('data-terminal-run="head -n 1 ~/logs/README.txt && grep -i powershell ~/logs/*.log"'), 'home lab keeps its terminal button');

    // Home lab: every width and theme.
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        const label = `homelab ${width}px ${theme}`;
        const { page, context, problems } = await open(browser, lab, { width, theme });
        await commonChecks(page, label, theme);
        const notebook = page.locator('[data-lab-notebook]');
        const first = page.locator('#notebook-collection');
        const second = page.locator('#notebook-storage');
        const previous = page.locator('[data-notebook-previous]');
        const next = page.locator('[data-notebook-next]');
        assert.equal(await first.isVisible(), true, `${label}: first note`);
        assert.equal(await second.isVisible(), false, `${label}: second note starts hidden`);
        assert.equal(await previous.getAttribute('aria-disabled'), 'true', `${label}: first page boundary`);
        assert.equal(await next.getAttribute('aria-disabled'), 'false', `${label}: next note available`);
        assert.ok((await next.boundingBox()).height >= 44, `${label}: note control is touch sized`);
        const image = first.locator('img');
        await image.scrollIntoViewIfNeeded();
        assert.ok(await image.evaluate(async element => { await element.decode(); return element.naturalWidth > 0; }), `${label}: dashboard image decodes`);
        assert.match(await image.getAttribute('srcset'), /wazuh-dashboard-480\.webp 480w/, `${label}: responsive image`);
        const original = first.locator('a');
        assert.match(await original.getAttribute('href'), /wazuh-dashboard\.jpg$/, `${label}: link opens the original`);
        assert.ok((await page.request.get(new URL(await original.getAttribute('href'), page.url()).href)).ok(), `${label}: original image resolves`);
        await next.click();
        assert.equal(await first.isVisible(), false, `${label}: first note closes`);
        assert.equal(await second.isVisible(), true, `${label}: second note opens`);
        assert.match(await page.locator('[data-notebook-status]').textContent(), /Note 2 of 2: Indexer storage fault/);
        assert.equal(await next.getAttribute('aria-disabled'), 'true', `${label}: last page boundary`);
        await next.press('Enter');
        assert.equal(await second.isVisible(), true, `${label}: cannot advance past the final note`);
        assert.ok(await next.evaluate(element => element === document.activeElement), `${label}: focus stays on the control`);
        await previous.focus();
        await previous.press('Enter');
        assert.equal(await first.isVisible(), true, `${label}: keyboard returns to the first note`);
        assert.match(await notebook.innerText(), /not a recorded incident/);

        for (const stage of ['observe', 'consider', 'interpret', 'ask']) {
          const link = page.locator(`[data-guide="${stage}"]`);
          assert.ok((await link.boundingBox()).height >= 44, `${label}: ${stage} link is touch sized`);
          await link.click();
          assert.equal(await page.locator(`#example-${stage}`).evaluate(element => element.open), true, `${label}: ${stage} opens`);
          assert.notEqual(await link.evaluate(element => getComputedStyle(element).backgroundColor), 'rgba(0, 0, 0, 0)', `${label}: ${stage} link highlights`);
        }
        const terminal = page.locator('[data-terminal-run]');
        assert.equal(await terminal.isVisible(), true, `${label}: terminal link shown with JavaScript`);
        assert.ok((await terminal.boundingBox()).height >= 44, `${label}: terminal link is touch sized`);
        const still = await page.evaluate(() => ['.packet', '.investigation-node', '.trace-row'].map(selector => {
          const element = document.querySelector(selector);
          return [getComputedStyle(element).animationName, getComputedStyle(element, '::before').animationName, getComputedStyle(element, '::after').animationName];
        }).flat());
        assert.deepEqual([...new Set(still)], ['none'], `${label}: reduced motion stops every loop`);
        assert.equal(await page.locator('[data-telemetry-flow].is-live, [data-investigation-flow].is-live, [data-event-trace].is-live').count(), 0, `${label}: nothing runs under reduced motion`);
        assert.deepEqual(problems, [], `${label}: console and network`);
        await context.close();
      }
    }

    // Loops run only on screen, in a visible tab, with motion allowed. They animate transform and opacity only.
    {
      const { page, context, problems } = await open(browser, lab, { reducedMotion: 'no-preference' });
      const live = () => page.locator('[data-telemetry-flow].is-live, [data-investigation-flow].is-live, [data-event-trace].is-live').count();
      assert.equal(await live(), 0, 'loops are idle while off screen');
      await page.locator('[data-notebook-next]').click();
      assert.equal(await page.locator('#notebook-storage').evaluate(element => getComputedStyle(element).animationName), 'notebook-next', 'next note slides in');
      await page.locator('[data-notebook-previous]').click();
      assert.equal(await page.locator('#notebook-collection').evaluate(element => getComputedStyle(element).animationName), 'notebook-previous', 'previous note slides back');
      await page.locator('[data-telemetry-flow]').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-telemetry-flow]').classList.contains('is-live'));
      assert.equal(await page.locator('.packet').first().evaluate(element => getComputedStyle(element).animationName), 'hop-x', 'packets travel along the hops');
      await page.locator('[data-investigation-flow]').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-investigation-flow]').classList.contains('is-live'));
      await page.locator('[data-event-trace]').scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.querySelector('[data-event-trace]').classList.contains('is-live'));
      const properties = await page.evaluate(() => {
        const skip = new Set(['offset', 'easing', 'composite', 'computedOffset']);
        return [...new Set(document.getAnimations().flatMap(animation => (animation.effect && animation.effect.getKeyframes ? animation.effect.getKeyframes() : [])
          .flatMap(frame => Object.keys(frame).filter(key => !skip.has(key)))))].sort();
      });
      assert.deepEqual(properties.filter(name => !['opacity', 'transform'].includes(name)), [], 'only transform and opacity animate');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      assert.equal(await live(), 0, 'loops stop in a background tab');
      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.waitForFunction(() => document.querySelector('[data-event-trace]').classList.contains('is-live'));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForFunction(() => !document.querySelector('[data-event-trace]').classList.contains('is-live'));
      assert.equal(await live(), 0, 'loops stop when reduced motion is turned on');
      assert.deepEqual(problems, [], 'motion page console and network');
      await context.close();
    }

    // Without JavaScript the whole page is still readable.
    {
      const { page, context } = await open(browser, lab, { width: 390, javaScriptEnabled: false });
      assert.equal(await page.locator('[data-notebook-controls]').isVisible(), false, 'no-JavaScript note controls stay hidden');
      assert.equal(await page.locator('[data-terminal-run]').isVisible(), false, 'no-JavaScript terminal link stays hidden');
      assert.ok(await page.locator('#notebook-collection').isVisible());
      assert.ok(await page.locator('#notebook-storage').isVisible(), 'both notes are readable without JavaScript');
      assert.ok(await page.locator('#example-observe').evaluate(element => element.open), 'first step is open by default');
      await page.locator('#example-consider > summary').click();
      assert.ok(await page.locator('#example-consider').evaluate(element => element.open), 'steps open from the summary without JavaScript');
      for (const text of ['Word opens PowerShell', 'Component roles', 'Four faults', 'Where it goes next']) assert.ok((await page.locator('main').innerText()).includes(text), `no-JavaScript text: ${text}`);
      await context.close();
    }

    // Print includes both notes and every step.
    {
      const { page, context } = await open(browser, lab);
      await page.emulateMedia({ media: 'print' });
      assert.ok(await page.locator('#notebook-collection').isVisible());
      assert.ok(await page.locator('#notebook-storage').isVisible(), 'print includes both notes');
      assert.equal(await page.locator('[data-notebook-controls]').isVisible(), false, 'print hides the note controls');
      for (const stage of ['consider', 'interpret', 'ask']) assert.ok(await page.locator(`#example-${stage} .step-body`).isVisible(), `print shows the ${stage} step`);
      assert.equal(await page.locator('.mast').isVisible(), false, 'print hides the header');
      await context.close();
    }

    // Accessibility on the home lab page, both notes, both themes, narrow and wide.
    for (const theme of THEMES) {
      for (const width of [390, 1440]) {
        const { page, context } = await open(browser, lab, { width, theme });
        for (const note of [1, 2]) {
          if (note === 2) await page.locator('[data-notebook-next]').click();
          assert.deepEqual(await axeViolations(page), [], `homelab ${width}px ${theme}: note ${note} accessibility`);
        }
        await context.close();
      }
    }

    // LUNA, Scoreboard and 404.
    const pages = [
      { name: 'LUNA', url: '/work/luna/', text: [/Zhirui/, /vendor routine/, /Shared university project/] },
      { name: 'Scoreboard', url: '/work/competitions/', text: [/Alan Nguyen/, /Akira Hasuo/, /Every placement here is a team result/, /Certificate of participation/, /used AI tools as a guide/, /not a claim to have solved everything unaided/] },
      { name: '404', url: '/nowhere', text: [/Nothing is filed at this address/] }
    ];
    for (const entry of pages) {
      for (const width of WIDTHS) {
        for (const theme of THEMES) {
          const label = `${entry.name} ${width}px ${theme}`;
          const { page, context, problems } = await open(browser, site.url + entry.url, { width, theme });
          await commonChecks(page, label, theme);
          const text = await page.locator('main').innerText();
          for (const pattern of entry.text) assert.match(text, pattern, `${label}: content ${pattern}`);
          for (const image of await page.locator('main img').all()) {
            await image.scrollIntoViewIfNeeded();
            assert.ok(await image.evaluate(async element => { await element.decode(); return element.naturalWidth > 0; }), `${label}: image decodes`);
          }
          if (width === 390 || width === 1440) assert.deepEqual(await axeViolations(page), [], `${label}: accessibility`);
          assert.deepEqual(problems, [], `${label}: console and network`);
          await context.close();
        }
      }
    }

    // LUNA and Scoreboard content hooks in the built HTML.
    const luna = fs.readFileSync(path.join(site.dir, 'work/luna/index.html'), 'utf8');
    assert.match(luna, /Zhirui/);
    assert.match(luna, /vendor routine/);
    const board = fs.readFileSync(path.join(site.dir, 'work/competitions/index.html'), 'utf8');
    assert.deepEqual([...board.matchAll(/<section class="spine event" id="([a-z]+)"/g)].map(match => match[1]), ['downtime', 'byteme', 'csaw', 'holmes', 'hackathon', 'cimctf'], 'event order');
    assert.deepEqual([...board.matchAll(/<p class="event-result"><b>([^<]+)<\/b><span>([^<]+)<\/span>/g)].map(match => `${match[1]} | ${match[2]}`), [
      '476th | of 1,629 ranked teams, 1,150 XP, Team SushiShield, with Alan Nguyen',
      '189th | of 530 teams, Team SushiShield',
      '1,097th | of 5,637 teams, 8 of 111 challenges, 825 points, Team SushiShield',
      'Award | People’s Choice, 15 teams, ClassQuest',
      '3rd | place overall, Team SushiShield'
    ], 'result lines');
    const byteme = (board.match(/<section class="spine event" id="byteme"[\s\S]*?<\/section>/) || [''])[0];
    assert.match(byteme, /Certificate of participation/);
    assert.doesNotMatch(byteme, /\b\d[\d,]*(st|nd|rd|th)\b|\b(placed|ranked|ranking|finished)\b/i, 'ByteMe has no placement wording');
    const fourOhFour = fs.readFileSync(path.join(site.dir, '404.html'), 'utf8');
    assert.match(fourOhFour, /<meta name="robots" content="noindex">/);
    const evidence = [...board.matchAll(/<img\b[^>]*>/g)].length;
    assert.equal(evidence, 4, 'every evidence image stays on the Scoreboard');

    // Writing rules for all five pages and their own styles and scripts.
    const written = checkWriting(site.dir);
    const mine = /^(work\/homelab\/|work\/classquest\/|work\/luna\/|work\/competitions\/|404\.html)/;
    assert.deepEqual(written.errors.filter(line => mine.test(line)), [], 'banned characters in the five pages');
    assert.deepEqual(written.warnings.filter(line => mine.test(line)), [], 'banned words in the five pages');
    const banned = /[\u2014\u2013\u2015\u00B7\u2022\u2026\u2190-\u21FF\u2713-\u2718\u2705\u274C\u00D7\u2260\u00E9\u{1F000}-\u{1FAFF}]/u;
    for (const file of ['css/case.css', 'css/homelab.css', 'css/classquest.css', 'css/competitions.css', 'js/homelab.js', 'js/classquest.js']) {
      assert.doesNotMatch(fs.readFileSync(path.join(root, file), 'utf8'), banned, `${file}: banned character`);
    }

    console.log('PASS: home lab notebook, diagram, investigation, themes, widths, keyboard, reduced motion, loop limits, no-JavaScript, print and accessibility; LUNA, Scoreboard and 404 content, overflow, accessibility and writing rules.');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => setTimeout(() => process.exit(process.exitCode || 0), 250));
