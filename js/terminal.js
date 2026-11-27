// Simulated terminal overlay. It reads static text from terminal-data.js and runs nothing.
import { BIN, tree, links, man, refuse } from './terminal-data.js';

const SITE = new URL('../', import.meta.url);
const CSS = new URL('../css/terminal.css', import.meta.url).href;
const HOME = ['home', 'barry'];
const ROOT = { home: { barry: tree } };
const ENV = { HOME: '/home/barry', USER: 'barry', SHELL: '/bin/bash', HOSTNAME: 'field-notes' };
const KNOWN = { d: 1, e: 1, m: 1, y: 1, x: 1 };
const S = { cwd: [...HOME], old: null, hist: [], status: 0, built: false, trigger: null, els: null };

const fmt = (c, s) => `\x01${c}${s}\x02`;
const strip = s => s.replace(/\x01.|\x02/g, '');
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const isDir = n => typeof n === 'object';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const byName = (a, b) => a.replace(/^\./, '').localeCompare(b.replace(/^\./, ''), 'en');
const names = (node, all) => Object.keys(node).filter(k => all || k[0] !== '.').sort(byName);

function resolve(p) {
  let segs = p[0] === '/' ? [] : [...S.cwd];
  let rest = p;
  if (p === '~' || p.startsWith('~/')) { segs = [...HOME]; rest = p.slice(1); }
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') segs.pop(); else segs.push(part);
  }
  let node = ROOT;
  for (const s of segs) {
    if (!isDir(node)) return { err: 'Not a directory' };
    if (!own(node, s)) return { err: 'No such file or directory' };
    node = node[s];
  }
  return { segs, node };
}

function show(segs) {
  const home = HOME.every((s, i) => segs[i] === s);
  return home ? ['~', ...segs.slice(2)].join('/') : '/' + segs.join('/');
}

function linkFor(segs) {
  const rel = segs.slice(2);
  for (let n = rel.length; n >= 0; n--) {
    const key = rel.slice(0, n).join('/');
    if (own(links, key)) return links[key];
  }
  return '';
}

const leaves = (node, p) => names(node, true).flatMap(k => {
  const q = p ? p + '/' + k : k;
  return isDir(node[k]) ? leaves(node[k], q) : [q];
});

// Parsing. Words, quotes, $VAR, ~, and the operators | ; &&.

function lex(line) {
  const toks = [];
  let cur = null, q = null;
  const add = (s, quoted) => { cur = cur || { v: '', q: false }; cur.v += s; if (quoted) cur.q = true; };
  const flush = () => { if (cur) { toks.push(cur); cur = null; } };
  const dollar = (i, quoted) => {
    const m = /^\$(\?|[A-Za-z_]\w*)/.exec(line.slice(i));
    if (!m) { add('$', quoted); return i; }
    const k = m[1];
    add(k === '?' ? String(S.status) : own(ENV, k) ? ENV[k] : '', true);
    return i + m[0].length - 1;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q === "'") { if (c === "'") q = null; else add(c, 1); continue; }
    if (q === '"') {
      if (c === '"') q = null;
      else if (c === '\\' && '"\\$'.includes(line[i + 1] || '')) add(line[++i], 1);
      else if (c === '$') i = dollar(i, 1);
      else add(c, 1);
      continue;
    }
    if (c === "'" || c === '"') { q = c; add('', 1); }
    else if (/\s/.test(c)) flush();
    else if (c === '|' || c === ';' || (c === '&' && line[i + 1] === '&')) {
      flush();
      const op = c === '&' ? '&&' : c;
      toks.push({ op });
      i += op.length - 1;
    } else if (c === '\\' && i + 1 < line.length) add(line[++i], 1);
    else if (c === '$') i = dollar(i, 0);
    else if (c === '~' && !cur && (i + 1 === line.length || /[\s/]/.test(line[i + 1]))) add(ENV.HOME);
    else add(c);
  }
  if (q) return { err: `bash: unexpected EOF while looking for matching \`${q}'` };
  flush();
  return { toks };
}

