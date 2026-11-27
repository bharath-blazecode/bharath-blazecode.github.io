// Tests for the chess game. Run: node tests/chess.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { pathToFileURL } = require('node:url');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const rev = s => [...s].reverse().join('');
const FILES = ['js/chess.js', 'js/chess-engine.js', 'css/chess.css', 'tests/chess.cjs'];
const DECOR = new RegExp('[' + [8211, 8212, 8594, 8592, 183, 8230, 10003, 10004, 8226, 215].map(c => String.fromCodePoint(c)).join('') + String.fromCodePoint(9812) + '-' + String.fromCodePoint(9823) + ']|' + String.fromCharCode(92) + 'p{Extended_Pictographic}', 'u');

function staticChecks() {
  const banned = ['evled', 'sselmaes', 'egarevel', 'tsubor', 'etavele', 'yrtsepat', 'ynomitset', 'yenruoj', 'detfarc', 'etanoissap', 'egde-gnittuc', 'rehcnahc-emag', 'kcolnu', 'rewopme', 'suluciteM', 'esacwohs'].map(rev);
  const claims = ['gninrael enihcam', 'larun', 'deniart', 'srael taht IA'].map(rev);
  for (const name of FILES) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(!DECOR.test(text), `${name} has decorative characters`);
    for (const word of banned) assert.ok(!new RegExp(`\\b${word.replace('-', '[- ]')}`, 'i').test(text), `${name} uses a banned word`);
    if (name.startsWith('js/')) {
      assert.ok(!/\.innerHTML\s*=|\beval\s*\(|new Function|document\.cookie|fetch\(|XMLHttpRequest|style="|setAttribute\('style'/.test(text), `${name} uses an unsafe primitive`);
      for (const c of claims) assert.ok(!new RegExp(c.replace(' ', '\\s+'), 'i').test(text), `${name} makes a claim the engine cannot back`);
    }
  }
  const js = ['js/chess.js', 'js/chess-engine.js'].reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(path.join(root, f)), { level: 9 }).length, 0);
  const css = zlib.gzipSync(fs.readFileSync(path.join(root, 'css/chess.css')), { level: 9 }).length;
  assert.ok(js < 16 * 1024, `js is ${js} bytes gzipped`);
  assert.ok(css < 3 * 1024, `css is ${css} bytes gzipped`);
  return { js, css };
}

