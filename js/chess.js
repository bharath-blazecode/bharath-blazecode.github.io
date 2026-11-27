// Chess against a small search engine. Everything runs in the browser and nothing is sent anywhere.
import * as X from './chess-engine.js';

const CSS = new URL('../css/chess.css', import.meta.url).href;
const ENGINE = new URL('chess-engine.js', import.meta.url);
const KEY = 'bs-chess';
const NS = 'http://www.w3.org/2000/svg';
const games = new WeakMap();

const SHAPES = [
  '',
  'M12 4.2a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2zM9 11.8c-1.6 2-2.2 3.8-2.4 5.2h10.8c-.2-1.4-.8-3.2-2.4-5.2zM5.8 17.6h12.4v3H5.8z',
  'M7 20.5c0-5 1.2-8.2 4.4-10.4L8.4 9.4 11.2 4c4.4.2 7.3 3.3 7.3 8.2v8.3z',
  'M12 3.2c2.8 2.6 4 5.2 2.6 8.2l1.6 2.4H7.8l1.6-2.4C8 8.4 9.2 5.8 12 3.2zM6.2 14.8h11.6l.8 5.7H5.4z',
  'M6.2 4.2h2.9v2.2h1.5V4.2h2.8v2.2h1.5V4.2h2.9v5.3l-2 1.6v5.2l2 1.6v2.4H6.2v-2.4l2-1.6v-5.2l-2-1.6z',
  'M4.6 8.5l3.2 6.6L12 5.9l4.2 9.2 3.2-6.6.5 9.6H4.1zM4.2 18.8h15.6v2.4H4.2z',
  'M10.9 2.4h2.2v1.8h1.8v2.2h-1.8v1.8h-2.2V6.4H9.1V4.2h1.8zM12 9.6c4.6.4 6.8 3.4 5.8 7.2l1 3.7H5.2l1-3.7c-1-3.8 1.2-6.8 5.8-7.2z'
];

function h(tag, cls, text, attrs) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

function pieceSvg(v) {
  const p = Math.abs(v), s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('class', 'chess-piece ' + (v > 0 ? 'w' : 'b'));
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', SHAPES[p]);
  s.append(path);
  const dot = (x, y, r) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
    s.append(c);
    return c;
  };
  if (p === 2) dot(11.6, 7.6, 0.9).setAttribute('class', 'eye');
  if (p === 5) dot(12, 4.4, 1.6);
  return s;
}

function loadCss() {
  return new Promise(done => {
    const link = h('link', '', '', { rel: 'stylesheet', href: CSS });
    link.onload = link.onerror = done;
    document.head.append(link);
  });
}

