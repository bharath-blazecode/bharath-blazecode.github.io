const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PROJECTS_PORT) || 48768;
const remote = process.env.PROJECTS_ORIGIN;
const origin = remote ? new URL(remote).origin : `http://127.0.0.1:${port}`;
const projects = [
  { id: 'project-lab', title: 'ITDR Home Lab', href: 'work/homelab/' },
  { id: 'project-quest', title: 'ClassQuest', href: 'work/classquest/' },
  { id: 'project-luna', title: 'LUNA', href: 'work/luna/' }
];
const server = remote ? null : spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = server ? new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
}) : Promise.resolve();

async function checkImage(page, image, label) {
  await image.scrollIntoViewIfNeeded();
  const result = await image.evaluate(async element => {
    try {
      await Promise.race([
        element.decode(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('image decode timed out')), 5000))
      ]);
      return { width: element.naturalWidth, height: element.naturalHeight, error: null };
    } catch (error) {
      return { width: element.naturalWidth, height: element.naturalHeight, error: error.message };
    }
  });
  assert.equal(result.error, null, `${label}: image must decode`);
  assert.ok(result.width > 0 && result.height > 0, `${label}: image must have natural dimensions`);
  const source = await image.getAttribute('src');
  const response = await page.request.get(new URL(source, page.url()).href);
  assert.equal(response.status(), 200, `${label}: image response`);
  assert.match(response.headers()['content-type'] || '', /^image\//, `${label}: image content type`);
}

