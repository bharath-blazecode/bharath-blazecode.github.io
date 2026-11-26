// Tests the writing checker against small fixture folders built in a temp directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { checkWriting } = require('../tools/check-writing.cjs');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'writing-'));

function run(html) {
  const dir = fs.mkdtempSync(path.join(tmp, 'site-'));
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  const result = checkWriting(dir);
  const mine = line => line.startsWith("index.html:");
  return { errors: result.errors.filter(mine), warnings: result.warnings.filter(mine) };
}

const page = body => `<!doctype html><html><head><title>Fine</title></head><body>${body}</body></html>`;

try {
  const banned = {
    'em dash': '\u2014', 'en dash': '\u2013', 'horizontal bar': '\u2015', 'middle dot': '\u00B7', bullet: '\u2022',
    ellipsis: '\u2026', 'right arrow': '\u2192', 'long arrow': '\u27F6', 'supplemental arrow': '\u2905',
    'check mark': '\u2713', 'heavy check': '\u2705', 'cross mark': '\u274C', times: '\u00D7', 'not equal': '\u2260',
    emoji: '\u{1F600}', 'sun symbol': '\u2600', 'emoji selector': '\uFE0F'
  };
  for (const [name, ch] of Object.entries(banned)) {
    assert.equal(run(page(`<p>one ${ch} two</p>`)).errors.length, 1, `${name} in text`);
    assert.equal(run(page(`<img src="a.png" alt="one ${ch} two">`)).errors.length, 1, `${name} in alt`);
    assert.equal(run(page(`<p title="one ${ch} two">x</p>`)).errors.length, 1, `${name} in title attribute`);
    assert.equal(run(page(`<button aria-label="a ${ch} b">x</button>`)).errors.length, 1, `${name} in aria-label`);
    assert.equal(run(page(`<input placeholder="a ${ch} b">`)).errors.length, 1, `${name} in placeholder`);
    for (const tag of ['<meta name="description"', '<meta property="og:title"', '<meta name="twitter:title"']) {
      assert.equal(run(`<html><head>${tag} content="a ${ch} b"></head><body></body></html>`).errors.length, 1, `${name} in ${tag}`);
    }
  }
  assert.equal(run('<html><head><title>a \u2014 b</title></head><body></body></html>').errors.length, 1, 'title element');

  const entities = ['&mdash;', '&ndash;', '&middot;', '&hellip;', '&rarr;', '&times;', '&#8212;', '&#x2013;', '&#X2026;', '&#xB7;'];
  for (const entity of entities) {
    assert.equal(run(page(`<p>a ${entity} b</p>`)).errors.length, 1, `entity ${entity}`);
    assert.equal(run(page(`<img alt="a ${entity} b" src="a.png">`)).errors.length, 1, `entity ${entity} in alt`);
  }

  const located = run(page('<p>first</p>\n<p>second \u2014 here</p>'));
  assert.match(located.errors[0], /index\.html:2: em dash/, 'finding names file, line and character');

  const allowed = run(page('<p>It\u2019s \u201Cfine\u201D, caf\u00E9, a@b.com and `code` &amp; &rsquo; &eacute;.</p>'));
  assert.deepEqual(allowed.errors, [], 'curly quotes, accents, at sign and backtick pass');

  const skipped = run(page(
    '<script>var a = "\u2014";</script><style>a::after { content: "\u2192"; }</style><!-- \u2014 --><p>ok</p>'
  ));
  assert.deepEqual(skipped.errors, [], 'script, style and comments are ignored');

  assert.equal(run(page('<code>\u2192</code>')).errors.length, 1, 'code is checked by default');
  assert.equal(run(page('<pre>\u2192</pre>')).errors.length, 1, 'pre is checked by default');
  assert.equal(run(page('<svg><text>\u2192</text></svg>')).errors.length, 1, 'svg is checked by default');
  assert.deepEqual(run(page('<code data-allow-symbols>a \u2192 b</code><p>ok</p>')).errors, [], 'code with data-allow-symbols is skipped');
  assert.deepEqual(run(page('<pre data-allow-symbols><code>a \u2192 b</code></pre>')).errors, [], 'nested content in pre is skipped');
  assert.equal(run(page('<pre data-allow-symbols>x</pre><p>\u2192</p>')).errors.length, 1, 'text after a skipped element is checked');

  const words = run(page('<p>We Delve into a robust, seamless journey; dive into it. In today\u2019s world, cutting-edge showcasing.</p>'));
  assert.deepEqual(words.errors, [], 'banned words do not fail');
  assert.ok(words.warnings.length >= 7, 'banned words warn');
  assert.equal(run(page('<p>A robustly built, journeyman tool.</p>')).warnings.length, 0, 'whole words only');
  assert.equal(run(page('<script>var robust = 1;</script>')).warnings.length, 0, 'words in scripts are ignored');

  console.log('PASS writing checker');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
