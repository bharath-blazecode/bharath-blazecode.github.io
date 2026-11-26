// Homepage only: the 3D desk, its links to the project folders, and the responder.
(() => {
  'use strict';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Responder: one short loop per pose, then still. Other poses are fetched ahead so a change never flashes.
  const responder = document.querySelector('[data-responder]');
  function pose(name) {
    if (!responder || reduced.matches) return;
    responder.classList.remove('is-playing');
    responder.dataset.pose = name;
    void responder.getBoundingClientRect();
    responder.classList.add('is-playing');
  }
  if (responder) {
    const sprite = name => new URL(`../assets/incident-responder/${name}.png`, here).href;
    responder.addEventListener('animationend', event => {
      if (event.animationName === 'walk-in') { responder.classList.remove('is-walking'); pose('idle'); return; }
      responder.classList.remove('is-playing');
      responder.dataset.pose = 'idle';
    });
    // Walk in once the walking frames have arrived, so nothing flashes.
    addEventListener('load', () => {
      const walk = new Image();
      walk.onload = () => responder.classList.add('is-here', 'is-walking');
      walk.onerror = () => { responder.classList.add('is-here'); pose('idle'); };
      walk.src = sprite('walk');
      for (const name of ['point', 'scan']) new Image().src = sprite(name);
    }, { once: true });
    responder.addEventListener('pointerenter', () => { if (!responder.classList.contains('is-walking')) pose('point'); });
    responder.addEventListener('click', () => { const opener = document.querySelector('[data-terminal-open]'); if (opener) opener.click(); });
    const actions = document.querySelector('.hero-actions');
    if (actions) actions.addEventListener('pointerenter', () => pose('point'));
  }

  // Chess: each press moves the knight to the unvisited square with the fewest ways out, which walks the whole board.
  const chess = document.querySelector('[data-chess]');
  if (chess) {
    const knight = chess.querySelector('[data-chess-knight]');
    const trail = chess.querySelector('[data-chess-trail]');
    const note = chess.querySelector('[data-chess-note]');
    const jumps = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    const name = (col, row) => 'abcdefgh'[col] + (8 - row);
    let seen = new Set(['6,7']);
    let at = [6, 7];
    const moves = (col, row) => jumps.map(([dc, dr]) => [col + dc, row + dr]).filter(([c, r]) => c >= 0 && c < 8 && r >= 0 && r < 8 && !seen.has(c + ',' + r));
    const place = (item, [col, row]) => { item.style.transform = `translate(${col * 100}%, ${row * 100}%)`; };
    chess.querySelector('[data-chess-move]').addEventListener('click', () => {
      let options = moves(at[0], at[1]);
      if (!options.length) { seen = new Set([at.join(',')]); options = moves(at[0], at[1]); }
      options.sort((a, b) => moves(a[0], a[1]).length - moves(b[0], b[1]).length);
      place(trail, at);
      at = options[0];
      seen.add(at.join(','));
      place(knight, at);
      note.textContent = `Knight to ${name(at[0], at[1])}. Square ${seen.size} of 64.`;
    });
  }

  const desk = document.querySelector('[data-desk]');
  if (!desk) return;
  const canvas = desk.querySelector('[data-desk-canvas]');
  const start = desk.querySelector('[data-desk-start]');
  const hint = desk.querySelector('[data-desk-hint]');
  const tags = new Map([...desk.querySelectorAll('[data-tag]')].map(tag => [tag.dataset.tag, tag]));
  const folders = new Map([...document.querySelectorAll('.folder[data-object]')].map(folder => [folder.dataset.object, folder]));
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 901px)');
  const saver = navigator.connection && navigator.connection.saveData;

  let scene = null;
  let loading = false;
  let failed = false;
  let inView = false;
  const sync = () => { if (scene) scene.setVisible(inView && !document.hidden); };

  function mark(key) {
    tags.forEach((tag, name) => tag.classList.toggle('is-active', name === key));
    folders.forEach((folder, name) => folder.classList.toggle('is-linked', name === key));
  }
  function go(key, event) {
    if (key === 'research') { location.hash = '#research'; return; }
    const link = folders.get(key) && folders.get(key).querySelector('h3 a');
    if (!link) return;
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) window.open(link.href, '_blank', 'noopener');
    else link.click();
  }
  async function load() {
    if (scene || loading || failed) return;
    loading = true;
    try {
      const { createDeskScene } = await import(new URL('../assets/desk/desk-scene.js', here).href);
      scene = createDeskScene(canvas, {
        reducedMotion: reduced.matches,
        pointerEffects: mouse.matches,
        onReady() {
          desk.classList.add('has-3d');
          if (start) start.hidden = true;
          if (hint && mouse.matches) hint.hidden = false;
        },
        onFailure() {
          failed = true;
          desk.classList.remove('has-3d', 'has-tags');
          if (scene) { scene.dispose(); scene = null; }
        },
        onLayout(anchors) {
          for (const [key, tag] of tags) {
            const spot = anchors[key];
            if (spot) tag.style.transform = `translate(${Math.round(spot[0] + 10)}px, ${Math.round(spot[1] - 14)}px)`;
          }
          desk.classList.add('has-tags');
        },
        onHover(key) { mark(key); if (key) pose('point'); },
        onSelect: go
      });
      sync();
    } catch (_) {
      failed = true; // The still image and the project folders are the complete fallback.
    } finally {
      loading = false;
    }
  }

  folders.forEach((folder, key) => {
    const on = () => { if (scene) scene.highlight(key); tags.forEach((tag, name) => tag.classList.toggle('is-active', name === key)); };
    const off = () => { if (scene) scene.highlight(null); tags.forEach(tag => tag.classList.remove('is-active')); };
    folder.addEventListener('pointerenter', () => { on(); pose('scan'); });
    folder.addEventListener('pointerleave', off);
    folder.addEventListener('focusin', on);
    folder.addEventListener('focusout', off);
  });

  // Desktops with a mouse load the scene once the page is idle and the desk is near. Phones and data-saver visitors choose.
  const auto = mouse.matches && wide.matches && !saver && 'IntersectionObserver' in window;
  if (start) {
    start.hidden = auto;
    start.addEventListener('click', () => { start.disabled = true; load(); });
  }
  if ('IntersectionObserver' in window) {
    const idle = window.requestIdleCallback || (run => setTimeout(run, 200));
    let ready = document.readyState === 'complete';
    let near = false;
    const maybe = () => { if (auto && ready && near) idle(load); };
    if (!ready) addEventListener('load', () => { ready = true; maybe(); }, { once: true });
    // Fetch the scene when the desk is within a screen of the viewport; animate it only while it is on screen.
    new IntersectionObserver((entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      near = true;
      observer.disconnect();
      maybe();
    }, { rootMargin: '100% 0px' }).observe(desk);
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      sync();
    }).observe(desk);
  } else {
    inView = true;
  }
  reduced.addEventListener('change', () => { if (scene) scene.setReduced(reduced.matches); });
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', () => { if (scene) scene.setVisible(false); });
  addEventListener('pageshow', sync);
  // Used when making the still image.
  desk.capture = async () => { await load(); return scene ? scene.capture() : null; };
})();