async function checkSelected(page, current, label) {
  for (const project of projects) {
    const selected = project.id === current.id;
    assert.equal(await page.locator(`[data-project="${project.id}"]`).getAttribute('aria-expanded'), String(selected), `${label}: expanded state`);
    assert.equal(await page.locator(`#${project.id}`).isVisible(), selected, `${label}: visible summary`);
  }
  const panel = page.locator(`#${current.id}`);
  assert.equal((await panel.locator('h3').innerText()).trim(), current.title);
  assert.equal(await panel.locator('h3 a').getAttribute('href'), current.href);
  assert.ok((await page.request.get(origin + '/' + current.href)).ok(), `${label}: case study resolves`);
  assert.match(await page.locator('[data-project-status]').textContent(), /summary opened below/);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: page overflow`);
}

(async () => {
  let browser;
  let scenarios = 0;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const width of [320, 390, 820, 1440]) {
      for (const colorScheme of ['light', 'dark']) {
        const label = `${width}px ${colorScheme}`;
        const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, reducedMotion: 'reduce', hasTouch: width <= 820 });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(origin);
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('[data-project-folders]').isVisible(), true, label);
        assert.equal(await page.locator('[data-project-details]').isVisible(), false, label);
        for (const project of projects) {
          const button = page.locator(`[data-project="${project.id}"]`);
          assert.equal(await button.getAttribute('aria-controls'), project.id, label);
          assert.ok((await button.boundingBox()).height >= 44, `${label}: folder touch target`);
          await checkImage(page, button.locator('.sheet-image img'), `${label} ${project.title} folder`);
          assert.doesNotMatch(await button.locator('.sheet-image img').getAttribute('src'), /[?&]image_retry=/, `${label}: healthy thumbnail should not retry`);
          await button.click();
          await checkSelected(page, project, label);
          await checkImage(page, page.locator(`#${project.id} .project-art img`), `${label} ${project.title} summary`);
          assert.doesNotMatch(await page.locator(`#${project.id} .project-art img`).getAttribute('src'), /[?&]image_retry=/, `${label}: healthy summary should not retry`);
        }
        const folderBounds = await page.locator('.project-folder, .folder-title').evaluateAll(elements => elements.map(element => {
          const box = element.getBoundingClientRect();
          return { left: box.left, right: box.right, clipped: element.matches('.folder-title') && element.scrollWidth > element.clientWidth + 1 };
        }));
        assert.ok(folderBounds.every(box => box.left >= -1 && box.right <= width + 1 && !box.clipped), `${label}: folder labels fit ${JSON.stringify(folderBounds)}`);
        await page.locator('[data-project-close]').click();
        assert.equal(await page.locator('[data-project-details]').isVisible(), false, `${label}: close`);
        assert.ok(await page.locator('[data-project="project-luna"]').evaluate(element => element === document.activeElement), `${label}: close restores focus`);
        await page.locator('[data-project="project-lab"]').click();
        await page.locator('[data-project="project-lab"]').click();
        assert.equal(await page.locator('[data-project-details]').isVisible(), false, `${label}: selecting the same folder closes it`);
        assert.deepEqual(errors, [], `${label}: page errors`);
        await context.close();
        scenarios++;
      }
    }

    // Native keyboard activation, Escape and focus restoration.
    const keyboard = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const lab = keyboard.locator('[data-project="project-lab"]');
    await keyboard.goto(origin);
    await lab.focus();
    await lab.press('Enter');
    await checkSelected(keyboard, projects[0], 'keyboard Enter');
    await lab.press('Space');
    assert.equal(await keyboard.locator('[data-project-details]').isVisible(), false, 'keyboard Space closes selected folder');
    await lab.press('Enter');
    await lab.press('Escape');
    assert.equal(await keyboard.locator('[data-project-details]').isVisible(), false, 'Escape closes from the folder');
    await lab.press('Enter');
    await keyboard.locator('[data-project-close]').focus();
    await keyboard.keyboard.press('Escape');
    assert.equal(await keyboard.locator('[data-project-details]').isVisible(), false, 'Escape closes summary');
    assert.ok(await lab.evaluate(element => element === document.activeElement), 'Escape restores focus');
    await keyboard.close();

    // Hover lifts all three sheets, including after selecting the folder.
    const motion = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
    await motion.goto(origin);
    const motionFolder = motion.locator('[data-project="project-quest"]');
    const transforms = () => motionFolder.locator('.folder-sheet').evaluateAll(sheets => sheets.map(sheet => getComputedStyle(sheet).transform));
    const resting = await transforms();
    await motionFolder.hover();
    await delay(700);
    const fanned = await transforms();
    assert.ok(resting.every((value, index) => value !== fanned[index]), 'Hover fans each sheet');
    await motionFolder.click();
    await motion.mouse.move(0, 0);
    await delay(700);
    const selectedRest = await transforms();
    await motionFolder.hover();
    await delay(700);
    const selectedFan = await transforms();
    assert.ok(selectedRest.every((value, index) => value !== selectedFan[index]), 'Selected folder still fans on hover');
    await motion.close();

    const reduced = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await reduced.goto(origin);
    const reducedFolder = reduced.locator('[data-project="project-lab"]');
    const before = await reducedFolder.locator('.sheet-note').evaluate(element => getComputedStyle(element).transform);
    await reducedFolder.hover();
    assert.equal(await reducedFolder.locator('.sheet-note').evaluate(element => getComputedStyle(element).transform), before, 'Reduced motion keeps sheets still');
    await reducedFolder.click();
    await checkSelected(reduced, projects[0], 'reduced motion');
    await reduced.close();

    // Simulate a cached failure for each original image URL. Both the folder
    // preview and the summary should recover with one fresh request.
    const recovery = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    const retriedPaths = new Set();
    await recovery.route('**/assets/projects/**', async route => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has('image_retry')) {
        await route.fulfill({ status: 404, contentType: 'text/plain', body: 'simulated cached failure' });
      } else {
        retriedPaths.add(url.pathname);
        await route.continue();
      }
    });
    const recoveryPage = await recovery.newPage();
    await recoveryPage.goto(origin);
    for (const project of projects) {
      const folder = recoveryPage.locator(`[data-project="${project.id}"]`);
      const thumbnail = folder.locator('.sheet-image img');
      await checkImage(recoveryPage, thumbnail, `${project.title} recovered folder image`);
      assert.match(await thumbnail.getAttribute('src'), /[?&]image_retry=/, `${project.title}: folder retry`);
      await folder.click();
      const summary = recoveryPage.locator(`#${project.id} .project-art img`);
      await checkImage(recoveryPage, summary, `${project.title} recovered summary image`);
      assert.match(await summary.getAttribute('src'), /[?&]image_retry=/, `${project.title}: summary retry`);
      const lastSource = await summary.getAttribute('src');
      await summary.dispatchEvent('error');
      assert.equal(await summary.getAttribute('src'), lastSource, `${project.title}: retries stay bounded`);
    }
    assert.equal(retriedPaths.size, projects.length, 'Each project image received a fresh request');
    await recovery.close();

    // Printing and the no-JavaScript path retain all summaries and links.
    const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
    const nojs = await fallback.newPage();
    await nojs.goto(origin);
    assert.equal(await nojs.locator('[data-project-folders]').isVisible(), false);
    for (const project of projects) {
      assert.ok(await nojs.locator(`#${project.id}`).isVisible(), `${project.title}: no-JavaScript summary`);
      assert.equal(await nojs.locator(`#${project.id} h3 a`).getAttribute('href'), project.href);
      await checkImage(nojs, nojs.locator(`#${project.id} .project-art img`), `${project.title} no-JavaScript summary`);
    }
    await fallback.close();
    const print = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await print.goto(origin);
    await print.locator('[data-project="project-quest"]').click();
    await print.emulateMedia({ media: 'print' });
    for (const project of projects) assert.ok(await print.locator(`#${project.id}`).isVisible(), `${project.title}: print summary`);
    assert.equal(await print.locator('[data-project-folders]').isVisible(), false, 'Print omits folder controls');
    await print.close();

    // The expanded state is checked with axe, in addition to the general browser suite.
    const accessibility = await browser.newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    await accessibility.goto(origin);
    await accessibility.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    for (const project of projects) {
      await accessibility.locator(`[data-project="${project.id}"]`).click();
      const violations = await accessibility.evaluate(async () => (await axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }
      })).violations.map(violation => ({ id: violation.id, targets: violation.nodes.map(node => node.target) })));
      assert.deepEqual(violations, [], `${project.title}: accessibility checks`);
    }
    await accessibility.close();
    console.log(`PASS: ${scenarios} folder scenarios; decoded thumbnails and summaries, recovery from cached failures, switching, keyboard, focus, hover, reduced motion, print, no-JavaScript and expanded accessibility states.`);
  } finally {
    if (browser) await Promise.race([browser.close().catch(() => {}), delay(5000)]);
    if (server) { server.kill(); server.stdout.destroy(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  setTimeout(() => process.exit(Number.isInteger(process.exitCode) ? process.exitCode : 0), 250);
});
