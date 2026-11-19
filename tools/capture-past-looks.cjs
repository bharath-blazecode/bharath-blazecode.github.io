// Capture comparable views for the repository's screenshot archive.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const [change, stage, profile = 'home'] = process.argv.slice(2);
if (![change, stage].every(value => value && /^[a-z0-9-]+$/i.test(value)) || !['home', 'projects', 'signals', 'liquid'].includes(profile)) {
  console.error('Usage: node tools/capture-past-looks.cjs <dated-change> <stage> [home|projects|signals|liquid]');
  process.exit(1);
}
const archive = path.join(root, 'past looks', change);
const destination = path.join(archive, stage);
fs.mkdirSync(archive, { recursive: true });
// Never overwrite an earlier snapshot by accident.
fs.mkdirSync(destination);

const port = Number(process.env.SNAPSHOT_PORT) || 48771;
const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), root, String(port)], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const ready = new Promise((resolve, reject) => {
  server.stdout.once('data', resolve);
  server.once('error', reject);
  server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
});

(async () => {
  let browser;
  try {
    await ready;
    browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
    for (const view of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'phone', width: 390, height: 844 }
    ]) {
      const page = await browser.newPage({
        viewport: { width: view.width, height: view.height },
        colorScheme: 'light', reducedMotion: 'reduce', hasTouch: view.name === 'phone'
      });
      if (profile === 'liquid') {
        await page.emulateMedia({ reducedMotion: view.name === 'desktop' ? 'no-preference' : 'reduce' });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(destination, `${view.name}-idle.png`) });
        if (view.name === 'desktop') {
          const box = await page.locator('[data-investigation-desk]').boundingBox();
          await page.mouse.move(box.x - 70, box.y + box.height * .5);
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(destination, 'desktop-approach.png') });
          await page.mouse.move(box.x + box.width * .3, box.y + box.height * .4, { steps: 8 });
          await page.waitForTimeout(450);
          await page.screenshot({ path: path.join(destination, 'desktop-gathering.png') });
          await page.waitForTimeout(2000);
          await page.screenshot({ path: path.join(destination, 'desktop-settled.png') });
          await page.mouse.move(box.x + box.width * .1, box.y + box.height * .35);
          await page.waitForTimeout(2200);
          await page.locator('[data-investigation-desk]').screenshot({ path: path.join(destination, 'desktop-detail.png') });
          await page.mouse.move(box.x + box.width * .72, box.y + box.height * .55);
          await page.waitForTimeout(120);
          await page.screenshot({ path: path.join(destination, 'desktop-fast-movement.png') });
          await page.evaluate(() => document.querySelector('[data-desk-link="projects"]').addEventListener('click', event => {
            event.preventDefault();
            event.stopImmediatePropagation();
          }, { capture: true }));
          await page.locator('[data-desk-link="projects"]').click();
          await page.waitForTimeout(170);
          await page.screenshot({ path: path.join(destination, 'desktop-selection.png') });
        }
        await page.close();
        continue;
      }
      if (profile === 'signals') {
        await page.emulateMedia({ reducedMotion: view.name === 'desktop' ? 'no-preference' : 'reduce' });
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('[data-investigation-desk]').scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
        await page.screenshot({ path: path.join(destination, `${view.name}-idle.png`) });
        if (view.name === 'desktop') {
          const box = await page.locator('[data-investigation-desk]').boundingBox();
          await page.mouse.move(box.x - 70, box.y + box.height * .5);
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(destination, 'desktop-approach.png') });
          await page.mouse.move(box.x + box.width * .35, box.y + box.height * .45, { steps: 10 });
          await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(destination, 'desktop-inside.png') });
          await page.mouse.move(box.x - 180, box.y + box.height * .5);
          await page.waitForTimeout(300);
          await page.screenshot({ path: path.join(destination, 'desktop-return.png') });
        }
        await page.close();
        continue;
      }
      if (profile === 'projects') {
        await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.locator('[data-project="project-lab"]').click();
        await page.locator('#project-lab .project-art img').scrollIntoViewIfNeeded();
        await page.locator('#project-lab .project-art img').evaluate(image => image.decode());
        // Hide fixed elements that would cover a stitched section screenshot.
        await page.addStyleTag({ content: '.masthead, .skip, .chapter-rail, .field-tray { visibility: hidden !important; }' });
        await page.locator('#work').screenshot({ path: path.join(destination, `${view.name}-projects.png`) });

        await page.goto(`http://127.0.0.1:${port}/work/homelab/`, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);
        await page.addStyleTag({ content: '.masthead, .skip, .chapter-rail, .field-tray { visibility: hidden !important; }' });
        await page.locator('#evidence img').first().scrollIntoViewIfNeeded();
        await page.locator('#evidence img').first().evaluate(image => image.decode());
        await page.locator('#evidence').screenshot({ path: path.join(destination, `${view.name}-evidence.png`) });
        if (await page.locator('[data-notebook-next]').isVisible()) {
          await page.locator('[data-notebook-next]').click();
          await page.locator('#evidence').screenshot({ path: path.join(destination, `${view.name}-evidence-note-2.png`) });
        }
        await page.locator('#example').screenshot({ path: path.join(destination, `${view.name}-investigation.png`) });
        await page.close();
        continue;
      }
      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      // Trigger lazy images before the full-page capture.
      await page.evaluate(async () => {
        for (let top = 0; top < document.documentElement.scrollHeight; top += innerHeight) {
          scrollTo(0, top);
          await new Promise(resolve => setTimeout(resolve, 60));
        }
        scrollTo(0, 0);
        await Promise.all([...document.images].filter(image => image.getClientRects().length).map(image => image.decode().catch(() => {})));
      });
      await page.screenshot({ path: path.join(destination, `${view.name}-home.png`), fullPage: true });
      await page.locator('.hero').screenshot({ path: path.join(destination, `${view.name}-opening.png`) });
      if (await page.locator('[data-evidence-journey]').count()) {
        await page.locator('[data-evidence-journey]').screenshot({ path: path.join(destination, `${view.name}-journey.png`) });
      }
      await page.locator('[data-project="project-lab"]').click();
      await page.locator('[data-project-details]').screenshot({ path: path.join(destination, `${view.name}-project-summary.png`) });
      await page.locator('[data-project-close]').click();
      if (await page.locator('[data-field-tray]').count()) {
        await page.locator('[data-field-tray] summary').click();
        await page.locator('[data-field-tray]').screenshot({ path: path.join(destination, `${view.name}-field-tray.png`) });
        await page.locator('[data-field-tray] summary').click();
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await page.locator('[data-field-tray] summary').click();
        await page.locator('[data-tray-close]').click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(destination, `${view.name}-tray-shatter.png`) });
        await page.emulateMedia({ reducedMotion: 'reduce' });
      }
      await page.locator('[data-experience-target="experience-research"]').click();
      await page.locator('#experience').screenshot({ path: path.join(destination, `${view.name}-research.png`) });
      await page.close();
    }
    console.log(`Saved screenshots in ${path.relative(root, destination)}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
    server.stdout.destroy();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