function glob(tok) {
  if (tok.q || !/[*?]/.test(tok.v)) return [tok.v];
  const at = tok.v.lastIndexOf('/') + 1;
  const dir = tok.v.slice(0, at), pat = tok.v.slice(at);
  const d = resolve(dir || '.');
  if (d.err || !isDir(d.node)) return [tok.v];
  const re = new RegExp('^' + esc(pat).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$');
  const hits = names(d.node, pat[0] === '.').filter(n => re.test(n));
  return hits.length ? hits.map(n => dir + n) : [tok.v];
}

function parse(line) {
  const { toks, err } = lex(line);
  if (err) return { err };
  const plan = [];
  let pipe = [], argv = [], conn = ';';
  const bad = t => ({ err: `bash: syntax error near unexpected token \`${t}'` });
  for (const t of toks) {
    if (!t.op) { argv.push(...glob(t)); continue; }
    if (!argv.length) return bad(t.op);
    pipe.push(argv); argv = [];
    if (t.op !== '|') { plan.push({ pipe, conn }); pipe = []; conn = t.op; }
  }
  if (argv.length) pipe.push(argv);
  else if (pipe.length) return bad('newline');
  if (pipe.length) plan.push({ pipe, conn });
  return { plan };
}

function opts(args, spec, cmd, io) {
  const f = {}, rest = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { rest.push(...args.slice(i + 1)); break; }
    if (a[0] !== '-' || a === '-') { rest.push(a); continue; }
    for (let j = 1; j < a.length; j++) {
      const k = a[j], at = spec.indexOf(k);
      if (at < 0 || k === ':') { io.err(`${cmd}: invalid option -- '${k}'`); return null; }
      if (spec[at + 1] === ':') {
        f[k] = a.slice(j + 1) || args[++i];
        if (f[k] === undefined) { io.err(`${cmd}: option requires an argument -- '${k}'`); return null; }
        break;
      }
      f[k] = true;
    }
  }
  return { f, rest };
}

function files(list, cmd, io) {
  const out = [];
  for (const n of list) {
    const x = resolve(n);
    if (x.err) io.err(`${cmd}: ${n}: ${x.err}`);
    else if (isDir(x.node)) io.err(`${cmd}: ${n}: Is a directory`);
    else if (x.node === BIN) io.err(`${cmd}: ${n}: binary file, try: open ${n}`);
    else out.push([n, x.node.split('\n')]);
  }
  return out;
}

function sources(list, cmd, io) {
  return list.length ? files(list, cmd, io) : [[null, io.in || []]];
}

// Commands. Each gets (args, io). io.in is piped text or null, io.out collects lines.

