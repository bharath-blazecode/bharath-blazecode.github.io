// Gardner minichess: 5 by 5, no castling, one-step pawns that promote to queens.
// Rules, an alpha-beta search and a hand-written evaluation. It runs in a worker,
// or on the main thread in small slices if a worker is not available.
const PW = 1, KN = 2, BI = 3, RO = 4, QU = 5, KI = 6;
export const PIECES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];
export const VALUE = [0, 100, 300, 300, 500, 900, 0];
export const START = 'rnbqk/ppppp/5/PPPPP/RNBQK';
export const DEFAULTS = { ks: 1, keep: 0, act: 1, fav: 0, mult: 1 };
const MATE = 30000, INF = 32000, EMPTY = [];
const now = () => performance.now();

export const sqName = s => 'abcde'[s % 5] + (1 + ((s / 5) | 0));
export const sqIndex = n => 'abcde'.indexOf(n[0]) + 5 * (n[1] - 1);

const Z = new Int32Array(326);
{
  let s = 2463534242;
  for (let i = 0; i < Z.length; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; Z[i] = s | 0; }
}
const zi = (p, sq) => (p + 6) * 25 + sq;
const SIDE = 325;

function hashOf(b, side) {
  let h = side < 0 ? Z[SIDE] : 0;
  for (let i = 0; i < 25; i++) if (b[i]) h ^= Z[zi(b[i], i)];
  return h | 0;
}

// Rows run from rank 5 down to rank 1. Capitals are White. Digits are empty squares.
export function parse(text, side = 1) {
  const b = new Int8Array(25);
  text.split('/').forEach((row, i) => {
    let f = 0;
    for (const c of row) {
      if (c >= '1' && c <= '5') f += +c;
      else {
        const k = 'pnbrqk'.indexOf(c.toLowerCase()) + 1;
        b[(4 - i) * 5 + f++] = c === c.toLowerCase() ? -k : k;
      }
    }
  });
  const h = hashOf(b, side);
  return { b, side, h, half: 0, ply: 0, path: [h] };
}
export const newGame = () => parse(START);
export const copy = p => ({ b: Int8Array.from(p.b), side: p.side, h: p.h, half: p.half, ply: p.ply, path: p.path.slice() });

const ND = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];
const KD = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
function rays(sq, ds, far) {
  const out = [];
  for (const [df, dr] of ds) {
    let x = sq % 5 + df, y = ((sq / 5) | 0) + dr;
    const ray = [];
    while (x >= 0 && x < 5 && y >= 0 && y < 5) { ray.push(y * 5 + x); if (!far) break; x += df; y += dr; }
    if (ray.length) out.push(ray);
  }
  return out;
}
const KNT = [], KNG = [], ORT = [], DIA = [];
for (let s = 0; s < 25; s++) {
  KNT.push(rays(s, ND).flat()); KNG.push(rays(s, KD).flat());
  ORT.push(rays(s, KD.slice(0, 4), 1)); DIA.push(rays(s, KD.slice(4), 1));
}
const CEN = Array.from({ length: 25 }, (_, s) => 4 - Math.abs(s % 5 - 2) - Math.abs(((s / 5) | 0) - 2));

function attacked(b, sq, by) {
  const pr = sq - by * 5, f = sq % 5;
  if (pr >= 0 && pr < 25) {
    if (f > 0 && b[pr - 1] === by * PW) return true;
    if (f < 4 && b[pr + 1] === by * PW) return true;
  }
  for (const t of KNT[sq]) if (b[t] === by * KN) return true;
  for (const t of KNG[sq]) if (b[t] === by * KI) return true;
  for (const ray of ORT[sq]) for (const t of ray) { const v = b[t]; if (v) { if (v === by * RO || v === by * QU) return true; break; } }
  for (const ray of DIA[sq]) for (const t of ray) { const v = b[t]; if (v) { if (v === by * BI || v === by * QU) return true; break; } }
  return false;
}

