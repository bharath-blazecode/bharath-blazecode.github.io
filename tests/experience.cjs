const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { startSite } = require('./helpers/site.cjs');

const entries = [
  { id: 'experience-sciencegears', label: 'ScienceGears', org: 'ScienceGears', title: 'Cybersecurity and IT Automation Analyst', date: 'Apr 2026 to present', kind: 'Paid contract', text: 'Identity security and access governance', bullets: ['Reviewed identity controls', 'Managed MFA, Conditional Access', 'Built email-triage'] },
  { id: 'experience-research', label: 'QUT', org: 'QUT Vacation Research Experience Scheme', title: 'AI Cyber Risk Assessment Research', date: 'Nov 2026 to present', kind: 'Research placement', text: 'Researching AI-supported cyber risk assessment', bullets: [] },
  { id: 'experience-tech', label: 'QUT TECH', org: 'QUT The Emerging Coders Hub (TECH)', title: 'Technical Lead', date: 'Oct 2026 to present', kind: 'Club executive', text: 'Coordinate two Technical Officers', bullets: ['Work alongside the team', 'Plan project nights'] },
  { id: 'experience-dynamx', label: 'DynamX Institute', org: 'DynamX Institute', title: 'Technology Consultant, Power Platform', date: 'Apr to May 2026', kind: 'Program placement', text: 'Power Platform business system', bullets: [] },
  { id: 'experience-engagement', label: 'Code Network', org: 'Code Network', title: 'Engagement Officer', date: 'Sep 2026 to present', kind: 'Committee role', text: 'Support member participation', bullets: ['Work with the Engagement Coordinator', 'Contribute ideas'] },
  { id: 'experience-events', label: 'Code Network', org: 'Code Network', title: 'Event Officer', date: 'Mar to Sep 2026', kind: 'Previous committee role', text: 'up to 40 participants', bullets: [] },
  { id: 'experience-coles', label: 'Coles Group', org: 'Coles Group', title: 'Customer Service Supervisor', date: 'May 2025 to present', kind: 'Part-time', text: 'more than 20 team members', bullets: [] }
];
const ariaLabel = entry => `${entry.date}, ${entry.label}, ${entry.title}${entry.label === entry.org ? '' : `, ${entry.org}`}`;
const stop = (page, entry) => page.locator(`[data-experience-target="${entry.id}"]`);
const focused = (page, entry) => stop(page, entry).evaluate(el => el === document.activeElement);