const C = {
  ls(a, io) {
    const o = opts(a, 'la', 'ls', io);
    if (!o) return;
    const all = o.f.a, long = o.f.l;
    const entry = (name, node) => {
      const d = isDir(node), nm = d ? fmt('d', name) : name;
      if (!long) return nm;
      const size = String(d ? 4096 : node.length).padStart(5);
      return `${d ? 'drwxr-xr-x 2' : '-rw-r--r-- 1'} barry barry ${size} Nov 12 09:00 ${nm}`;
    };
    const targets = o.rest.length ? o.rest : ['.'];
    const fl = [], dirs = [];
    for (const t of targets) {
      const x = resolve(t);
      if (x.err) io.err(`ls: cannot access '${t}': ${x.err}`);
      else (isDir(x.node) ? dirs : fl).push([t, x.node]);
    }
    const blocks = [];
    if (fl.length) blocks.push(long ? fl.map(([t, n]) => entry(t, n)) : io.last ? [fl.map(([t]) => t).join('  ')] : fl.map(([t]) => t));
    dirs.sort((p, q) => byName(p[0], q[0]));
    for (const [t, node] of dirs) {
      const list = names(node, all).map(k => [k, node[k]]);
      if (o.f.a) list.unshift(['.', {}], ['..', {}]);
      const cells = list.map(([k, n]) => entry(k, n));
      const body = long ? [`total ${list.length * 4}`, ...cells] : io.last ? [cells.join('  ')] : cells;
      blocks.push(targets.length > 1 ? [t + ':', ...body] : body);
    }
    blocks.forEach((b, i) => { if (i) io.out.push(''); io.out.push(...b); });
  },

  cd(a, io) {
    let to = a[0] === undefined ? '~' : a[0];
    if (to === '-') {
      if (!S.old) return io.err('bash: cd: OLDPWD not set');
      to = '/' + S.old.join('/');
      io.out.push(to);
    }
    const x = resolve(to);
    if (x.err) return io.err(`bash: cd: ${a[0]}: ${x.err}`);
    if (!isDir(x.node)) return io.err(`bash: cd: ${a[0]}: Not a directory`);
    if (!io.piped) { S.old = S.cwd; S.cwd = x.segs; }
  },

  pwd(a, io) { io.out.push('/' + S.cwd.join('/')); },

  cat(a, io) {
    const o = opts(a, '', 'cat', io);
    if (!o) return;
    if (!o.rest.length) { if (io.in) io.out.push(...io.in); return; }
    for (const [, lines] of files(o.rest, 'cat', io)) io.out.push(...lines);
  },

  tree(a, io) {
    const o = opts(a, 'a', 'tree', io);
    if (!o) return;
    let dirs = 0, count = 0;
    for (const t of o.rest.length ? o.rest : ['.']) {
      const x = resolve(t);
      if (x.err || !isDir(x.node)) { io.out.push(`${t} [error opening dir]`); continue; }
      io.out.push(fmt('d', t));
      const walk = (node, pre) => {
        const ks = names(node, o.f.a);
        ks.forEach((k, i) => {
          const last = i === ks.length - 1, d = isDir(node[k]);
          io.out.push(pre + (last ? '`-- ' : '|-- ') + (d ? fmt('d', k) : k));
          if (d) { dirs++; walk(node[k], pre + (last ? '    ' : '|   ')); } else count++;
        });
      };
      walk(x.node, '');
    }
    io.out.push('', `${dirs} director${dirs === 1 ? 'y' : 'ies'}, ${count} file${count === 1 ? '' : 's'}`);
  },

  grep(a, io) {
    const o = opts(a, 'invcr', 'grep', io);
    if (!o) return;
    const [pat, ...rest] = o.rest;
    const usage = 'Usage: grep [OPTION]... PATTERNS [FILE]...';
    if (pat === undefined) return io.err(usage);
    const flags = o.f.i ? 'i' : '';
    let re;
    try { re = new RegExp(pat, flags + 'g'); } catch (e) { re = new RegExp(esc(pat), flags + 'g'); }
    const test = new RegExp(re.source, flags);
    const list = o.f.r ? (rest.length ? rest : ['.']).flatMap(t => {
      const x = resolve(t);
      return x.node && isDir(x.node) ? leaves(x.node, rest.length ? t : '') : [t];
    }) : rest;
    if (!list.length && !io.in) return io.err(usage);
    const src = sources(list, 'grep', io);
    const multi = src.length > 1 || o.f.r;
    for (const [name, lines] of src) {
      let n = 0;
      lines.forEach((l, i) => {
        if (test.test(l) === !!o.f.v) return;
        n++;
        if (o.f.c) return;
        const head = (multi && name ? fmt('d', name) + ':' : '') + (o.f.n ? fmt('d', i + 1) + ':' : '');
        io.out.push(head + (o.f.v ? l : l.replace(re, m => (m ? fmt('m', m) : m))));
      });
      if (o.f.c) io.out.push((multi && name ? name + ':' : '') + n);
    }
  },

  find(a, io) {
    const start = [];
    let i = 0;
    while (i < a.length && a[i][0] !== '-') start.push(a[i++]);
    let pat = null, type = '';
    for (; i < a.length; i += 2) {
      if (a[i] === '-name') {
        if (a[i + 1] === undefined) return io.err(`find: missing argument to \`${a[i]}'`);
        pat = new RegExp('^' + esc(a[i + 1]).replace(/\\\*/g, '.*').replace(/\\\?/g, '.') + '$');
      } else if (a[i] === '-type') type = a[i + 1];
      else return io.err(`find: unknown predicate \`${a[i]}'`);
    }
    const hit = (name, d) => (!pat || pat.test(name)) && (!type || (type === 'd') === d);
    const walk = (path, node, base) => {
      if (hit(base, isDir(node))) io.out.push(path);
      if (isDir(node)) for (const k of names(node, true)) walk(path.replace(/\/$/, '') + '/' + k, node[k], k);
    };
    for (const s of start.length ? start : ['.']) {
      const x = resolve(s);
      if (x.err) io.err(`find: '${s}': ${x.err}`); else walk(s, x.node, s.split('/').pop() || s);
    }
  },

  head(a, io) { cut('head', a, io); },
  tail(a, io) { cut('tail', a, io); },

  wc(a, io) {
    const o = opts(a, 'lwc', 'wc', io);
    if (!o) return;
    const want = ['l', 'w', 'c'].filter(k => o.f[k]);
    const keys = want.length ? want : ['l', 'w', 'c'];
    for (const [name, lines] of sources(o.rest, 'wc', io)) {
      const text = lines.join('\n');
      const n = { l: lines.length, w: text.split(/\s+/).filter(Boolean).length, c: text.length + 1 };
      const nums = keys.map(k => String(n[k]).padStart(keys.length > 1 ? 7 : 0));
      io.out.push(nums.join(' ') + (name ? ' ' + name : ''));
    }
  },

  echo(a, io) { io.out.push(a.join(' ')); },
  whoami(a, io) { io.out.push('barry'); },
  uname(a, io) { io.out.push(a.includes('-a') ? 'Linux field-notes 6.1.0-sandbox #1 SMP x86_64 GNU/Linux (simulated)' : 'Linux'); },
  date(a, io) { io.out.push(new Date().toUTCString().replace(',', '').replace('GMT', 'UTC')); },
  history(a, io) { S.hist.forEach((h, i) => io.out.push(String(i + 1).padStart(5) + '  ' + h)); },
  clear(a, io) { io.clear = true; },
  exit(a, io) { io.exit = true; },

  man(a, io) {
    if (!a[0]) return io.err('What manual page do you want?');
    const m = own(man, a[0]) && man[a[0]];
    if (!m) return io.err(`No manual entry for ${a[0]}`);
    io.out.push(`${a[0].toUpperCase()}(1)   simulated manual`, '', fmt('y', 'NAME'), `    ${a[0]} - ${m[0]}`, '', fmt('y', 'SYNOPSIS'), `    ${m[1]}`, '', fmt('y', 'DESCRIPTION'), `    ${m[2]}`);
  },

  help(a, io) {
    for (const [k, v] of Object.entries(man)) io.out.push(fmt('y', k) + ' '.repeat(9 - k.length) + v[0]);
    io.out.push('', fmt('x', 'Pipes work: ls | grep w, cat file | head -n 3, grep x file | wc -l.'));
    io.out.push(fmt('x', 'nmap, ssh, sudo, curl and friends are refused on purpose.'));
    io.out.push(fmt('x', 'Keys: Tab completes, Up and Down move through history, Ctrl+L clears, Ctrl+C cancels, Esc closes.'));
  },

  open(a, io) {
    if (!a[0]) return io.err('open: missing path. Try: open work/homelab');
    const x = resolve(a[0]);
    if (x.err) return io.err(`open: ${a[0]}: ${x.err}`);
    const rel = linkFor(x.segs);
    io.out.push(`Opening ${rel || './'}`);
    io.go = new URL(rel, SITE).href;
  }
};