const kingOf = (b, s) => b.indexOf(s * KI);
export const inCheck = pos => { const k = kingOf(pos.b, pos.side); return k >= 0 && attacked(pos.b, k, -pos.side); };

// Pseudo-legal moves. A move is from | to << 5 | promotion << 10. Each entry carries an ordering key above bit 11.
function gen(pos, caps) {
  const b = pos.b, s = pos.side, out = [];
  const add = (f, t, p, pr) => {
    const v = b[t] * s;
    if (v > 0) return;
    const key = (v < 0 ? VALUE[-v] * 10 + 7 - p : 0) + (pr ? 8000 : 0);
    if (!caps || v < 0 || pr) out.push(key * 2048 + (f | t << 5 | pr << 10));
  };
  for (let f = 0; f < 25; f++) {
    const p = b[f] * s;
    if (p <= 0) continue;
    if (p === PW) {
      const t = f + 5 * s, pr = t >= 20 || t < 5 ? 1 : 0, c = f % 5;
      if (!b[t]) add(f, t, p, pr);
      if (c > 0 && b[t - 1] * s < 0) add(f, t - 1, p, pr);
      if (c < 4 && b[t + 1] * s < 0) add(f, t + 1, p, pr);
    } else if (p === KN || p === KI) {
      for (const t of p === KN ? KNT[f] : KNG[f]) add(f, t, p, 0);
    } else {
      for (const set of [p !== BI ? ORT[f] : EMPTY, p !== RO ? DIA[f] : EMPTY]) {
        for (const ray of set) for (const t of ray) { add(f, t, p, 0); if (b[t]) break; }
      }
    }
  }
  return out;
}

function make(pos, m) {
  const b = pos.b, f = m & 31, t = (m >> 5) & 31, p = b[f], c = b[t];
  const np = m & 1024 ? QU * pos.side : p;
  b[t] = np; b[f] = 0;
  pos.h ^= Z[zi(p, f)] ^ Z[zi(np, t)] ^ Z[SIDE];
  if (c) pos.h ^= Z[zi(c, t)];
  pos.side = -pos.side; pos.path.push(pos.h); pos.ply++;
  const u = (c + 6) | pos.half << 4;
  pos.half = c || p * p === 1 ? 0 : pos.half + 1;
  return u;
}

function undo(pos, m, u) {
  const b = pos.b, f = m & 31, t = (m >> 5) & 31;
  pos.side = -pos.side;
  b[f] = m & 1024 ? pos.side : b[t];
  b[t] = (u & 15) - 6;
  pos.path.pop(); pos.h = pos.path[pos.path.length - 1]; pos.ply--; pos.half = u >> 4;
}

// Legal moves, best ordered first.
function legal(pos, caps) {
  const s = pos.side, b = pos.b, ks = kingOf(b, s), out = [];
  for (const v of gen(pos, caps).sort((x, y) => y - x)) {
    const m = v & 2047, u = make(pos, m), t = (m >> 5) & 31;
    const k = b[t] === s * KI ? t : ks;
    if (k < 0 || !attacked(b, k, -s)) out.push(v);
    undo(pos, m, u);
  }
  return out;
}

export const legalMoves = pos => legal(pos).map(v => v & 2047);
export const findMove = (pos, f, t) => legalMoves(pos).find(m => (m & 31) === f && ((m >> 5) & 31) === t);
export const play = make;

function repeats(pos) {
  const P = pos.path;
  let c = 1;
  for (let i = P.length - 3; i >= 0 && i >= P.length - 1 - pos.half; i -= 2) if (P[i] === pos.h) c++;
  return c;
}

function insufficient(b) {
  let n = 0, last = 0;
  for (let i = 0; i < 25; i++) { const p = Math.abs(b[i]); if (p && p !== KI) { n++; last = p; } }
  return n === 0 || (n === 1 && (last === KN || last === BI));
}