const watchers = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', event => window.__csp.push(event.violatedDirective + ' ' + event.blockedURI));
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
  page.on('pageerror', error => problems.push('pageerror: ' + error.message));
  page.on('console', message => { if (message.type() === 'error') problems.push('console: ' + message.text()); });
  await page.goto(site.url + '/', { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return { context, page, problems };
}

// Asserts which role (or none) is showing, across points, panel, head and prompt.
async function expectState(page, selected, label, checkStatus = true) {
  for (const entry of entries) {
    const on = selected !== null && entry.id === selected.id;
    assert.equal(await stop(page, entry).getAttribute('aria-expanded'), String(on), `${label}: aria-expanded for ${entry.id}`);
    const role = page.locator(`#${entry.id}`);
    assert.equal(await role.isVisible(), on, `${label}: visibility of ${entry.id}`);
    assert.equal(await role.evaluate(el => el.open), on, `${label}: open state of ${entry.id}`);
    assert.equal(await role.evaluate(el => el.hidden), !on, `${label}: hidden state of ${entry.id}`);
  }
  assert.equal(await page.locator('[data-experience-detail-head]').isVisible(), selected !== null, `${label}: Close row`);
  assert.equal(await page.locator('[data-experience-empty]').isVisible(), selected === null, `${label}: empty prompt`);
  if (!checkStatus) return;
  const expected = selected
    ? `${selected.title}, ${selected.label}. Details opened below.`
    : 'Role details closed.';
  assert.equal((await page.locator('[data-experience-status]').textContent()).trim(), expected, `${label}: status line`);
}

const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

(async () => {
  const site = await startSite(48783);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });

    // 1. Structure, order, labels and the first role open on load.
    {
      const { context, page, problems } = await open(browser, site);
      assert.equal(await page.evaluate(() => scrollY), 0, 'the page does not scroll on load');
      assert.equal(await page.locator('#experience').evaluate(el => el.classList.contains('has-experience-path')), true, 'section has the path class');
      assert.equal(await page.locator('[data-experience-path]').isVisible(), true, 'path is visible');
      const targets = await page.locator('[data-experience-stops] button.experience-stop').evaluateAll(items => items.map(item => item.dataset.experienceTarget));
      assert.deepEqual(targets, entries.map(entry => entry.id), 'points are in role order');
      assert.deepEqual(await page.locator('[data-experience-roles] > details.role').evaluateAll(items => items.map(item => item.id)), entries.map(entry => entry.id), 'seven roles in order');
      assert.equal(await page.locator('[data-experience-stops]').getAttribute('role'), 'group');
      assert.equal(await page.locator('[data-experience-stops]').getAttribute('aria-label'), 'Experience roles');
      for (const entry of entries) {
        const point = stop(page, entry);
        assert.equal(await point.getAttribute('aria-controls'), entry.id, `${entry.id}: aria-controls`);
        assert.equal(await point.getAttribute('aria-label'), ariaLabel(entry), `${entry.id}: accessible name`);
        assert.equal(await point.getAttribute('type'), 'button');
        assert.equal(await point.locator('.experience-marker').getAttribute('aria-hidden'), 'true');
        assert.equal((await point.locator('.experience-stop-date').textContent()).trim(), entry.date, `${entry.id}: point date`);
        assert.equal((await point.locator('.experience-stop-name').textContent()).trim(), entry.label, `${entry.id}: point name`);
        assert.equal((await point.locator('.experience-stop-role').textContent()).trim(), entry.title, `${entry.id}: point role`);
        assert.equal(await page.locator(`#${entry.id}`).getAttribute('data-path-label'), entry.label, `${entry.id}: path label`);
      }
      assert.equal((await page.locator('[data-experience-status]').getAttribute('role')), 'status');
      await expectState(page, entries[0], 'on load', false);
      assert.equal((await page.locator('[data-experience-status]').textContent()).trim(), '', 'status is quiet on load');
      assert.equal(await stop(page, entries[0]).getAttribute('aria-expanded'), 'true', 'first point is selected on load');
      assert.equal(await page.locator('#experience-sciencegears').evaluate(el => el.open && !el.hidden), true, 'first role is open on load');
      assert.equal(await page.locator('[data-experience-roles] > details.role:not([hidden])').count(), 1, 'one role shows on load');
      assert.equal(await page.locator('[data-experience-detail-head]').isVisible(), true, 'Close row shows on load');
      assert.equal(await page.locator('[data-experience-empty]').isVisible(), false, 'prompt is hidden on load');
      assert.deepEqual(problems, [], 'no console errors');
      assert.deepEqual(await page.evaluate(() => window.__csp), [], 'no Content-Security-Policy violations');
      await context.close();
    }

    // 2. Panel content for every role.
    {
      const { context, page, problems } = await open(browser, site);
      await stop(page, entries[1]).click();
      for (const entry of entries) {
        await stop(page, entry).click();
        await expectState(page, entry, `choose ${entry.id}`);
        const role = page.locator(`#${entry.id}`);
        assert.equal((await role.locator('summary .role-time').evaluate(el => el.firstChild.textContent)).trim(), entry.date, `${entry.id}: date in panel`);
        assert.ok((await role.locator('summary .role-time > span').textContent()).trim() === entry.kind, `${entry.id}: kind in panel`);
        assert.equal((await role.locator('summary .role-title > strong').innerText()).trim(), entry.org, `${entry.id}: organisation`);
        assert.equal((await role.locator('summary .role-title > span').innerText()).trim(), entry.title, `${entry.id}: title`);
        assert.ok(await role.locator('.role-detail').isVisible(), `${entry.id}: detail is visible`);
        assert.ok((await role.locator('.role-detail p').first().innerText()).includes(entry.text) || (await role.locator('.role-detail').innerText()).includes(entry.text), `${entry.id}: text`);
        const items = await role.locator('.role-detail ul.ticks li').allInnerTexts();
        assert.equal(items.length, entry.bullets.length, `${entry.id}: bullet count`);
        entry.bullets.forEach((start, index) => assert.ok(items[index].startsWith(start), `${entry.id}: bullet ${index + 1}`));
        assert.ok(await noOverflow(page), `${entry.id}: no page overflow`);
      }
      // The QUT role.
      const qut = entries[1];
      assert.equal(qut.title, 'AI Cyber Risk Assessment Research');
      await stop(page, qut).click();
      const link = page.locator('#experience-research .role-detail a');
      assert.equal(await link.getAttribute('href'), 'research/', 'QUT detail links to research/');
      assert.equal((await link.innerText()).trim(), 'Read about the research');
      assert.deepEqual(problems, [], 'no console errors');
      await context.close();
    }

    // 3. Closing and switching, with focus.
    {
      const { context, page } = await open(browser, site);
      await stop(page, entries[3]).click();
      await expectState(page, entries[3], 'switch to DynamX');
      assert.equal(await page.locator('[data-experience-roles] > details.role:not([hidden])').count(), 1, 'only one role shows');

      await stop(page, entries[3]).click();
      await expectState(page, null, 'choose the selected point again');
      assert.ok(await focused(page, entries[3]), 'focus stays on the point after choosing it again');

      await stop(page, entries[5]).click();
      await page.locator('[data-experience-close]').click();
      await expectState(page, null, 'Close button');
      assert.ok(await focused(page, entries[5]), 'Close returns focus to its point');

      await stop(page, entries[2]).click();
      await expectState(page, entries[2], 'before Escape');
      await page.keyboard.press('Escape');
      await expectState(page, null, 'Escape from the point');
      assert.ok(await focused(page, entries[2]), 'Escape returns focus to the point');

      await stop(page, entries[6]).click();
      await page.locator('[data-experience-close]').focus();
      await page.keyboard.press('Escape');
      await expectState(page, null, 'Escape from the Close button');
      assert.ok(await focused(page, entries[6]), 'Escape from Close returns focus to the point');

      await page.keyboard.press('Escape');
      await expectState(page, null, 'Escape with nothing selected');

      // Summaries do nothing while the path runs.
      await stop(page, entries[0]).click();
      await page.locator('#experience-sciencegears > summary').click();
      await expectState(page, entries[0], 'after clicking a summary');
      await page.locator('#experience-sciencegears > summary').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Space');
      await expectState(page, entries[0], 'after pressing keys on a summary');
      await context.close();
    }

    // 4. Keyboard use.
    {
      const { context, page } = await open(browser, site);
      await stop(page, entries[0]).focus();
      await page.keyboard.press('Tab');
      assert.ok(await focused(page, entries[1]), 'Tab moves to the next point');
      await page.keyboard.press('Enter');
      await expectState(page, entries[1], 'Enter on a point');
      await page.keyboard.press('Tab');
      assert.ok(await focused(page, entries[2]), 'Tab moves on to the third point');
      await page.keyboard.press('Space');
      await expectState(page, entries[2], 'Space on a point');
      await page.keyboard.press('Space');
      await expectState(page, null, 'Space on the selected point');
      assert.ok(await focused(page, entries[2]), 'focus stays on the point');
      await page.keyboard.press('Enter');
      await expectState(page, entries[2], 'Enter on a closed point');
      await page.keyboard.press('Shift+Tab');
      assert.ok(await focused(page, entries[1]), 'Shift+Tab moves back');
      const outline = await stop(page, entries[1]).evaluate(el => { const style = getComputedStyle(el); return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0; });
      assert.ok(outline, 'focused point has a visible outline');
      await context.close();
    }

    // 5. Layout at four widths, in both themes.
    for (const width of [320, 390, 820, 1440]) {
      for (const theme of ['light', 'dark']) {
        const label = `${width}px ${theme}`;
        const { context, page, problems } = await open(browser, site, { width, colorScheme: theme, saved: theme, reducedMotion: 'reduce', touch: width <= 820 });
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || 'light'), theme, `${label}: theme applied`);
        assert.ok(await noOverflow(page), `${label}: no horizontal page overflow on load`);
        for (const entry of entries) {
          const box = await stop(page, entry).boundingBox();
          assert.ok(box.width >= 44 && box.height >= 44, `${label}: ${entry.id} is at least 44 by 44 (${Math.round(box.width)}x${Math.round(box.height)})`);
          await stop(page, entry).click();
          assert.ok(await noOverflow(page), `${label}: no overflow with ${entry.id} open`);
        }
        const fits = await page.locator('.experience-stop-name').evaluateAll(items => items.every(item => {
          // Measure the text itself; the highlight bar extends a little past it.
          const range = document.createRange();
          range.selectNodeContents(item);
          const text = range.getBoundingClientRect();
          const stopBox = item.closest('.experience-stop').getBoundingClientRect();
          return text.left >= stopBox.left - 1 && text.right <= stopBox.right + 1;
        }));
        assert.ok(fits, `${label}: role names fit`);
        const map = await page.locator('[data-experience-map]').evaluate(el => ({ over: el.scrollWidth > el.clientWidth + 1, overflowX: getComputedStyle(el).overflowX }));
        if (width <= 900) assert.ok(map.over && /auto|scroll/.test(map.overflowX), `${label}: path scrolls sideways`);
        else assert.equal(map.over, false, `${label}: path fits without scrolling`);
        assert.equal(await page.locator('.experience-swipe').isVisible(), width <= 900, `${label}: swipe hint`);
        assert.deepEqual(problems, [], `${label}: no console errors`);
        assert.deepEqual(await page.evaluate(() => window.__csp), [], `${label}: no Content-Security-Policy violations`);
        await context.close();
      }
    }

    // 6. The chosen point is brought into view on narrow screens.
    for (const width of [390, 820]) {
      const { context, page } = await open(browser, site, { width, touch: true });
      const map = page.locator('[data-experience-map]');
      await map.scrollIntoViewIfNeeded();
      assert.equal(await map.evaluate(el => el.scrollLeft), 0, `${width}px: path starts at the left`);
      const sixth = entries[5];
      const inside = () => page.evaluate(id => {
        const frame = document.querySelector('[data-experience-map]').getBoundingClientRect();
        const box = document.querySelector(`[data-experience-target="${id}"]`).getBoundingClientRect();
        return box.left >= frame.left - 1 && box.right <= frame.right + 1;
      }, sixth.id);
      if (width === 390) assert.equal(await inside(), false, 'sixth point starts outside the visible part');
      // A script click does not scroll by itself, so any movement comes from the page.
      await stop(page, sixth).evaluate(el => el.click());
      await page.waitForFunction(id => {
        const frame = document.querySelector('[data-experience-map]').getBoundingClientRect();
        const box = document.querySelector(`[data-experience-target="${id}"]`).getBoundingClientRect();
        return box.left >= frame.left - 1 && box.right <= frame.right + 1;
      }, sixth.id, { timeout: 5000 });
      assert.equal(await inside(), true, `${width}px: sixth point is inside the scroller`);
      await expectState(page, sixth, `${width}px sixth point`);
      assert.ok(await noOverflow(page), `${width}px: no page overflow after scrolling the path`);
      await context.close();
    }

    // 7. Reduced motion: nothing runs and everything is visible.
    {
      const { context, page } = await open(browser, site, { reducedMotion: 'reduce' });
      await page.locator('#experience').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.target && a.effect.target.closest('#experience')).length);
      assert.equal(running, 0, 'no animation running in the experience section');
      const shown = await page.evaluate(() => [...document.querySelectorAll('.experience-marker, .experience-stop-label, .experience-wave-clip, .experience-wave')].map(el => {
        const style = getComputedStyle(el);
        return { opacity: style.opacity, transform: style.transform, visibility: style.visibility, animation: style.animationName };
      }));
      assert.equal(shown.length, 7 * 2 + 2, 'markers, labels and path are present');
      for (const item of shown) {
        assert.equal(item.opacity, '1');
        assert.equal(item.visibility, 'visible');
        assert.ok(item.transform === 'none' || item.transform === 'matrix(1, 0, 0, 1, 0, 0)', `static transform (${item.transform})`);
        assert.equal(item.animation, 'none', 'no animation applied');
      }
      for (const entry of entries) {
        assert.equal(await stop(page, entry).locator('.experience-marker').isVisible(), true, `${entry.id}: marker visible`);
        assert.equal(await stop(page, entry).locator('.experience-stop-label').isVisible(), true, `${entry.id}: label visible`);
      }
      await context.close();
    }

    // 8. Motion allowed: scroll-driven animation changes transform only.
    {
      const { context, page } = await open(browser, site);
      await page.locator('#experience').scrollIntoViewIfNeeded();
      const animated = await page.evaluate(() => document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest('#experience')).map(a => ({
        scroll: a.timeline && a.timeline.constructor.name !== 'DocumentTimeline',
        properties: [...new Set(a.effect.getKeyframes().flatMap(frame => Object.keys(frame)))].filter(name => !['offset', 'easing', 'composite', 'computedOffset'].includes(name))
      })));
      assert.ok(animated.length > 0, 'the path animates when motion is allowed');
      for (const item of animated) {
        assert.equal(item.scroll, true, 'driven by scroll, not by time');
        assert.deepEqual(item.properties, ['transform'], 'only transform is animated');
      }
      await context.close();
    }

    // 9. Without JavaScript.
    {
      const { context, page } = await open(browser, site, { javaScriptEnabled: false, width: 390 });
      assert.equal(await page.locator('[data-experience-path]').isVisible(), false, 'path stays hidden');
      assert.equal(await page.locator('[data-experience-stops] button').count(), 0, 'no points are built');
      assert.equal(await page.locator('#experience.has-experience-path').count(), 0, 'no path class');
      assert.equal(await page.locator('[data-experience-empty]').isVisible(), false, 'prompt stays hidden');
      assert.equal(await page.locator('[data-experience-detail-head]').isVisible(), false, 'Close row stays hidden');
      const open7 = await page.locator('[data-experience-roles] > details.role').evaluateAll(items => items.map(item => item.open));
      assert.deepEqual(open7, [true, false, false, false, false, false, false], 'seven disclosures, the first open');
      for (const entry of entries) assert.ok(await page.locator(`#${entry.id} > summary`).isVisible(), `${entry.id}: summary is visible`);
      assert.ok(await page.locator('#experience-sciencegears .role-detail').isVisible(), 'first role detail is visible');
      assert.equal(await page.locator('#experience-research .role-detail').isVisible(), false, 'others are closed');
      await page.locator('#experience-research > summary').click();
      assert.equal(await page.locator('#experience-research').evaluate(el => el.open), true, 'a summary opens its role');
      assert.ok((await page.locator('#experience-research .role-detail').innerText()).includes(entries[1].text));
      await page.locator('#experience-research > summary').click();
      assert.equal(await page.locator('#experience-research').evaluate(el => el.open), false, 'a summary closes its role');
      assert.ok(await noOverflow(page), 'no overflow');
      await context.close();
    }

    // 10. Print shows every role.
    {
      const { context, page } = await open(browser, site, { reducedMotion: 'reduce' });
      await stop(page, entries[3]).click();
      await page.emulateMedia({ media: 'print' });
      for (const entry of entries) {
        assert.ok(await page.locator(`#${entry.id}`).isVisible(), `${entry.id}: shown in print`);
        assert.ok(await page.locator(`#${entry.id} .role-detail`).isVisible(), `${entry.id}: detail shown in print`);
        assert.ok((await page.locator(`#${entry.id} .role-detail`).innerText()).includes(entry.text), `${entry.id}: text shown in print`);
      }
      assert.equal(await page.locator('[data-experience-path]').isVisible(), false, 'print omits the path');
      assert.equal(await page.locator('[data-experience-empty]').isVisible(), false, 'print omits the prompt');
      assert.equal(await page.locator('[data-experience-detail-head]').isVisible(), false, 'print omits the Close row');
      await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
      assert.equal(await page.locator('[data-experience-roles] > details.role[open]').count(), 7, 'every role is open for printing');
      await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
      await page.emulateMedia({ media: 'screen' });
      await expectState(page, entries[3], 'after printing').catch(error => {
        if (!/status line/.test(error.message)) throw error;
      });
      assert.equal(await page.locator('[data-experience-roles] > details.role[open]').count(), 1, 'one role is open again after printing');
      await context.close();
    }

    // 11. Accessibility with axe, in both themes.
    {
      const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
      for (const theme of ['light', 'dark']) {
        for (const choose of [0, 4]) {
          const { context, page } = await open(browser, site, { width: 390, colorScheme: theme, saved: theme, reducedMotion: 'reduce', bypassCSP: true });
          await stop(page, entries[choose]).click();
          await page.evaluate(axeSource);
          const result = await page.evaluate(() => axe.run(document.querySelector('#experience'), {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
            rules: { 'label-content-name-mismatch': { enabled: true } }
          }));
          const summary = result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).slice(0, 4).join(' | ')}`);
          assert.deepEqual(summary, [], `axe violations in ${theme}`);
          await context.close();
        }
      }
    }

    console.log('PASS experience: path order and labels, first role open, switching, close and focus, keyboard, content, QUT link, narrow scrolling, touch targets, overflow, themes, reduced motion, no JavaScript, print, axe, hygiene');
  } finally {
    if (browser) await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
