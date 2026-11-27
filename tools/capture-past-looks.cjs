// Saves comparable screenshots of the site into "past looks". Needs the dev dependencies.
// Usage: node tools/capture-past-looks.cjs <dated-change> <before|after>
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { root } = require('./site.cjs');
const { startSite } = require('../tests/helpers/site.cjs');

const [change, stage] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/.test(change || '') || !['before', 'after'].includes(stage)) {
  console.error('Usage: node tools/capture-past-looks.cjs <yyyy-mm-dd-name> <before|after>');
  process.exit(2);
}
const destination = path.join(root, 'past looks', change, stage);
if (fs.existsSync(destination)) {
  console.error('That capture already exists. Existing captures are never overwritten.');
  process.exit(1);
}

(async () => {
  const site = await startSite(Number(process.env.SNAPSHOT_PORT) || 48789);
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  try {
    fs.mkdirSync(destination, { recursive: true });
    const views = [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]];
    for (const [name, viewport] of views) {
      // Light theme and reduced motion, so settled designs are easy to compare.
      const page = await browser.newPage({ viewport, colorScheme: 'light', reducedMotion: 'reduce', isMobile: name === 'phone', hasTouch: name === 'phone' });
      await page.goto(site.url, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(destination, `${name}-opening.png`) });
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += 600) await page.evaluate(top => scrollTo(0, top), y);
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: path.join(destination, `${name}-home.png`), fullPage: true });
      for (const [section, file] of [['#work', 'work'], ['#research', 'research']]) {
        await page.locator(section).scrollIntoViewIfNeeded();
        await page.locator(section).screenshot({ path: path.join(destination, `${name}-${file}.png`) });
      }
      await page.close();
    }
    console.log('Saved to ' + path.relative(root, destination));
  } finally {
    await browser.close();
    site.stop();
  }
})();
