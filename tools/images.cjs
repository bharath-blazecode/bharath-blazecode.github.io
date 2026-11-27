// Makes WebP copies of the JPEG screenshots at a few widths. Needs the dev dependencies.
// Usage: node tools/images.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const widths = [480, 960, 1440];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const dir of ['assets/projects', 'assets/competitions']) {
    for (const name of fs.readdirSync(path.join(root, dir)).filter(file => file.endsWith('.jpg'))) {
      const data = 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, dir, name)).toString('base64');
      for (const width of widths) {
        const out = await page.evaluate(async ([src, target]) => {
          const image = new Image();
          image.src = src;
          await image.decode();
          if (image.naturalWidth < target * .9) return null;
          const w = Math.min(target, image.naturalWidth);
          const h = Math.round(image.naturalHeight * w / image.naturalWidth);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const context = canvas.getContext('2d');
          context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, w, h);
          return canvas.toDataURL('image/webp', .8).split(',')[1];
        }, [data, width]);
        if (!out) continue;
        const file = path.join(root, dir, name.replace('.jpg', `-${width}.webp`));
        fs.writeFileSync(file, Buffer.from(out, 'base64'));
        console.log(path.relative(root, file), Math.round(fs.statSync(file).size / 1024) + ' KB');
      }
    }
  }
  await browser.close();
})();