function cut(cmd, a, io) {
  const o = opts(a.flatMap(x => (/^-\d+$/.test(x) ? ['-n', x.slice(1)] : [x])), 'n:', cmd, io);
  if (!o) return;
  const n = o.f.n === undefined ? 10 : Number(o.f.n);
  if (!(n >= 0) || !Number.isInteger(n)) return io.err(`${cmd}: invalid number of lines: '${o.f.n}'`);
  const src = sources(o.rest, cmd, io);
  src.forEach(([name, lines], i) => {
    if (src.length > 1) io.out.push((i ? '\n' : '') + `==> ${name} <==`);
    io.out.push(...(cmd === 'head' ? lines.slice(0, n) : n ? lines.slice(-n) : []));
  });
}

function run(line) {
  const res = { out: [], errs: [] };
  const { plan, err } = parse(line);
  if (err) { res.errs.push(err); S.status = 2; return res; }
  for (const { pipe, conn } of plan) {
    if (conn === '&&' && S.status) break;
    let input = null;
    pipe.forEach((argv, i) => {
      S.status = 0;
      const [cmd, ...args] = argv;
      const io = { in: input, out: [], piped: pipe.length > 1, last: i === pipe.length - 1, err: m => { res.errs.push(m); S.status = 1; } };
      if (own(C, cmd)) C[cmd](args, io);
      else if (own(refuse, cmd)) io.err(refuse[cmd](cmd));
      else { io.err(`bash: ${cmd}: command not found`); S.status = 127; }
      if (io.clear) res.clear = true;
      if (io.exit) res.exit = true;
      if (io.go) res.go = io.go;
      input = io.out.map(strip);
      if (i === pipe.length - 1) res.out.push(...io.out);
    });
  }
  return res;
}

