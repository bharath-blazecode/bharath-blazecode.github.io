// Renders the still image shown before the 3D desk loads. Run after changing src/desk-scene.js.
// Usage: node tools/bundle-desk.cjs, then node tools/desk-poster.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startSite } = require('../tests/helpers/site.cjs');

(async () => {
  const site = await startSite(48790);
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
  try {
    for (const [name, width] of [['poster-wide', 1100], ['poster-narrow', 490]]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      await page.goto(site.url, { waitUntil: 'load' });
      const data = await page.evaluate(() => document.querySelector('[data-desk]').capture());
      if (!data) throw new Error('The desk did not render');
      const size = await page.evaluate(() => { const c = document.querySelector('[data-desk-canvas]'); return [c.width, c.height]; });
      fs.writeFileSync(path.join(__dirname, '..', 'assets', 'desk', name + '.webp'), Buffer.from(data.split(',')[1], 'base64'));
      console.log(name, size.join('x'));
      await page.close();
    }
  } finally {
    await browser.close();
    site.stop();
  }
})();
