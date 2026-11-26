// Checks built pages, README.md, llms.txt and visitor-facing script strings against the writing rules.
// Usage: node tools/check-writing.cjs [dir]   (default: dist)
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const BANNED = /[\u2014\u2013\u2015\u00B7\u2022\u2026\u2190-\u21FF\u27F0-\u27FF\u2900-\u297F\u2713-\u2718\u2705\u274C\u00D7\u2260\u{1F000}-\u{1FAFF}\u2600-\u27BF\uFE0F]/gu;

const NAMES = {
  0x2014: 'em dash', 0x2013: 'en dash', 0x2015: 'horizontal bar', 0xB7: 'middle dot', 0x2022: 'bullet',
  0x2026: 'ellipsis', 0xD7: 'multiplication sign', 0x2260: 'not-equal sign', 0x2705: 'check mark',
  0x274C: 'cross mark', 0xFE0F: 'emoji selector'
};

function charName(ch) {
  const cp = ch.codePointAt(0);
  if (NAMES[cp]) return NAMES[cp];
  const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
  if ((cp >= 0x2190 && cp <= 0x21FF) || (cp >= 0x27F0 && cp <= 0x27FF) || (cp >= 0x2900 && cp <= 0x297F)) return `arrow ${hex}`;
  if (cp >= 0x2713 && cp <= 0x2718) return `check or cross ${hex}`;
  return `symbol or emoji ${hex}`;
}

const WORDS = [
  'delve', 'seamless', 'seamlessly', 'leverage', 'leveraging', 'robust', 'elevate', 'tapestry', 'testament',
  'journey', 'crafted', 'passionate', 'cutting-edge', 'game-changer', 'unlock', 'empower', 'empowering',
  'dive into', 'navigate the landscape', 'in today[\'\\u2019]s world', 'at the intersection of',
  'meticulous', 'meticulously', 'showcase', 'showcasing'
];
const WORD_RE = new RegExp(`(?<![\\w-])(?:${WORDS.join('|')})(?![\\w-])`, 'gi');

const ENTITIES = {
  mdash: '\u2014', ndash: '\u2013', horbar: '\u2015', middot: '\u00B7', bull: '\u2022', hellip: '\u2026',
  rarr: '\u2192', larr: '\u2190', uarr: '\u2191', darr: '\u2193', harr: '\u2194', rArr: '\u21D2', lArr: '\u21D0',
  times: '\u00D7', ne: '\u2260', check: '\u2713', cross: '\u2717', amp: '&', lt: '<', gt: '>', quot: '"',
  apos: '\'', nbsp: ' ', lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D', copy: '\u00A9'
};

function decode(text) {
  return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|(\w+));/g, (whole, dec, hex, name) => {
    const cp = dec ? Number(dec) : hex ? parseInt(hex, 16) : null;
    if (cp !== null) return cp <= 0x10FFFF ? String.fromCodePoint(cp) : whole;
    return Object.prototype.hasOwnProperty.call(ENTITIES, name) ? ENTITIES[name] : whole;
  });
}