async function engineChecks() {
  const X = await import(pathToFileURL(path.join(root, 'js/chess-engine.js')).href);
  const C = await import(pathToFileURL(path.join(root, 'js/chess.js')).href);
  const count = (t, side = 1) => X.legalMoves(X.parse(t, side)).length;
  const think = (t, side = 1, ms = 300) => {
    const pos = X.parse(t, side), s = X.makeSearch(pos, { ms });
    const t0 = performance.now();
    while (!s.step(1e9));
    return { res: s.result(), took: performance.now() - t0, pos };
  };

  // Rules
  assert.equal(count(X.START), 7, 'start position has 7 moves');
  assert.equal(count('k4/5/2K2/5/5'), 7, 'king in the centre, b4 is covered by the other king');
  assert.equal(count('4k/5/5/5/K4'), 3, 'king in the corner');
  assert.equal(count('k4/5/2N2/5/4K'), 11, 'knight and king');
  assert.equal(count('k4/5/5/5/K3r'), 2, 'in check, two escapes');
  assert.equal(X.inCheck(X.parse('k4/5/5/5/K3r')), true);
  assert.equal(X.inCheck(X.parse(X.START)), false);
  assert.equal(X.status(X.parse('k4/Q4/1K3/5/5', -1)).kind, 'checkmate');
  assert.equal(X.status(X.parse('k4/Q4/1K3/5/5', -1)).winner, 1);
  assert.equal(X.status(X.parse('k4/5/1Q3/5/4K', -1)).kind, 'stalemate');
  assert.equal(X.status(X.parse('k4/5/5/5/K4')).kind, 'material');
  assert.equal(X.status(X.parse(X.START)).over, false);
  // A pinned rook may only move along the pin
  const pinned = X.parse('k3r/5/5/4R/4K');
  const rook = X.legalMoves(pinned).filter(m => (m & 31) === X.sqIndex('e2')).map(m => X.sqName((m >> 5) & 31));
  assert.deepEqual(rook.sort(), ['e3', 'e4', 'e5'], 'pinned rook moves along the file only');
  // Promotion becomes a queen
  const promo = X.parse('4k/P4/5/5/K4');
  const pmv = X.findMove(promo, X.sqIndex('a4'), X.sqIndex('a5'));
  assert.ok(pmv !== undefined && (pmv & 1024), 'promotion move found');
  X.play(promo, pmv);
  assert.equal(promo.b[X.sqIndex('a5')], 5, 'pawn became a queen');
  // Illegal moves are rejected
  const start = X.newGame();
  assert.equal(X.findMove(start, X.sqIndex('c2'), X.sqIndex('c4')), undefined, 'no double step');
  assert.equal(X.findMove(start, X.sqIndex('a1'), X.sqIndex('a3')), undefined, 'rook is blocked');
  assert.equal(X.findMove(start, X.sqIndex('c4'), X.sqIndex('c3')), undefined, 'empty square');
  assert.equal(X.findMove(start, X.sqIndex('c5'), X.sqIndex('c4')), undefined, 'not the visitor piece');
  assert.equal(X.findMove(X.parse('k4/5/5/5/K3r'), X.sqIndex('a1'), X.sqIndex('b1')), undefined, 'king may not step into check');
  assert.ok(X.findMove(start, X.sqIndex('b1'), X.sqIndex('c3')) !== undefined, 'knight b1 to c3 is legal');

  // Engine
  const mate = think('k4/4Q/1K3/5/5');
  assert.equal(X.info(mate.pos, mate.res.move).mate, true, 'finds mate in one');
  const win = think('k4/5/2n2/1P3/4K');
  assert.equal(X.say(X.info(win.pos, win.res.move)), 'Pawn b2 takes knight on c3', 'wins the hanging piece');
  const timed = think(X.START, 1, 450);
  assert.ok(timed.took < 450 + 120, `answered in ${Math.round(timed.took)} ms`);
  assert.ok(timed.res.depth >= 4, `reached depth ${timed.res.depth}`);

  // Whole games against a random mover, engine playing Black
  let engineWins = 0, engineLosses = 0;
  for (let g = 0; g < 6; g++) {
    const pos = X.newGame();
    for (let n = 0; n < 200; n++) {
      const st = X.status(pos);
      if (st.over) { if (st.winner === -1) engineWins++; if (st.winner === 1) engineLosses++; break; }
      if (pos.side === 1) { const mv = X.legalMoves(pos); X.play(pos, mv[Math.floor(Math.random() * mv.length)]); }
      else { const s = X.makeSearch(pos, { ms: 25 }); while (!s.step(1e9)); X.play(pos, s.result().move); }
      assert.ok(n < 199, 'a game must end by the move cap');
    }
  }
  assert.equal(engineLosses, 0, 'engine lost to a random mover');
  assert.ok(engineWins >= 3, `engine won ${engineWins} of 6`);

  // Adaptation
  const rec = (o) => ({ who: 'you', cap: false, check: false, piece: 1, f: 0, t: 0, ...o });
  const few = C.adapt([rec({}), rec({})]);
  assert.match(few.noticed, /too few moves/);
  const caps = C.adapt(Array.from({ length: 5 }, (_, i) => rec({ cap: true, piece: 3 + (i % 2), t: i })));
  assert.equal(caps.W.ks, 2);
  assert.match(caps.noticed, /5 of your 5 moves were captures or checks/);
  assert.match(caps.change, /king safety/);
  const quiet = C.adapt(Array.from({ length: 6 }, (_, i) => rec({ piece: 2 + (i % 3) })));
  assert.equal(quiet.W.act, 1.5);
  const knight = C.adapt(Array.from({ length: 5 }, () => rec({ piece: 2, cap: true })).concat([rec({ piece: 3 }), rec({ piece: 4 })]));
  assert.equal(knight.W.fav, 2);
  assert.match(knight.change, /your knights as worth 20 percent more/);
  // A new game keeps what was noticed, and an exchange is not counted across the gap between games.
  const across = C.adapt([rec({ cap: true, t: 3 }), { gap: true }, rec({ cap: true, t: 3 }), rec({}), rec({}), rec({})]);
  assert.doesNotMatch(across.noticed, /answered by captures/);
  assert.match(across.noticed, /2 of your 5 moves were captures or checks/);
  const queen = C.adapt([rec({}), rec({}), rec({}), rec({}), { gap: true }, rec({ piece: 5 })]);
  assert.equal(queen.W.fav, 5, 'an early queen in a later game counts');
  return { depth: timed.res.depth, nodes: timed.res.nodes, wins: engineWins };
}

