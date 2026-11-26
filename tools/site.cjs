// Renders src/pages into a static site. Shared markup lives in src/partials.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'src', 'pages');
const partialsDir = path.join(root, 'src', 'partials');
const origin = 'https://bharath-blazecode.github.io';
const copied = ['favicon.svg', '.nojekyll', 'robots.txt', 'sitemap.xml', 'llms.txt', 'css', 'js', 'assets', 'resume'];

const read = file => fs.readFileSync(file, 'utf8');
const partial = name => read(path.join(partialsDir, name + '.html'));
const hash = text => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
const escapeAttr = text => String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;');

function listPages(dir = pagesDir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listPages(full);
    // Pages still waiting to be moved onto the shared layout are skipped.
    return entry.name.endsWith('.html') && read(full).startsWith('<!--page') ? [path.relative(pagesDir, full).replace(/\\/g, '/')] : [];
  }).sort();
}

// A page starts with a comment block of "key: value" lines.
function parsePage(rel) {
  const source = read(path.join(pagesDir, rel));
  const match = source.match(/^<!--page\r?\n([\s\S]*?)\r?\n-->\r?\n?/);
  if (!match) throw new Error(`${rel} is missing its <!--page ... --> block`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(':');
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  return { meta, body: source.slice(match[0].length) };
}

function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/\s*([{};])\s*/g, '$1').replace(/;}/g, '}').trim();
}

function includes(html, depth = 0) {
  if (depth > 5) throw new Error('Includes are nested too deeply');
  return html.replace(/<!--\s*@include\s+([\w-]+)\s*-->/g, (_, name) => includes(partial(name), depth + 1));
}

function renderPage(rel) {
  const { meta, body } = parsePage(rel);
  const depth = rel.split('/').length - 1;
  const base = '../'.repeat(depth);
  const route = '/' + rel.replace(/index\.html$/, '');
  const themeScript = read(path.join(root, 'js', 'theme.js')).trim();
  const css = minifyCss((meta.css || 'base').split(/\s+/).map(name => read(path.join(root, 'css', name + '.css'))).join('\n'))
    .replace(/url\((['"]?)\.\.\//g, `url($1${base}`);
  const scripts = (meta.scripts || 'site').split(/\s+/).filter(Boolean)
    .map(name => `<script src="${base}js/${name}.js" defer></script>`).join('');
  const jsonld = meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(JSON.parse(read(path.join(root, 'src', 'data', meta.jsonld + '.json'))))}</script>` : '';
  const csp = [
    "default-src 'self'", `script-src 'self' ${hash(themeScript)}`, `style-src 'self' ${hash(css)}`,
    "img-src 'self' data:", "font-src 'self'", "connect-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'"
  ].join('; ');
  const vars = {
    root: base, title: escapeAttr(meta.title), description: escapeAttr(meta.description), canonical: origin + route,
    bodyClass: meta.body || '', robots: meta.robots ? `<meta name="robots" content="${meta.robots}">` : '',
    preload: (meta.preload || '').split(/\s+/).filter(Boolean).map(file => `<link rel="preload" href="${base}assets/fonts/${file}" as="font" type="font/woff2" crossorigin>`).join(''),
    ogTitle: escapeAttr(meta.ogTitle || meta.title), ogImage: origin + '/assets/' + (meta.ogImage || 'og-portfolio.jpg'),
    ogImageAlt: escapeAttr(meta.ogImageAlt || 'Barry Sampath, cybersecurity and IT automation'),
    csp: escapeAttr(csp), themeScript, css, scripts, jsonld, content: includes(body)
  };
  const html = includes(partial('layout')).replace(/\{\{(\w+)\}\}/g, (whole, key) => (key in vars ? vars[key] : whole));
  const missing = html.match(/\{\{\w+\}\}/);
  if (missing) throw new Error(`${rel} has an unknown placeholder ${missing[0]}`);
  return html;
}

function build(out) {
  if (fs.existsSync(out)) {
    if (fs.realpathSync(out) !== out) throw new Error('Refusing to replace redirected output directory');
    fs.rmSync(out, { recursive: true });
  }
  fs.mkdirSync(out, { recursive: true });
  for (const entry of copied) {
    const from = path.join(root, entry);
    if (fs.existsSync(from)) fs.cpSync(from, path.join(out, entry), { recursive: true });
  }
  const pages = listPages();
  for (const rel of pages) {
    const file = path.join(out, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderPage(rel));
  }
  return pages;
}

module.exports = { root, origin, listPages, parsePage, renderPage, build, minifyCss };