function lineAt(source, offset) {
  let line = 1;
  for (let i = 0; i < offset; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

function excerpt(text, at) {
  return JSON.stringify(text.slice(Math.max(0, at - 20), at + 20).replace(/\s+/g, ' ').trim());
}

// Records findings for one piece of text that starts at a known line.
function scan(text, file, line, out) {
  const decoded = decode(text);
  const lineOf = index => line + decoded.slice(0, index).split('\n').length - 1;
  for (const m of decoded.matchAll(BANNED)) {
    out.errors.push(`${file}:${lineOf(m.index)}: ${charName(m[0])} in ${excerpt(decoded, m.index)}`);
  }
  for (const m of decoded.matchAll(WORD_RE)) {
    out.warnings.push(`${file}:${lineOf(m.index)}: banned word "${m[0]}" in ${excerpt(decoded, m.index)}`);
  }
}

function attrs(tag) {
  const found = {};
  for (const m of tag.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    found[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return found;
}

function checkHtml(source, file, out) {
  const blanked = source.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '));
  const lower = blanked.toLowerCase();
  const token = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;
  let last = 0;
  let skipName = null;
  let skipDepth = 0;
  let m;
  const text = (from, to) => {
    if (to > from && !skipName) scan(blanked.slice(from, to), file, lineAt(source, from), out);
  };
  while ((m = token.exec(blanked))) {
    text(last, m.index);
    last = m.index + m[0].length;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const selfClosed = m[3].trimEnd().endsWith('/');
    if (skipName) {
      if (name === skipName) {
        if (closing) skipDepth--; else if (!selfClosed) skipDepth++;
        if (skipDepth === 0) skipName = null;
      }
      continue;
    }
    if (closing) continue;
    const a = attrs(m[3]);
    const line = lineAt(source, m.index);
    for (const key of ['alt', 'title', 'aria-label', 'placeholder']) {
      if (key in a) scan(a[key], file, line, out);
    }
    if (name === 'meta' && 'content' in a) {
      const label = (a.name || a.property || '').toLowerCase();
      if (label === 'description' || label.startsWith('og:') || label.startsWith('twitter:')) scan(a.content, file, line, out);
    }
    if (name === 'script' || name === 'style') {
      const end = lower.indexOf(`</${name}`, last);
      last = end === -1 ? blanked.length : end;
      token.lastIndex = last;
    } else if (['svg', 'code', 'pre'].includes(name) && 'data-allow-symbols' in a && !selfClosed) {
      skipName = name;
      skipDepth = 1;
    }
  }
  text(last, blanked.length);
}

function unescapeJs(literal) {
  return literal.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([\s\S]))/g, (_, a, b, c, d) => {
    const hex = a || b || c;
    return hex ? String.fromCodePoint(parseInt(hex, 16)) : d;
  });
}

function checkScript(source, file, out) {
  const literal = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\[\s\S])*`/g;
  for (const m of source.matchAll(literal)) {
    const inner = unescapeJs(m[0].slice(1, -1));
    for (const hit of inner.matchAll(BANNED)) {
      out.errors.push(`${file}:${lineAt(source, m.index)}: ${charName(hit[0])} in ${excerpt(inner, hit.index)}`);
    }
  }
}

function listHtml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listHtml(full);
    return entry.name.endsWith('.html') ? [full] : [];
  });
}

function checkWriting(dir = 'dist') {
  const base = path.resolve(dir);
  const out = { errors: [], warnings: [], files: 0 };
  for (const file of listHtml(base).sort()) {
    checkHtml(fs.readFileSync(file, 'utf8'), path.relative(base, file).replace(/\\/g, '/'), out);
    out.files++;
  }
  for (const name of ['README.md', 'llms.txt']) {
    const file = path.join(root, name);
    if (!fs.existsSync(file)) continue;
    scan(fs.readFileSync(file, 'utf8'), name, 1, out);
    out.files++;
  }
  for (const name of ['terminal.js', 'terminal-data.js', 'explainer.js', 'site.js', 'home.js', 'homelab.js', 'classquest.js']) {
    const file = path.join(root, 'js', name);
    if (!fs.existsSync(file)) continue;
    checkScript(fs.readFileSync(file, 'utf8'), 'js/' + name, out);
    out.files++;
  }
  return out;
}

module.exports = { checkWriting };

if (require.main === module) {
  const result = checkWriting(process.argv[2] || 'dist');
  for (const line of result.warnings) console.log('warn  ' + line);
  for (const line of result.errors) console.log('FAIL  ' + line);
  console.log(`Writing check: ${result.files} files, ${result.errors.length} errors, ${result.warnings.length} warnings`);
  process.exit(result.errors.length ? 1 : 0);
}