(async () => {
  const size = staticChecks();
  const eng = await engineChecks();
  console.log(`engine ok: start position depth ${eng.depth}, ${eng.nodes} positions, won ${eng.wins} of 6 against a random mover`);
  const X = await import(pathToFileURL(path.join(root, 'js/chess-engine.js')).href);

  const site = await startSite(48781);
  const origin = new URL(site.url).origin;
  const axeSource = fs.readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const problems = [];
  const foreign = [];
  const requests = [];

  const MARKUP = '<div class="chess" data-chess><p class="label">Chess</p><p class="chess-intro">A short game against a small search engine. It runs in your browser.</p><button class="button" type="button" data-chess-start>Play a short game</button><div class="chess-game" data-chess-game hidden></div></div>';

  // The homepage may already carry the markup. If not, put it in the About section.
  const addMarkup = page => page.evaluate(html => { if (!document.querySelector('[data-chess]')) (document.querySelector('.about-side') || document.querySelector('.about')).insertAdjacentHTML('beforeend', html); }, MARKUP);

  async function fresh(options = {}, { start = true, game = {}, store } = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', e => problems.push(e.message));
    page.on('request', r => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith('data:')) foreign.push(u); requests.push({ page, url: u }); });
    await page.addInitScript(() => {
      window.__csp = []; window.__lt = [];
      document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
      try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (e) { /* unsupported */ }
    });
    await page.goto(site.url + '/');
    if (store !== undefined) await page.evaluate(v => localStorage.setItem('bs-chess', v), store);
    await addMarkup(page);
    if (start) await begin(page, game);
    return { context, page };
  }
  async function begin(page, game = {}) {
    await page.evaluate(async o => {
      const { startChess } = await import('/js/chess.js');
      await startChess(document.querySelector('[data-chess-game]'), { trigger: document.querySelector('[data-chess-start]'), ...o });
    }, game);
  }
  const ready = page => page.waitForFunction(() => ['ready', 'over'].includes(document.querySelector('[data-chess-game]').dataset.state), null, { timeout: 15000 });
  const state = page => page.evaluate(() => document.querySelector('[data-chess-game]').dataset.state);
  const panel = page => page.locator('.chess-think').innerText();
  const live = page => page.locator('[role=status][aria-live=polite]').textContent();
  const readFen = page => page.evaluate(() => {
    const k = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
    const rows = [];
    for (let r = 5; r >= 1; r--) {
      let s = '', e = 0;
      for (const f of 'abcde') {
        const m = /^\w\d, (white|black) (\w+)/.exec(document.querySelector(`[data-sq=${f}${r}]`).getAttribute('aria-label'));
        if (!m) { e++; continue; }
        if (e) { s += e; e = 0; }
        s += m[1] === 'white' ? k[m[2]].toUpperCase() : k[m[2]];
      }
      rows.push(s + (e || ''));
    }
    return rows.join('/');
  });
  const click = (page, sq) => page.locator(`[data-sq=${sq}]`).click();
  async function mouseMove(page, from, to) { await click(page, from); await click(page, to); }
  const sq = m => [X.sqName(m & 31), X.sqName((m >> 5) & 31)];
  async function randomMove(page, preferCapture) {
    const pos = X.parse(await readFen(page));
    const all = X.legalMoves(pos);
    const caps = all.filter(m => pos.b[(m >> 5) & 31] !== 0);
    const bk = pos.b.indexOf(-6);
    const far = t => Math.max(Math.abs((t % 5) - (bk % 5)), Math.abs(((t / 5) | 0) - ((bk / 5) | 0))) > 1;
    const safe = caps.filter(m => far((m >> 5) & 31));
    const pool = preferCapture && safe.length ? safe : all;
    const m = pool[Math.floor(Math.random() * pool.length)];
    await mouseMove(page, ...sq(m));
    return { m, cap: caps.includes(m) };
  }
  async function goTo(page, target) {
    for (let n = 0; n < 12; n++) {
      const cur = await page.evaluate(() => document.activeElement.dataset.sq);
      if (cur === target) return;
      const key = target[0] > cur[0] ? 'ArrowRight' : target[0] < cur[0] ? 'ArrowLeft' : target[1] > cur[1] ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
    }
    throw new Error('could not reach ' + target);
  }

  try {
    // Nothing is requested before startChess, then exactly our three files
    {
      const { context, page } = await fresh({}, { start: false });
      await page.waitForTimeout(400);
      const own = requests.filter(r => r.page === page && /chess/.test(r.url));
      assert.equal(own.length, 0, 'chess files requested before startChess: ' + own.map(r => r.url));
      assert.equal(await page.locator('[data-chess-game] *').count(), 0, 'game built early');
      const before = requests.filter(r => r.page === page).length;
      await begin(page);
      await begin(page);
      assert.equal(await page.locator('.chess-board').count(), 1, 'a second board was built');
      assert.equal(await page.locator('[data-chess-game]').isVisible(), true);
      assert.equal(await page.locator('[data-chess-start]').isVisible(), false, 'trigger is hidden');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.sq), 'c2', 'focus goes to the board');
      assert.equal(await page.locator('link[rel=stylesheet][href$="css/chess.css"]').count(), 1);
      assert.ok(await page.getByText('This engine runs in your browser. Nothing you play is sent anywhere.').isVisible(), 'honest label missing');
      const body = await page.locator('.chess-note').innerText();
      assert.match(body, /alpha-beta pruning/);
      assert.match(body, /hand-written evaluation/);
      await mouseMove(page, 'c2', 'c3');
      await ready(page);
      const names = [...new Set(requests.filter(r => r.page === page).slice(before).map(r => new URL(r.url).pathname).filter(p => /chess/.test(p)))].sort();
      assert.deepEqual(names, ['/css/chess.css', '/js/chess-engine.js', '/js/chess.js']);
      assert.deepEqual(await page.evaluate(() => window.__csp), [], 'CSP violations');
      await context.close();
    }

    // Mouse play, selection states and rejected moves
    {
      const { context, page } = await fresh();
      assert.equal(await page.locator('[role=gridcell]').count(), 25);
      assert.equal(await page.locator('[role=gridcell][tabindex="0"]').count(), 1, 'single tab stop');
      assert.equal(await page.locator('[data-sq=c2]').getAttribute('aria-label'), 'c2, white pawn');
      assert.equal(await page.locator('[data-sq=c3]').getAttribute('aria-label'), 'c3, empty');
      await click(page, 'c2');
      assert.equal(await page.locator('[data-sq=c2]').getAttribute('aria-label'), 'c2, white pawn, selected');
      assert.equal(await page.locator('[data-sq=c3]').getAttribute('aria-label'), 'c3, empty, legal move');
      assert.equal(await page.locator('.is-target').count(), 1);
      await click(page, 'e4');
      assert.equal(await page.locator('.is-sel').count(), 0, 'illegal target clears the selection');
      assert.equal(await readFen(page), X.START, 'illegal move changed the board');
      await click(page, 'c5');
      assert.equal(await page.locator('.is-sel').count(), 0, 'opponent piece cannot be picked');
      await click(page, 'b1');
      assert.equal(await page.locator('.is-target').count(), 2, 'knight has two moves');
      await click(page, 'a3');
      assert.equal(await state(page), 'thinking');
      assert.match(await page.locator('.chess-status').innerText(), /thinking/);
      await ready(page);
      assert.equal((await page.locator('.is-last').count()) >= 2, true, 'last move is marked');
      assert.equal(await state(page), 'ready');
      await context.close();
    }

    // Thinking panel names the move actually played and reasons from the position
    {
      const { context, page } = await fresh();
      const fenBefore = X.START;
      await mouseMove(page, 'b1', 'c3');
      await ready(page);
      const pos = X.parse(fenBefore);
      X.play(pos, X.findMove(pos, X.sqIndex('b1'), X.sqIndex('c3')));
      const after = await readFen(page);
      const played = X.legalMoves(pos).find(m => { const p = X.copy(pos); X.play(p, m); return [...Array(25).keys()].every(i => p.b[i] === X.parse(after).b[i]); });
      assert.ok(played !== undefined, 'engine reply is a legal move');
      const text = await panel(page);
      assert.ok(text.includes(`Chosen: ${X.say(X.info(pos, played))}`), 'panel does not name the move played: ' + text);
      assert.ok(text.includes(`It played ${X.say(X.info(pos, played))}.`));
      assert.match(text, /It looked \d+ half-moves? ahead and examined [\d,]+ positions in \d\.\d\d seconds/);
      assert.match(await live(page), /Engine played/);
      assert.match(await page.locator('.chess-bartext').innerText(), /^Engine view:/);
      const bar = await page.locator('.chess-bar span').evaluate(e => e.style.transform);
      assert.match(bar, /scaleX\(0\.\d+\)/);
      await context.close();
    }
    {
      // The engine can take a rook with check, and the panel says so and counts material from the line it kept.
      const { context, page } = await fresh({}, { game: { position: 'k1q2/5/5/5/R3K', ms: 300 } });
      await mouseMove(page, 'a1', 'c1');
      await ready(page);
      const text = await panel(page);
      assert.ok(text.includes('Chosen: Queen c5 takes rook on c1, check'), text);
      assert.match(text, /Wins a rook/);
      assert.match(text, /material for the engine goes from up 4 pawns to up 9 pawns/);
      assert.match(text, /the reply it expects is King e1/);
      assert.ok(!/checkmate/.test(text));
      assert.equal(await readFen(page), 'k4/5/5/5/2q1K');
      await context.close();
    }

    // Adaptive line
    {
      const { context, page } = await fresh({}, { game: { ms: 80 } });
      assert.match(await page.locator('.chess-notice').innerText(), /^What it has noticed so far: too few moves to say anything/);
      const first = await page.locator('.chess-notice').innerText();
      for (let n = 0; n < 4; n++) { if ((await state(page)) === 'over') break; await randomMove(page); await ready(page); }
      const later = await page.locator('.chess-notice').innerText();
      assert.notEqual(later, first, 'adaptive line did not change');
      assert.ok(!/too few/.test(later));
      await context.close();
    }
    {
      // A run of captures against pawns that cannot fight back. The engine may sometimes win a piece, so allow three tries.
      let line = '', caps = 0;
      for (let attempt = 0; attempt < 3 && caps < 4; attempt++) {
        const { context, page } = await fresh({}, { game: { position: 'K3k/5/ppppp/5/Q3R', ms: 60 } });
        caps = 0;
        for (let n = 0; n < 8 && caps < 4 && (await state(page)) !== 'over'; n++) { const r = await randomMove(page, true); if (r.cap) caps++; await ready(page); }
        line = await page.locator('.chess-notice').innerText();
        await context.close();
      }
      assert.ok(caps >= 4, 'only ' + caps + ' captures were available');
      assert.match(line, /captures or checks/, line);
      assert.match(line, /king safety/);
    }

    // Keyboard only
    {
      const { context, page } = await fresh({}, { game: { ms: 80 } });
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'gridcell');
      await page.keyboard.press('Enter');
      assert.equal(await page.locator('[data-sq=c2]').getAttribute('aria-selected'), 'true');
      assert.match(await live(page), /c2 selected, 1 legal move/);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('.is-sel').count(), 0, 'Escape cancels');
      assert.match(await live(page), /Selection cancelled/);
      await page.keyboard.press('Space');
      assert.equal(await page.locator('.is-sel').count(), 1, 'Space picks up');
      await page.keyboard.press('ArrowUp');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.sq), 'c3');
      assert.equal(await page.locator('[role=gridcell][tabindex="0"]').count(), 1, 'still one tab stop');
      await page.keyboard.press('Enter');
      assert.match(await live(page), /You played Pawn c2 to c3/);
      await ready(page);
      assert.match(await live(page), /Engine played/);
      // Arrow keys stop at the edge
      await goTo(page, 'a1');
      await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.sq), 'a1');
      // Several more moves with the keyboard
      let moves = 1;
      for (let n = 0; n < 4 && (await state(page)) !== 'over'; n++) {
        const pos = X.parse(await readFen(page));
        const all = X.legalMoves(pos);
        const [from, to] = sq(all[Math.floor(Math.random() * all.length)]);
        await goTo(page, from); await page.keyboard.press('Enter');
        await goTo(page, to); await page.keyboard.press('Enter');
        await ready(page);
        moves++;
      }
      assert.ok(moves >= 3 || (await state(page)) === 'over', `only ${moves} keyboard moves`);
      assert.ok(await page.evaluate(() => document.querySelectorAll('.chess-sq').length === 25));
      await context.close();
    }

    // Time budget and long tasks with the CPU slowed four times
    // Page noise at 4x can add a stray long task, so a run gets up to three tries; our own slices are the same every try.
    for (const useWorker of [true, false]) {
      const label = useWorker ? 'worker' : 'fallback';
      const { context, page } = await fresh({}, { game: { worker: useWorker } });
      await page.locator('.chess-board').scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      const seen = [];
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.evaluate(() => { window.__lt.length = 0; });
        const t0 = Date.now();
        if (attempt === 0) await mouseMove(page, 'c2', 'c3'); else await randomMove(page);
        await ready(page);
        const wall = Date.now() - t0;
        await page.waitForTimeout(300);
        const lt = await page.evaluate(() => window.__lt);
        const secs = parseFloat((await panel(page)).match(/in ([0-9].[0-9][0-9]) seconds/)[1]);
        assert.ok(secs <= 0.6, label + ' search took ' + secs + ' s');
        assert.ok(wall < 1800, label + ' answer took ' + wall + ' ms');
        seen.push(lt);
        if (!lt.length) break;
      }
      assert.ok(seen[seen.length - 1].length === 0, 'long tasks while thinking (' + label + '): ' + JSON.stringify(seen));
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      await context.close();
    }

    // A full game against a random mover through the page
    {
      const { context, page } = await fresh({}, { game: { ms: 40 } });
      for (let n = 0; n < 80 && (await state(page)) !== 'over'; n++) { await randomMove(page); await ready(page); }
      assert.equal(await state(page), 'over', 'game did not end');
      assert.match(await page.locator('.chess-status').innerText(), /Checkmate|Stalemate|Draw/);
      assert.match(await live(page), /Checkmate|Stalemate|Draw/);
      await click(page, 'c2');
      assert.equal(await page.locator('.is-sel').count(), 0, 'no moves after the game ends');
      await context.close();
    }

    // Reset
    {
      const { context, page } = await fresh({}, { game: { ms: 60 } });
      await mouseMove(page, 'c2', 'c3');
      await ready(page);
      await page.getByRole('button', { name: 'New game' }).click();
      assert.equal(await readFen(page), X.START);
      assert.equal(await state(page), 'ready');
      assert.match(await page.locator('.chess-status').innerText(), /Your move/);
      assert.match(await page.locator('.chess-chose').innerText(), /Nothing yet/);
      assert.equal(await page.locator('.chess-lines li').count(), 0);
      assert.match(await live(page), /New game/);
      // Reset while the engine is thinking, then play on
      await mouseMove(page, 'c2', 'c3');
      await page.getByRole('button', { name: 'New game' }).click();
      await page.waitForTimeout(900);
      assert.equal(await readFen(page), X.START, 'late engine move landed after reset');
      await mouseMove(page, 'b1', 'a3');
      await ready(page);
      assert.notEqual(await readFen(page), X.START);
      await context.close();
    }

    // Stats are saved and read back
    {
      const { context, page } = await fresh({}, { game: { position: 'k4/4Q/1K3/5/5', ms: 60 }, store: '{"played":3,"won":1,"lost":2,"drawn":0}' });
      assert.match(await page.locator('.chess-score').innerText(), /won 0, lost 0, drawn 0\. Saved in this browser: played 3, won 1, lost 2, drawn 0/);
      await mouseMove(page, 'e4', 'a4');
      assert.equal(await state(page), 'over');
      assert.equal(await page.locator('.chess-status').innerText(), 'Checkmate. You win.');
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bs-chess')));
      assert.deepEqual(saved, { played: 4, won: 2, lost: 2, drawn: 0 });
      assert.match(await page.locator('.chess-score').innerText(), /Score this visit: won 1, lost 0, drawn 0\. Saved in this browser: played 4, won 2/);
      await page.reload();
      await addMarkup(page);
      await begin(page);
      assert.match(await page.locator('.chess-score').innerText(), /won 0, lost 0, drawn 0\. Saved in this browser: played 4, won 2, lost 2, drawn 0/);
      assert.deepEqual(Object.keys(saved).sort(), ['drawn', 'lost', 'played', 'won']);
      await context.close();
      for (const bad of ['not json', '{"played":"x","won":-3,"lost":1.5}', 'null', '[]']) {
        const c = await fresh({}, { store: bad });
        assert.match(await c.page.locator('.chess-score').innerText(), /Saved in this browser: played 0, won 0, lost 0, drawn 0/, 'bad storage: ' + bad);
        await c.context.close();
      }
    }

    // Reduced motion
    for (const reduce of [false, true]) {
      const { context, page } = await fresh({ reducedMotion: reduce ? 'reduce' : 'no-preference' }, { game: { ms: 60 } });
      const n = await page.evaluate(() => { document.querySelector('[data-sq=c2]').click(); document.querySelector('[data-sq=c3]').click(); return document.getAnimations().length; });
      if (reduce) assert.equal(n, 0, 'animation ran under reduced motion');
      else assert.ok(n >= 1, 'no slide animation');
      await ready(page);
      const dur = await page.locator('.chess-bar span').evaluate(e => getComputedStyle(e).transitionDuration);
      assert.equal(reduce ? parseFloat(dur) < 0.01 : dur, reduce ? true : '0.2s');
      await context.close();
    }

    // Layout and touch size
    for (const [w, h] of [[320, 700], [390, 800], [1440, 900]]) {
      const { context, page } = await fresh({ viewport: { width: w, height: h } }, { game: { ms: 60 } });
      await mouseMove(page, 'c2', 'c3');
      await ready(page);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, iw: window.innerWidth,
        sq: document.querySelector('.chess-sq').getBoundingClientRect().width,
        left: document.querySelector('.chess-board').getBoundingClientRect().left,
        panelLeft: document.querySelector('.chess-think').getBoundingClientRect().left,
        panelTop: document.querySelector('.chess-think').getBoundingClientRect().top,
        boardBottom: document.querySelector('.chess-board').getBoundingClientRect().bottom
      }));
      assert.ok(m.sw <= m.iw, `horizontal overflow at ${w}: ${m.sw} > ${m.iw}`);
      assert.ok(m.sq >= 44, `squares are ${m.sq}px at ${w}`);
      console.log(`  ${w}px wide: squares ${m.sq.toFixed(1)}px, ${m.panelTop >= m.boardBottom - 1 ? 'stacked' : 'side by side'}`);
      await context.close();
    }

    // Axe in both themes, with a selection showing
    for (const theme of ['light', 'dark']) {
      const { context, page } = await fresh({ bypassCSP: true }, { game: { ms: 60 } });
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await mouseMove(page, 'c2', 'c3');
      await ready(page);
      await click(page, 'b1');
      await page.addScriptTag({ content: axeSource });
      const res = await page.evaluate(() => axe.run('.chess', { resultTypes: ['violations'] }));
      assert.deepEqual(res.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`), [], `axe violations in ${theme}`);
      await context.close();
    }

    assert.deepEqual(foreign, [], 'requests left the site');
    assert.deepEqual(problems, [], 'console errors');
    console.log(`chess tests passed (js ${size.js} bytes gzipped, css ${size.css} bytes gzipped)`);
  } finally {
    await browser.close();
    site.stop();
  }
})().catch(e => { console.error(e); process.exit(1); });