function complete(value) {
  const m = /(^|[\s|;&])([^\s|;&]*)$/.exec(value);
  const word = m[2], before = value.slice(0, value.length - word.length);
  let list;
  if (/^\s*$|[|;&]\s*$/.test(before)) {
    list = [...new Set([...Object.keys(C), ...Object.keys(refuse)])].filter(k => k.startsWith(word)).sort();
  } else {
    const at = word.lastIndexOf('/') + 1, dir = word.slice(0, at), frag = word.slice(at);
    const d = resolve(dir || '.');
    const dirsOnly = /(^|[|;&])\s*cd\s+[^\s|;&]*$/.test(before + word);
    list = d.err || !isDir(d.node) ? [] : names(d.node, frag[0] === '.')
      .filter(k => k.startsWith(frag) && (!dirsOnly || isDir(d.node[k])))
      .map(k => dir + k + (isDir(d.node[k]) ? '/' : ''));
  }
  return { word, before, list };
}

const h = (tag, cls, text, attrs) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

function build() {
  const hid = { 'aria-hidden': 'true' };
  const dlg = h('dialog', 'term', undefined, { 'aria-label': 'Terminal' });
  const dots = h('span', 'term-dots', undefined, hid);
  dots.append(h('i'), h('i'), h('i'));
  const title = h('span', 'term-title');
  const close = h('button', 'term-close', 'Close', { type: 'button' });
  const bar = h('div', 'term-bar');
  bar.append(dots, title, close);

  const log = h('div', 'term-log', undefined, { role: 'log', 'aria-live': 'polite', 'aria-label': 'Terminal output', tabindex: 0 });

  const form = h('form', 'term-row');
  const prompt = h('span', 'term-prompt', undefined, hid);
  const mirror = h('span', 'term-mirror', undefined, hid);
  const pre = h('span'), caret = h('span', 'term-caret'), post = h('span');
  mirror.append(pre, caret, post);
  const input = h('input', 'term-input', undefined, { id: 'term-input', type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', enterkeyhint: 'go', spellcheck: 'false' });
  const line = h('span', 'term-line');
  line.append(mirror, input);
  form.append(h('label', 'term-sr', 'Terminal command', { for: 'term-input' }), prompt, line);

  const chips = h('div', 'term-chips', undefined, { role: 'group', 'aria-label': 'Quick commands' });
  for (const c of ['help', 'ls', 'cat README.md', 'cd logs', 'clear']) chips.append(h('button', 'term-chip', c, { type: 'button', 'data-cmd': c }));
  dlg.append(bar, log, form, chips, h('p', 'term-note', 'sandboxed in your browser. Nothing executes and nothing leaves this page.'));
  document.body.append(dlg);
  S.els = { dlg, log, input, prompt, title, pre, caret, post, close, chips, form };
  S.built = true;
  wire();
}

function promptNodes() {
  const p = h('span', 'term-ps');
  p.append(h('span', 't-y', 'barry@field-notes'), ':', h('span', 't-d', show(S.cwd)), '$ ');
  return p;
}

function setPrompt() {
  const { prompt, title } = S.els;
  prompt.replaceChildren(...promptNodes().childNodes);
  title.textContent = `barry@field-notes: ${show(S.cwd)}`;
}

function print(lines) {
  const { log } = S.els;
  for (const l of lines) {
    const row = h('div', 'term-out');
    let last = 0;
    for (const m of l.matchAll(/\x01(.)([^\x02]*)\x02/g)) {
      row.append(l.slice(last, m.index));
      row.append(KNOWN[m[1]] ? h('span', 't-' + m[1], m[2]) : m[2]);
      last = m.index + m[0].length;
    }
    row.append(l.slice(last));
    log.append(row);
  }
  log.scrollTop = log.scrollHeight;
}

function echo(text) {
  const row = h('div', 'term-out');
  row.append(promptNodes(), text);
  S.els.log.append(row);
  S.els.log.scrollTop = S.els.log.scrollHeight;
}

function sync() {
  const { input, pre, caret, post } = S.els;
  const v = input.value, at = Math.min(input.selectionStart ?? v.length, v.length);
  pre.textContent = v.slice(0, at);
  post.textContent = v.slice(at);
  caret.textContent = '';
}

function setValue(v) {
  S.els.input.value = v;
  S.els.input.setSelectionRange(v.length, v.length);
  sync();
}

function submit(raw) {
  const text = raw.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
  const { input } = S.els;
  echo(text);
  setValue('');
  if (text.trim() && S.hist[S.hist.length - 1] !== text) S.hist.push(text);
  S.idx = S.hist.length;
  if (!text.trim()) return;
  const res = run(text);
  if (res.clear) S.els.log.replaceChildren();
  print([...res.errs.map(e => fmt('e', e)), ...res.out]);
  setPrompt();
  if (res.exit) return closeTerm();
  if (res.go) setTimeout(() => { closeTerm(true); location.assign(res.go); }, 350);
  input.focus({ preventScroll: true });
}

function closeTerm(skipFocus) {
  S.skipFocus = skipFocus;
  if (S.els.dlg.open) S.els.dlg.close();
}

function wire() {
  const { dlg, log, input, close, chips, form } = S.els;
  S.idx = 0;
  let draft = '', tabs = 0, down = false;
  const coarse = matchMedia('(pointer: coarse)');

  form.addEventListener('submit', e => { e.preventDefault(); submit(input.value); });
  close.addEventListener('click', () => closeTerm());
  chips.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    submit(b.dataset.cmd);
    if (!coarse.matches) input.focus({ preventScroll: true });
  });
  log.addEventListener('click', () => {
    const sel = getSelection();
    if (!sel || sel.isCollapsed) input.focus({ preventScroll: true });
  });
  dlg.addEventListener('pointerdown', e => { down = e.target === dlg; });
  dlg.addEventListener('click', e => { if (down && e.target === dlg) closeTerm(); down = false; });
  dlg.addEventListener('close', onClose);
  if (window.visualViewport) for (const ev of ['resize', 'scroll']) visualViewport.addEventListener(ev, fit);
  for (const ev of ['input', 'keyup', 'click', 'focus', 'select']) input.addEventListener(ev, sync);
  input.addEventListener('input', () => { tabs = 0; });

  // The backtick belongs to the page shortcut, so it is kept inside the terminal.
  dlg.addEventListener('keydown', e => { if (e.key === '`') e.stopPropagation(); });

  input.addEventListener('keydown', e => {
    const k = e.key;
    if (k !== 'Tab') tabs = 0;
    if (k === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const { word, before, list } = complete(input.value);
      if (!list.length) return;
      if (list.length === 1) {
        setValue(before + list[0] + (list[0].endsWith('/') ? '' : ' '));
        return;
      }
      let p = list[0];
      for (const x of list) while (!x.startsWith(p)) p = p.slice(0, -1);
      if (p.length > word.length) { setValue(before + p); tabs = 1; return; }
      if (tabs++) {
        echo(input.value);
        print([list.map(x => (x.endsWith('/') ? fmt('d', x) : x)).join('  ')]);
      }
    } else if (k === 'ArrowUp' || k === 'ArrowDown') {
      e.preventDefault();
      if (!S.hist.length) return;
      if (S.idx === S.hist.length) draft = input.value;
      S.idx = Math.max(0, Math.min(S.hist.length, S.idx + (k === 'ArrowUp' ? -1 : 1)));
      setValue(S.idx === S.hist.length ? draft : S.hist[S.idx]);
    } else if (e.ctrlKey && !e.altKey && !e.metaKey && k.toLowerCase() === 'l') {
      e.preventDefault();
      log.replaceChildren();
    } else if (e.ctrlKey && !e.altKey && !e.metaKey && k.toLowerCase() === 'c' && input.selectionStart === input.selectionEnd) {
      e.preventDefault();
      echo(input.value + '^C');
      S.idx = S.hist.length;
      setValue('');
    }
  });
}

