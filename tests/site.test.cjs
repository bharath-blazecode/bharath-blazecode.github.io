/* Run with: node --test tests/site.test.cjs
   These exercise the real script with deterministic clocks and a small DOM.
   Browser rendering, CSS frame freezing and physical focus remain visual QA. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/site.js'), 'utf8');

function fixture(options = {}) {
  let now = 0;
  let nextTimer = 0;
  const timers = new Map();
  const observers = new Map();
  const nodes = {};
  let document;

  class Element {
    constructor(id) {
      this.id = id;
      this.attrs = {};
      this.events = {};
      this.children = [];
      this.dataset = {};
      this.hidden = false;
      this.value = '';
      this.style = { setProperty() {} };
      this.classes = new Set();
      this.classList = {
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name)
      };
    }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return name in this.attrs; }
    removeAttribute(name) { delete this.attrs[name]; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener(type, callback) { (this.events[type] ||= []).push(callback); }
    emit(type, event = {}) {
      event.preventDefault ||= () => { event.defaultPrevented = true; };
      event.target ||= this;
      (this.events[type] || []).forEach(callback => callback(event));
    }
    click() { this.emit('click', { button: 0 }); }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = null; this.emit('blur'); }
    contains(other) { return other === this || this.children.includes(other); }
    closest() { return null; }
    getBoundingClientRect() { return { top: 0, height: this.id === 'bar' ? 72 : 300 }; }
    querySelector(selector) { return selector === '.responder-sprite' ? nodes.stageSprite : null; }
  }

  ['console', 'conPause', 'conRestart', 'incidentStage', 'stageSprite', 'incidentState',
    'incidentPause', 'incidentReplay', 'incidentControls', 'terminal', 'roleList',
    'hwCode', 'hwGloss', 'hwNext', 'hwDots', 'hwState', 'hwLog', 'hwForm', 'hwInput',
    'bar', 'day', 'night', 'skim', 'read', 'walkthrough'].forEach(id => { nodes[id] = new Element(id); });
  nodes.walkthrough.closest = selector => selector === '.detail-only' ? nodes.walkthrough : null;
  nodes.walkthrough.getBoundingClientRect = () => ({ top: 400, height: 300 });
  const root = new Element('root');
  nodes.day.setAttribute('data-theme-choice', 'light');
  nodes.night.setAttribute('data-theme-choice', 'dark');
  nodes.skim.dataset.mode = 'skim';
  nodes.read.dataset.mode = 'read';
  document = new Element('document');
  Object.assign(document, {
    documentElement: root,
    hidden: false,
    getElementById: id => nodes[id] || null,
    createElement: tag => new Element(tag),
    querySelector: selector => ({ '.bar': nodes.bar, '.terminal-responder': nodes.terminal })[selector] || null,
    querySelectorAll: selector => ({
      '[data-theme-choice]': [nodes.day, nodes.night],
      '.modectl button': [nodes.skim, nodes.read]
    })[selector] || []
  });
  function media(matches) {
    return {
      matches,
      callbacks: [],
      addEventListener(type, callback) { this.callbacks.push(callback); },
      change(value) { this.matches = value; this.callbacks.forEach(callback => callback({ matches: value })); }
    };
  }
  const motion = media(!!options.reduced);
  const colour = media(!!options.dark);
  const local = new Map(Object.entries(options.local || {}));
  const session = new Map(Object.entries(options.session || {}));
  function storage(map) {
    return { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) };
  }
  const windowEvents = {};
  const window = {
    matchMedia: query => query.includes('reduced-motion') ? motion : colour,
    IntersectionObserver: true,
    ResizeObserver: true,
    addEventListener(type, callback) { (windowEvents[type] ||= []).push(callback); },
    emit(type) { (windowEvents[type] || []).forEach(callback => callback()); },
    scrollY: 0,
    scrollTo(options) { this.lastScroll = options; },
    location: new URL('https://portfolio.example/' + (options.hash || '')),
    history: { pushState() {} }
  };
  const context = {
    document, window, URL,
    localStorage: storage(local), sessionStorage: storage(session),
    Date: { now: () => now },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { time: now + delay, callback }); return id; },
    clearTimeout(id) { timers.delete(id); },
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(element) { observers.set(element, this.callback); }
    },
    ResizeObserver: class { observe() {} }
  };
  vm.runInNewContext(source, context, { filename: 'site.js' });
  return {
    nodes, root, motion, colour, local, document, window,
    visible(id, visible) { observers.get(nodes[id])([{ isIntersecting: visible }]); },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    tick(duration) {
      const end = now + duration;
      for (let count = 0; count < 2000; count++) {
        const next = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
        if (!next || next[1].time > end) { now = end; return; }
        now = next[1].time;
        timers.delete(next[0]);
        next[1].callback();
      }
      throw new Error('Timer loop did not settle');
    },
    command(value) { nodes.hwInput.value = value; nodes.hwForm.emit('submit'); return nodes.hwLog.textContent; }
  };
}

test('terminal rejects inherited names and keeps replies as inert text', () => {
  const f = fixture();
  for (const command of ['constructor', '__proto__', 'toString', 'unknown']) {
    assert.match(f.command(command), /command not found:/);
    assert.equal(f.document.activeElement, f.nodes.hwInput);
  }
  assert.match(f.command('help'), /Commands: whoami/);
  assert.match(f.command('xss'), /<script>alert\(1\)<\/script>/);
  assert.equal(f.nodes.hwLog.children.at(-2).textContent, '<script>alert(1)</script>');
  f.command('clear');
  assert.equal(f.nodes.hwLog.textContent, '');
  assert.equal(f.nodes.hwLog.hidden, true);
  f.command('   ');
  assert.equal(f.nodes.hwLog.textContent, '');
  assert.equal(f.document.activeElement, f.nodes.hwInput);
});

test('Day/Night follows OS until a stored explicit choice and exposes both states', () => {
  const f = fixture({ dark: true });
  assert.equal(f.nodes.night.getAttribute('aria-pressed'), 'true');
  f.colour.change(false);
  assert.equal(f.nodes.day.getAttribute('aria-pressed'), 'true');
  f.nodes.night.click();
  assert.equal(f.root.getAttribute('data-theme'), 'dark');
  assert.equal(f.local.get('bs-shift'), 'dark');
  f.colour.change(false);
  assert.equal(f.nodes.night.getAttribute('aria-pressed'), 'true');
  const restored = fixture({ local: { 'bs-shift': 'light', 'bs-mode': 'read' } });
  assert.equal(restored.nodes.day.getAttribute('aria-pressed'), 'true');
  assert.equal(restored.nodes.read.getAttribute('aria-pressed'), 'true');
});

test('detailed hash destinations reveal Read and account for the sticky header', () => {
  const f = fixture({ hash: '#walkthrough', local: { 'bs-mode': 'skim' }, reduced: true });
  assert.equal(f.root.getAttribute('data-mode'), null);
  assert.equal(f.nodes.read.getAttribute('aria-pressed'), 'true');
  f.window.emit('load');
  assert.equal(f.window.lastScroll.top, 312);
  assert.equal(f.window.lastScroll.behavior, 'instant');
  const link = f.document.createElement('a');
  link.href = 'https://portfolio.example/#walkthrough';
  link.closest = selector => selector === 'a[href]' ? link : null;
  f.document.emit('click', { target: link, button: 0 });
  assert.equal(f.document.activeElement, f.nodes.walkthrough);
  assert.equal(f.nodes.walkthrough.getAttribute('tabindex'), '-1');
  f.nodes.walkthrough.blur();
  assert.equal(f.nodes.walkthrough.getAttribute('tabindex'), null);
});

test('responder pause, offscreen and hidden preserve remaining time and CSS pause flag', () => {
  const f = fixture();
  f.visible('incidentStage', true);
  f.tick(1000);
  f.nodes.incidentPause.click();
  assert.equal(f.nodes.incidentStage.getAttribute('data-motion-paused'), 'true');
  f.tick(20000);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'idle');
  f.nodes.incidentPause.click();
  f.tick(1199);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'idle');
  f.tick(1);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'alert');
  f.visible('incidentStage', false);
  f.tick(20000);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'alert');
  f.visible('incidentStage', true);
  f.hidden(true);
  f.tick(20000);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'alert');
  f.hidden(false);
  f.tick(2200);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'contain');
});

test('responder plays once and Replay starts a fresh bounded sequence', () => {
  const f = fixture();
  f.visible('incidentStage', true);
  f.tick(12600);
  assert.equal(f.nodes.incidentStage.getAttribute('data-motion-settled'), 'true');
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'clear');
  f.tick(60000);
  assert.equal(f.nodes.incidentState.textContent, 'Trace complete');
  f.nodes.incidentReplay.click();
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'idle');
  assert.equal(f.nodes.incidentStage.getAttribute('data-motion-settled'), 'false');
  f.tick(2200);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'alert');
});

test('terminal points once and cards change only with Next', () => {
  const f = fixture();
  const firstCard = f.nodes.hwCode.textContent;
  f.visible('terminal', true);
  f.tick(400);
  f.hidden(true);
  f.tick(10000);
  assert.equal(f.nodes.terminal.getAttribute('data-motion-settled'), 'false');
  f.hidden(false);
  f.tick(460);
  assert.equal(f.nodes.terminal.getAttribute('data-motion-settled'), 'true');
  f.tick(60000);
  assert.equal(f.nodes.hwCode.textContent, firstCard);
  f.nodes.hwNext.click();
  assert.match(f.nodes.hwCode.textContent, /^nmap /);
});

test('live reduced motion settles all three animations and retains working observers', () => {
  const f = fixture();
  ['console', 'incidentStage', 'terminal'].forEach(id => f.visible(id, true));
  f.tick(300);
  f.motion.change(true);
  assert.equal(f.root.getAttribute('data-reduced-motion'), 'true');
  assert.equal(f.nodes.console.children.length, 10);
  assert.match(f.nodes.console.textContent, /LEVEL 12/);
  for (const id of ['console', 'incidentStage', 'terminal']) {
    assert.equal(f.nodes[id].getAttribute('data-motion-settled'), 'true');
    assert.equal(f.nodes[id].getAttribute('data-motion-paused'), 'true');
  }
  f.tick(60000);
  f.motion.change(false);
  assert.equal(f.nodes.incidentStage.getAttribute('data-motion-settled'), 'true');
  f.visible('console', false);
  f.nodes.conRestart.click();
  f.tick(10000);
  assert.equal(f.nodes.console.children.length, 0);
  f.visible('console', true);
  f.tick(200);
  assert.equal(f.nodes.console.children.length, 1);
});

test('reduced motion at load shows full console and a static responder', () => {
  const f = fixture({ reduced: true });
  assert.equal(f.nodes.console.children.length, 10);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'clear');
  assert.equal(f.nodes.incidentReplay.getAttribute('aria-disabled'), 'true');
  assert.equal(f.nodes.conRestart.getAttribute('aria-disabled'), 'true');
  f.motion.change(false);
  f.visible('incidentStage', true);
  f.nodes.incidentReplay.click();
  f.tick(2200);
  assert.equal(f.nodes.incidentStage.getAttribute('data-incident'), 'alert');
});

test('console hover and keyboard focus suspend independently and alert loops after its hold', () => {
  const f = fixture();
  f.visible('console', true);
  f.tick(200);
  assert.equal(f.nodes.console.children.length, 1);
  f.nodes.console.emit('mouseenter');
  f.nodes.console.emit('focusin');
  f.nodes.console.emit('mouseleave');
  f.tick(10000);
  assert.equal(f.nodes.console.children.length, 1);
  f.nodes.console.emit('focusout', { relatedTarget: null });
  f.tick(560 * 7 + 900 + 430);
  assert.equal(f.nodes.console.children.length, 10);
  f.tick(8999);
  assert.equal(f.nodes.console.children.length, 10);
  f.tick(1);
  assert.equal(f.nodes.console.children.length, 0);
  f.tick(320);
  assert.equal(f.nodes.console.children.length, 1);
});
