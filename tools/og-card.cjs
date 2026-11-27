// Draws the 1200 by 630 social preview card. Needs the dev dependencies.
// Usage: node tools/og-card.cjs
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const font = name => fs.readFileSync(path.join(root, 'assets/fonts', name)).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face { font-family: Archivo; src: url(data:font/woff2;base64,${font('archivo-variable.woff2')}); font-weight: 100 900; }
@font-face { font-family: Serif; src: url(data:font/woff2;base64,${font('source-serif-italic.woff2')}); font-style: italic; font-weight: 200 900; }
@font-face { font-family: Mono; src: url(data:font/woff2;base64,${font('cascadia-mono-400.woff2')}); }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; padding: 54px 66px; background: #f3f4ef; color: #1d231c; font-family: Archivo, Arial, sans-serif; display: flex; flex-direction: column; }
.top { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 20px; border-bottom: 2px solid #1d231c; font-size: 24px; }
.top b { font-weight: 800; }
.top span { font-family: Mono, monospace; font-size: 17px; letter-spacing: .04em; text-transform: uppercase; color: #566052; }
h1 { margin-top: 44px; font-weight: 900; font-size: 158px; line-height: .86; letter-spacing: -.055em; }
h1 span { display: block; }
em { position: relative; font-family: Serif, Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: -.04em; }
em::before { content: ""; position: absolute; z-index: -1; left: -14px; right: -18px; bottom: 16px; height: 34px; border-radius: 17px; background: #dde84a; transform: rotate(-1.2deg); }
h1, em { isolation: auto; }
p { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; font-size: 27px; line-height: 1.25; font-weight: 550; letter-spacing: -.01em; }
p i { font-style: normal; font-family: Mono, monospace; font-size: 18px; letter-spacing: .04em; text-transform: uppercase; background: #1d231c; color: #f3f4ef; padding: 12px 18px; border-radius: 4px; }
</style><body><div class="top"><b>Barry Sampath</b><span>Cybersecurity and IT automation</span></div>
<h1><span>Security is in</span><span>the <em>details.</em></span></h1>
<p><span>Identity controls, IT automation<br>and research on AI in cyber risk.</span><i>Brisbane / open to 2027 roles</i></p></body>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const file = path.join(root, 'assets', 'og-portfolio.jpg');
  await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
  await browser.close();
  console.log('Wrote assets/og-portfolio.jpg', Math.round(fs.statSync(file).size / 1024) + ' KB');
})();