function onClose() {
  const { dlg } = S.els;
  document.documentElement.style.overflow = S.overflow || '';
  dlg.classList.remove('is-in');
  const t = S.trigger;
  if (!S.skipFocus && t && document.contains(t)) t.focus({ preventScroll: true });
  S.skipFocus = false;
}

function fit() {
  const v = window.visualViewport;
  if (!v) return;
  const { dlg, log } = S.els;
  dlg.style.setProperty('--term-h', v.height + 'px');
  dlg.style.setProperty('--term-top', v.offsetTop + 'px');
  log.scrollTop = log.scrollHeight;
}

function loadCss() {
  return new Promise(done => {
    const link = h('link', '', undefined, { rel: 'stylesheet', href: CSS });
    link.onload = link.onerror = done;
    document.head.append(link);
  });
}

let ready = null;

export async function openTerminal({ trigger = null, command = '' } = {}) {
  ready = ready || loadCss();
  await ready;
  const first = !S.built;
  if (first) build();
  const { dlg, input, log } = S.els;
  if (dlg.open) {
    input.focus();
    if (command) submit(command);
    return;
  }
  S.trigger = trigger;
  S.overflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  dlg.showModal();
  setPrompt();
  if (first) {
    print([
      `sandboxed terminal for this site. Nothing here runs or connects anywhere.`,
      `Try ${fmt('y', 'help')}, ${fmt('y', 'ls')} or ${fmt('y', 'cat README.md')}.`,
      `Tab completes, Up and Down move through history, Esc closes.`
    ]);
  }
  fit();
  void dlg.offsetWidth;
  dlg.classList.add('is-in');
  input.focus({ preventScroll: true });
  sync();
  log.scrollTop = log.scrollHeight;
  if (command) submit(command);
}