export function status(pos) {
  const chk = inCheck(pos);
  if (!legal(pos).length) return chk ? { over: true, kind: 'checkmate', winner: -pos.side } : { over: true, kind: 'stalemate', winner: 0 };
  const draw = kind => ({ over: true, kind, winner: 0 });
  if (repeats(pos) >= 3) return draw('repetition');
  if (insufficient(pos.b)) return draw('material');
  if (pos.half >= 40) return draw('quiet');
  if (pos.ply >= 120) return draw('cap');
  return { over: false, check: chk };
}

export function material(b) {
  let s = 0;
  for (let i = 0; i < 25; i++) s += b[i] > 0 ? VALUE[b[i]] : -VALUE[-b[i]];
  return s;
}

export function info(pos, m) {
  const f = m & 31, t = (m >> 5) & 31, piece = Math.abs(pos.b[f]), cap = Math.abs(pos.b[t]);
  const u = make(pos, m), check = inCheck(pos), mate = check && !legal(pos).length;
  undo(pos, m, u);
  return { m, f, t, piece, cap, promo: !!(m & 1024), check, mate, side: pos.side };
}

export function say(i) {
  const name = PIECES[i.piece];
  let s = `${name[0].toUpperCase()}${name.slice(1)} ${sqName(i.f)} ${i.cap ? `takes ${PIECES[i.cap]} on` : 'to'} ${sqName(i.t)}`;
  if (i.promo) s += ', promotes to a queen';
  return s + (i.mate ? ', checkmate' : i.check ? ', check' : '');
}

// Evaluation from White's point of view. W holds the weights the engine adapts.
function evalWhite(b, W) {
  const k = [kingOf(b, 1), kingOf(b, -1)];
  let sc = 0, cnt = 0;
  const king = [0, 0];
  for (let i = 0; i < 25; i++) {
    const v = b[i];
    if (!v) continue;
    const s = v > 0 ? 1 : -1, p = v * s, ix = s > 0 ? 0 : 1;
    if (p === KI) {
      if (k[1 - ix] < 0) continue;
      for (const t of KNG[i]) if (b[t] * s > 0) king[ix] += 8;
      continue;
    }
    let x = VALUE[p];
    if (s !== W.e && p === W.fav) x *= W.mult;
    const r = s > 0 ? (i / 5) | 0 : 4 - ((i / 5) | 0);
    if (p === PW) x += r * 14 + CEN[i] * 2;
    else {
      cnt++;
      x += CEN[i] * (p === KN ? 12 : p === BI ? 6 : p === QU ? 3 : 2);
      let mob = 0;
      if (p === KN) for (const t of KNT[i]) { if (b[t] * s <= 0) mob++; }
      else for (const set of [p !== BI ? ORT[i] : EMPTY, p !== RO ? DIA[i] : EMPTY]) {
        for (const ray of set) for (const t of ray) { if (b[t] * s > 0) break; mob++; if (b[t]) break; }
      }
      x += mob * (p === RO ? 2 : p === QU ? 1 : 4) * (s === W.e ? W.act : 1);
      if (k[1 - ix] >= 0) {
        const d = Math.max(Math.abs(i % 5 - k[1 - ix] % 5), Math.abs(((i / 5) | 0) - ((k[1 - ix] / 5) | 0)));
        king[1 - ix] -= (p === RO ? 2 : p === QU ? 3 : 1) * Math.max(0, 3 - d) * 9;
      }
    }
    sc += s * x;
  }
  sc += (king[0] * (W.e > 0 ? W.ks : 1)) - (king[1] * (W.e < 0 ? W.ks : 1));
  sc += W.e * W.keep * cnt;
  return sc | 0;
}