// Saved stats, read defensively.
function loadStats() {
  const out = { played: 0, won: 0, lost: 0, drawn: 0 };
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    for (const k in out) if (o && Number.isInteger(o[k]) && o[k] >= 0 && o[k] < 1e6) out[k] = o[k];
  } catch (e) { /* storage unavailable or not JSON */ }
  return out;
}
function saveStats(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

// What the engine has noticed about the visitor, and the weights it changes because of it.
// hist covers every game of this visit; an entry with gap set marks where a new game began.
export function adapt(hist) {
  const games = [[]];
  for (const r of hist) if (r.gap) games.push([]); else games[games.length - 1].push(r);
  const me = hist.filter(r => r.who === 'you'), n = me.length, W = { ...X.DEFAULTS };
  if (n < 4) return { W, noticed: 'too few moves to say anything yet.', change: 'It is using its standard weights.' };
  const hits = me.filter(r => r.cap || r.check).length;
  const ex = games.reduce((sum, g) => sum + g.filter((r, i) => i && r.cap && g[i - 1].cap && r.t === g[i - 1].t).length, 0);
  const openings = games.map(g => g.filter(r => r.who === 'you'));
  const seen = [], did = [];
  if (hits / n >= 0.4) {
    W.ks = 2; W.keep = 8;
    seen.push(`${hits} of your ${n} moves were captures or checks`);
    did.push('it weighs its own king safety twice as heavily and scores keeping pieces on the board a little higher');
  } else if (hits / n <= 0.15 && n >= 5) {
    W.act = 1.5;
    seen.push(`only ${hits} of your ${n} moves were captures or checks`);
    did.push('it values piece activity 50 percent more');
  }
  if (ex >= 2) {
    seen.push(`there have been ${ex} captures answered by captures on the same square`);
    if (!W.keep) { W.keep = 8; did.push('it scores keeping pieces on the board a little higher, so it avoids trades'); }
  }
  const by = [0, 0, 0, 0, 0, 0, 0];
  me.forEach(r => by[r.piece]++);
  let fav = 0;
  if (openings.some(g => g.slice(0, 3).some(r => r.piece === 5))) { fav = 5; seen.push('you brought your queen out early'); }
  else if (openings.some(g => g.slice(0, 4).filter(r => r.piece === 1).length >= 3)) { fav = 1; seen.push('you pushed pawns in 3 or more of your first 4 moves'); }
  else {
    const top = by.indexOf(Math.max(...by.slice(1)), 1);
    if (by[top] >= 3 && by[top] / n >= 0.4) { fav = top; seen.push(`you have moved the ${X.PIECES[top]} in ${by[top]} of your ${n} moves`); }
  }
  if (fav) { W.fav = fav; W.mult = 1.2; did.push(`it counts your ${X.PIECES[fav]}s as worth 20 percent more, so it works harder to win or trade for them`); }
  if (!seen.length) return { W, noticed: `nothing stands out in your ${n} moves.`, change: 'It is still using its standard weights.' };
  const join = a => a.join('; ');
  return { W, noticed: join(seen) + '.', change: 'So ' + join(did) + '.' };
}

const pawns = v => `${Math.round(Math.abs(v) / 100)} pawn${Math.abs(v) === 100 ? '' : 's'}`;
const lvl = v => (v === 0 ? 'level' : v > 0 ? `up ${pawns(v)}` : `down ${pawns(v)}`);
const num = n => String(n).replace(/\B(?=(\d{3})+$)/g, ',');
function fmt(s) {
  if (Math.abs(s) > 29000) { const n = Math.ceil((30000 - Math.abs(s)) / 2); return s > 0 ? `mate in ${n}` : `being mated in ${n}`; }
  return (s < 0 ? '-' : '+') + (Math.abs(s) / 100).toFixed(1);
}

// A plain-words reason for one candidate, built by replaying the line the search kept.
function reason(pos, l) {
  const p = X.copy(pos), e = p.side, i = X.info(p, l.m), base = X.material(p.b) * e;
  const parts = [i.cap ? `Wins a ${X.PIECES[i.cap]}` : i.promo ? 'Makes a queen' : i.check ? 'Gives check' : 'A quiet move'];
  if (l.bound) return { head: X.say(i), text: `${parts[0]}. The search found it no better than ${fmt(l.score)}.` };
  let text = parts[0];
  if (l.pv.length > 1) {
    X.play(p, l.m);
    const r = X.info(p, l.pv[1]);
    text += `, and the reply it expects is ${X.say(r)}`;
    for (let k = 1; k < l.pv.length; k++) X.play(p, l.pv[k]);
    const end = X.material(p.b) * e;
    text += `. Over the line it checked, material for the engine ${end === base ? 'stays ' + lvl(end) : 'goes from ' + lvl(base) + ' to ' + lvl(end)}`;
  }
  return { head: X.say(i), text: text + '.' };
}

const RESULTS = {
  repetition: 'Draw: the same position came up three times.',
  material: 'Draw: neither side has enough pieces to checkmate.',
  quiet: 'Draw: 40 half-moves with no capture or pawn move.',
  cap: 'Draw: 120 half-moves have been played.',
  stalemate: 'Stalemate. The game is a draw.'
};

export function startChess(root, opts = {}) {
  if (!games.has(root)) games.set(root, create(root, opts));
  return games.get(root).then(g => { g.focus(); });
}

async function create(root, opts) {
  await loadCss();
  const S = {
    pos: X.parse(opts.position || X.START), hist: [], visit: [], sel: -1, targets: new Map(), last: [-1, -1], cursor: 7,
    state: 'ready', gen: 0, ms: opts.ms || 450, W: { ...X.DEFAULTS }, id: 0, worker: null, pending: null,
    tally: { won: 0, lost: 0, drawn: 0 }, saved: loadStats(), start: opts.position || X.START
  };
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Layout
  const status = h('p', 'chess-status', 'Your move.');
  const reset = h('button', 'button chess-reset', 'New game', { type: 'button' });
  const board = h('div', 'chess-board', '', { role: 'grid', 'aria-label': 'Chess board, 5 by 5. You are White.' });
  const cells = [];
  for (let r = 4; r >= 0; r--) {
    const row = h('div', 'chess-row', '', { role: 'row' });
    for (let f = 0; f < 5; f++) {
      const i = r * 5 + f;
      const c = h('div', 'chess-sq ' + ((f + r) % 2 ? 'l' : 'd'), '', { role: 'gridcell', tabindex: '-1', 'data-sq': X.sqName(i) });
      if (f === 0) c.append(h('i', '', String(r + 1), { 'aria-hidden': 'true' }));
      if (r === 0) c.append(h('i', 'file', 'abcde'[f], { 'aria-hidden': 'true' }));
      cells[i] = c;
      row.append(c);
    }
    board.append(row);
  }
  const help = h('p', 'chess-help', 'Tap a piece, then a highlighted square. With a keyboard: arrow keys to move around the board, Enter or Space to pick up and put down, Escape to cancel. Pawns step one square and promote to a queen.');
  const think = h('section', 'chess-think', '', { 'aria-labelledby': 'chess-think-h' });
  const thinkH = h('h3', 'chess-h', 'What the engine is thinking', { id: 'chess-think-h' });
  const chose = h('p', 'chess-chose', 'Nothing yet. Make your first move and it will show what it looked at.');
  const list = h('ul', 'chess-lines');
  const depthP = h('p', 'chess-depth');
  const barFill = h('span');
  const bar = h('div', 'chess-bar', '', { 'aria-hidden': 'true' });
  bar.append(barFill);
  const barText = h('p', 'chess-bartext', 'Engine view: about even.');
  const notice = h('p', 'chess-notice');
  think.append(thinkH, chose, list, depthP, h('p', 'label', 'Who is ahead in its view (light: you, dark: engine)'), bar, barText, notice);
  const score = h('p', 'chess-score');
  const note = h('div', 'chess-note');
  note.append(
    h('p', '', 'This engine runs in your browser. Nothing you play is sent anywhere.'),
    h('p', '', 'How it works: it searches possible moves with alpha-beta pruning and scores positions with a hand-written evaluation. That evaluation adapts to simple counts of how you play during this visit. It is a small game-playing AI in the classical search sense. Gardner minichess: 5 by 5, no castling, pawns step one square and promote to queens.')
  );
  const live = h('div', 'sr-only', '', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const head = h('div', 'chess-head');
  head.append(status, reset);
  const main = h('div', 'chess-main');
  const left = h('div', 'chess-left');
  left.append(board, help);
  main.append(left, think);
  root.append(head, note, main, score, live);

  const say = t => { live.textContent = t; };
  const setState = s => { S.state = s; root.dataset.state = s; };
  const nameOf = v => (v ? `${v > 0 ? 'white' : 'black'} ${X.PIECES[Math.abs(v)]}` : 'empty');

  function render(anim) {
    const b = S.pos.b;
    for (let i = 0; i < 25; i++) {
      const c = cells[i], v = b[i], t = S.targets.has(i), cls = ['chess-sq', c.classList.contains('l') ? 'l' : 'd'];
      if (i === S.sel) cls.push('is-sel');
      if (t) cls.push(v ? 'is-target is-cap' : 'is-target');
      if (i === S.last[0] || i === S.last[1]) cls.push('is-last');
      c.className = cls.join(' ');
      c.tabIndex = i === S.cursor ? 0 : -1;
      c.setAttribute('aria-selected', i === S.sel ? 'true' : 'false');
      c.setAttribute('aria-label', `${X.sqName(i)}, ${nameOf(v)}${i === S.sel ? ', selected' : ''}${t ? (v ? ', legal capture' : ', legal move') : ''}`);
      if (+c.dataset.v !== v || !c.querySelector('.chess-piece') !== !v) {
        c.querySelector('.chess-piece')?.remove();
        if (v) c.append(pieceSvg(v));
        c.dataset.v = v;
      }
    }
    if (anim && !reduce() && S.last[0] >= 0) {
      const piece = cells[S.last[1]].querySelector('.chess-piece');
      if (piece && piece.animate) {
        const a = cells[S.last[0]].getBoundingClientRect(), z = cells[S.last[1]].getBoundingClientRect();
        piece.animate([{ transform: `translate(${a.left - z.left}px, ${a.top - z.top}px)` }, { transform: 'none' }], { duration: 200, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
    }
  }

  function scoreLine() {
    const a = S.tally, b = S.saved;
    score.textContent = `Score this visit: won ${a.won}, lost ${a.lost}, drawn ${a.drawn}. Saved in this browser: played ${b.played}, won ${b.won}, lost ${b.lost}, drawn ${b.drawn}.`;
  }

  function noticeLine() {
    const a = adapt(S.visit.concat(S.hist));
    S.W = a.W;
    notice.textContent = `What it has noticed so far${S.visit.length ? ' this visit' : ''}: ${a.noticed} ${a.change}`;
  }

  function setBar(whiteScore) {
    const mate = Math.abs(whiteScore) > 29000;
    const share = mate ? (whiteScore > 0 ? 1 : 0) : 0.5 + 0.5 * Math.tanh(whiteScore / 350);
    barFill.style.transform = `scaleX(${share.toFixed(3)})`;
    barText.textContent = 'Engine view: ' + (mate ? `forced mate for ${whiteScore > 0 ? 'you' : 'the engine'}, in ${Math.ceil((30000 - Math.abs(whiteScore)) / 2)}.`
      : Math.abs(whiteScore) < 40 ? 'about even.' : `${whiteScore > 0 ? 'you are' : 'the engine is'} ahead by about ${(Math.abs(whiteScore) / 100).toFixed(1)} pawns.`);
  }

  function finish(st) {
    setState('over');
    const you = st.winner === 1;
    const text = st.kind === 'checkmate' ? `Checkmate. ${you ? 'You win.' : 'The engine wins.'}` : RESULTS[st.kind];
    status.textContent = text;
    const k = st.winner === 0 ? 'drawn' : you ? 'won' : 'lost';
    S.tally[k]++; S.saved[k]++; S.saved.played++;
    saveStats(S.saved);
    scoreLine();
    return text;
  }

  function apply(m, who) {
    const i = X.info(S.pos, m);
    S.hist.push({ ...i, who });
    X.play(S.pos, m);
    S.last = [i.f, i.t]; S.sel = -1; S.targets = new Map();
    render(true);
    return { i, st: X.status(S.pos) };
  }

  function pick(i) {
    const mv = X.legalMoves(S.pos).filter(m => (m & 31) === i);
    S.sel = mv.length ? i : -1;
    S.targets = new Map(mv.map(m => [(m >> 5) & 31, m]));
    render();
    say(mv.length ? `${X.sqName(i)} selected, ${mv.length} legal move${mv.length === 1 ? '' : 's'}.` : `${X.sqName(i)} has no legal moves.`);
  }

  function onSquare(i) {
    S.cursor = i;
    if (S.state === 'thinking') { say('The engine is thinking. Wait for its move.'); render(); return; }
    if (S.state !== 'ready') return;
    if (S.targets.has(i)) { visitorMove(S.targets.get(i)); return; }
    if (i === S.sel) { S.sel = -1; S.targets = new Map(); render(); say('Selection cancelled.'); return; }
    if (S.pos.b[i] > 0) pick(i);
    else { const was = S.sel >= 0; S.sel = -1; S.targets = new Map(); render(); if (was) say('That is not a legal move.'); }
  }

  function visitorMove(m) {
    const { i, st } = apply(m, 'you');
    noticeLine();
    const text = `You played ${X.say(i)}.`;
    if (st.over) { say(`${text} ${finish(st)}`); return; }
    status.textContent = 'Engine is thinking.';
    say(`${text} The engine is thinking.`);
    enginePlays(text);
  }

  function ask(pos, o) {
    return new Promise(resolve => {
      const local = () => {
        const s = X.makeSearch(pos, o);
        const tick = () => (s.step(8) ? resolve(s.result()) : setTimeout(tick, 0));
        setTimeout(tick, 0);
      };
      if (!S.worker) return local();
      const id = ++S.id;
      const timer = setTimeout(() => { if (S.pending && S.pending.id === id) { S.pending = null; local(); } }, o.ms + 4000);
      S.pending = { id, resolve: r => { clearTimeout(timer); resolve(r); }, local: () => { clearTimeout(timer); local(); } };
      S.worker.postMessage({ id, pos, opts: o });
    });
  }

  async function enginePlays(lead) {
    const g = S.gen;
    setState('thinking');
    const before = X.copy(S.pos);
    const res = await ask(S.pos, { ms: S.ms, W: S.W });
    if (g !== S.gen) return;
    const lines = res.lines.map(l => ({ ...l, ...reason(before, l) }));
    const first = lines[0], second = lines[1];
    const { st } = apply(res.move, 'engine');
    // Panel
    list.replaceChildren();
    lines.slice(0, 3).forEach((l, n) => {
      const li = h('li');
      const top = h('span', 'chess-lh');
      top.append(h('strong', '', `${n === 0 ? 'Chosen: ' : ''}${l.head}`), h('span', '', ` (${l.bound ? 'no better than ' : ''}${fmt(l.score)})`));
      li.append(top, h('span', 'chess-why', l.text));
      list.append(li);
    });
    const why = !second ? 'It was the only legal move.'
      : second.score === first.score ? `It scored ${fmt(first.score)}, the same as for ${second.head}, and took the first of the two.`
        : `It scored ${fmt(first.score)}, ahead of ${second.bound ? 'no better than ' : ''}${fmt(second.score)} for ${second.head}.`;
    chose.textContent = `It played ${first.head}. ${why}`;
    depthP.textContent = `It looked ${res.depth} half-move${res.depth === 1 ? '' : 's'} ahead and examined ${num(res.nodes)} positions in ${(res.ms / 1000).toFixed(2)} seconds. Scores are in pawns, from the engine's side.`;
    setBar(-res.score);
    const msg = `Engine played ${first.head}.`;
    if (st.over) { say(`${msg} ${finish(st)}`); return; }
    setState('ready');
    status.textContent = (st.check ? 'Check. ' : '') + 'Your move.';
    say(`${msg} ${why} ${st.check ? 'You are in check.' : ''} Your move.`);
  }

  function newGame(announce) {
    S.gen++;
    // What the engine noticed carries into the next game.
    if (S.hist.length) S.visit.push(...S.hist, { gap: true });
    S.pos = X.parse(S.start); S.hist = []; S.sel = -1; S.targets = new Map(); S.last = [-1, -1]; S.cursor = 7;
    setState('ready');
    status.textContent = 'Your move.';
    chose.textContent = 'Nothing yet. Make your first move and it will show what it looked at.';
    list.replaceChildren(); depthP.textContent = '';
    setBar(0); noticeLine(); render();
    if (announce) say('New game. You are White. Your move.');
  }

  board.addEventListener('click', e => {
    const c = e.target.closest('.chess-sq');
    if (c) { c.focus(); onSquare(X.sqIndex(c.dataset.sq)); }
  });
  board.addEventListener('keydown', e => {
    const d = { ArrowUp: 5, ArrowDown: -5, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (d) {
      e.preventDefault();
      const f = S.cursor % 5 + (d === 1 ? 1 : d === -1 ? -1 : 0), n = S.cursor + d;
      if (f < 0 || f > 4 || n < 0 || n > 24) return;
      S.cursor = n; render(); cells[n].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault(); onSquare(S.cursor); cells[S.cursor].focus();
    } else if (e.key === 'Escape' && S.sel >= 0) {
      S.sel = -1; S.targets = new Map(); render(); say('Selection cancelled.');
    }
  });
  reset.addEventListener('click', () => newGame(true));

  if (opts.worker !== false && window.Worker) {
    try {
      S.worker = new Worker(ENGINE, { type: 'module' });
      S.worker.onmessage = e => { if (S.pending && S.pending.id === e.data.id) { const p = S.pending; S.pending = null; p.resolve(e.data.res); } };
      S.worker.onerror = () => { S.worker = null; if (S.pending) { const p = S.pending; S.pending = null; p.local(); } };
    } catch (e) { S.worker = null; }
  }

  newGame(false);
  scoreLine();
  root.hidden = false;
  if (opts.trigger) opts.trigger.hidden = true;
  return { focus: () => { render(); cells[S.cursor].focus(); } };
}