// Iterative deepening over the root moves, one root move per unit of work.
// step(sliceMs) does work for about sliceMs and returns true when the search is finished.
export function makeSearch(src, o = {}) {
  const pos = copy(src);
  const W = { ...DEFAULTS, ...o.W, e: pos.side };
  const end = now() + (o.ms || 450), t0 = now();
  const STOP = {};
  const pv = [];
  let nodes = 0, stopAt = Infinity, depth = 1, idx = 0, curBest = -INF, done = false, completed = null;
  const roots = legal(pos).map(v => ({ m: v & 2047, score: -INF, bound: false, pv: [], nodes: 0 }));
  for (let i = roots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [roots[i], roots[j]] = [roots[j], roots[i]]; }
  const maxD = roots.length < 2 ? 1 : o.maxDepth || 40;
  done = !roots.length;
  const ev = () => pos.side * evalWhite(pos.b, W);

  function qs(alpha, beta, ply) {
    if ((++nodes & 511) === 0 && now() >= stopAt) throw STOP;
    pv[ply] = EMPTY;
    const st = ev();
    if (st >= beta || ply > 40) return st;
    if (st > alpha) alpha = st;
    for (const v of legal(pos, true)) {
      const m = v & 2047, u = make(pos, m), x = -qs(-beta, -alpha, ply + 1);
      undo(pos, m, u);
      if (x > alpha) { alpha = x; pv[ply] = [m].concat(pv[ply + 1]); if (x >= beta) break; }
    }
    return alpha;
  }

  function nm(d, alpha, beta, ply) {
    if ((++nodes & 511) === 0 && now() >= stopAt) throw STOP;
    pv[ply] = EMPTY;
    if (repeats(pos) >= 2 || pos.half >= 40 || ply > 60) return 0;
    const chk = inCheck(pos);
    if (chk && ply < 30) d++;
    if (d <= 0) return qs(alpha, beta, ply);
    const moves = legal(pos);
    if (!moves.length) return chk ? -MATE + ply : 0;
    let best = -INF;
    for (const v of moves) {
      const m = v & 2047, u = make(pos, m), x = -nm(d - 1, -beta, -alpha, ply + 1);
      undo(pos, m, u);
      if (x > best) {
        best = x;
        if (x > alpha) { alpha = x; pv[ply] = [m].concat(pv[ply + 1]); if (x >= beta) break; }
      }
    }
    return best;
  }

  function stepRoot() {
    const r = roots[idx], n0 = nodes, u = make(pos, r.m);
    const alpha = idx ? curBest - 80 : -INF;
    const x = -nm(depth - 1, -INF, -alpha, 1);
    undo(pos, r.m, u);
    r.score = x; r.bound = x <= alpha; r.nodes = nodes - n0;
    r.pv = r.bound ? [r.m] : [r.m].concat(pv[1]);
    if (!r.bound && x > curBest) curBest = x;
  }

  function finishDepth() {
    roots.sort((a, b) => b.score - a.score);
    completed = { depth, lines: roots.map(r => ({ ...r })) };
    if (roots[0].score >= MATE - 60) done = true;
    depth++; idx = 0; curBest = -INF;
  }

  return {
    step(slice) {
      if (done) return true;
      const sliceEnd = now() + slice;
      let fresh = true;
      for (;;) {
        if (idx === 0 && depth > 1 && (now() >= end || depth > maxD)) { done = true; break; }
        stopAt = depth === 1 ? Infinity : Math.min(end, sliceEnd);
        try { stepRoot(); } catch (x) {
          if (x !== STOP) throw x;
          // Out of time for the whole search, or out of slice. A root move that cannot fit in a fresh slice ends the search.
          if (now() >= end || fresh) done = true;
          else { Object.assign(pos, { b: Int8Array.from(src.b), side: src.side, h: src.h, half: src.half, ply: src.ply, path: src.path.slice() }); return false; }
          break;
        }
        fresh = false;
        if (++idx === roots.length) { finishDepth(); if (done) break; }
        if (now() >= sliceEnd) return false;
      }
      return true;
    },
    result() {
      if (!completed) return null;
      const l = completed.lines;
      return { move: l[0].m, score: l[0].score, depth: completed.depth, nodes, ms: Math.round(now() - t0), count: l.length, lines: l.slice(0, 4) };
    }
  };
}

if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = e => {
    const { id, pos, opts } = e.data;
    const s = makeSearch(pos, opts);
    while (!s.step(1e9));
    self.postMessage({ id, res: s.result() });
  };
}
