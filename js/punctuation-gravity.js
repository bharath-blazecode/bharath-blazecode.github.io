/* The original text is never changed: these are temporary, decorative copies. */
(() => {
  'use strict';
  const desk = document.querySelector('[data-investigation-desk]');
  const roots = [...document.querySelectorAll('.masthead, .hero')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mouseAvailable = matchMedia('(any-hover: hover) and (any-pointer: fine)');
  if (!desk || !roots.length) return;

  const proximity = 120;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  let layer = null;
  let cursor = null;
  let particles = [];
  let phase = 'idle';
  let armed = true;
  let frame = 0;
  let previousTime = 0;
  let pointer = { x: 0, y: 0 };
  let bounds = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const within = (x, y, rect, margin = 0) => x >= rect.left - margin && x <= rect.right + margin &&
    y >= rect.top - margin && y <= rect.bottom + margin;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    if (layer) layer.remove();
    layer = null;
    cursor = null;
    particles = [];
    phase = 'idle';
  }

  // Read the actual screen positions of visible dots and punctuation in the
  // opening. A dot above i/j is approximated within that letter's text box.
  function findSources() {
    const found = [];
    const range = document.createRange();
    for (const root of roots) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const parent = node.parentElement;
        if (!parent || parent.closest('[data-investigation-desk], [hidden], .sr-only, script, style, svg')) continue;
        const value = node.nodeValue;
        if (!/[iIjJ.,;:!'’?]/.test(value)) continue;
        const style = getComputedStyle(parent);
        if (style.visibility !== 'visible' || style.display === 'none') continue;
        const fontSize = parseFloat(style.fontSize) || 16;
        for (let index = 0; index < value.length; index++) {
          const character = value[index];
          if (!/[iIjJ.,;:!'’?]/.test(character)) continue;
          let rendered = character;
          if (style.textTransform.includes('uppercase')) rendered = character.toUpperCase();
          else if (style.textTransform.includes('lowercase')) rendered = character.toLowerCase();
          else if (style.textTransform.includes('capitalize') && (index === 0 || /\s/.test(value[index - 1]))) rendered = character.toUpperCase();
          if (!/[ij.,;:!'’?]/.test(rendered)) continue;
          range.setStart(node, index);
          range.setEnd(node, index + 1);
          const box = range.getBoundingClientRect();
          if (!box.width || !box.height || box.right < 0 || box.left > innerWidth || box.bottom < 0 || box.top > innerHeight) continue;
          const verticals = rendered === ':' || rendered === ';' ? [.38, .82] :
            rendered === 'i' || rendered === 'j' || rendered === "'" || rendered === '’' ? [.2] : [.82];
          for (const vertical of verticals) {
            const x = box.left + box.width / 2;
            const y = box.top + box.height * vertical;
            const hit = document.elementFromPoint(x, y);
            if (!hit || (hit !== parent && !parent.contains(hit) && !hit.contains(parent))) continue;
            found.push({ x, y, size: clamp(fontSize * .1, 2.5, 14), kind: rendered === 'i' || rendered === 'j' ? rendered : 'punctuation' });
          }
        }
      }
    }
    range.detach();
    return found;
  }

  function start() {
    const sources = findSources();
    if (!sources.length) return false;
    layer = document.createElement('div');
    layer.className = 'punctuation-gravity';
    layer.dataset.punctuationGravity = '';
    layer.setAttribute('aria-hidden', 'true');
    const fragment = document.createDocumentFragment();
    particles = sources.map((source, index) => {
      const element = document.createElement('span');
      element.dataset.sourceKind = source.kind;
      const angle = index * goldenAngle;
      const radius = 6 + 38 * Math.sqrt((index + .5) / sources.length);
      fragment.append(element);
      return {
        element, source, x: source.x, y: source.y, size: source.size,
        offsetX: Math.cos(angle) * radius, offsetY: Math.sin(angle) * radius,
        lag: 170 + (index % 7) * 21, inDesk: false
      };
    });
    cursor = document.createElement('span');
    cursor.className = 'gravity-cursor';
    cursor.style.opacity = '0';
    fragment.append(cursor);
    layer.append(fragment);
    document.body.append(layer);
    return true;
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(animate);
  }
  function animate(time) {
    frame = 0;
    if (!layer || document.hidden || reduced.matches || !mouseAvailable.matches) { stop(); return; }
    const elapsed = previousTime ? Math.min(48, time - previousTime) : 16;
    previousTime = time;
    let moving = false;
    for (const particle of particles) {
      const returning = phase === 'return';
      let targetX = returning ? particle.source.x : pointer.x + particle.offsetX;
      let targetY = returning ? particle.source.y : pointer.y + particle.offsetY;
      if (phase === 'inside') {
        targetX = clamp(targetX, bounds.left + 5, bounds.right - 5);
        targetY = clamp(targetY, bounds.top + 5, bounds.bottom - 5);
      }
      const targetSize = returning ? particle.source.size : 5;
      const amount = 1 - Math.exp(-elapsed / (returning ? 230 : particle.lag));
      particle.x += (targetX - particle.x) * amount;
      particle.y += (targetY - particle.y) * amount;
      particle.size += (targetSize - particle.size) * amount;
      if (Math.abs(targetX - particle.x) > .4 || Math.abs(targetY - particle.y) > .4 || Math.abs(targetSize - particle.size) > .08) moving = true;
      const inDesk = within(particle.x, particle.y, bounds);
      if (inDesk !== particle.inDesk) {
        particle.inDesk = inDesk;
        particle.element.classList.toggle('is-in-desk', inDesk);
      }
      const distanceHome = Math.hypot(particle.x - particle.source.x, particle.y - particle.source.y);
      particle.element.style.opacity = returning ? Math.min(.95, distanceHome / 22).toFixed(2) : '.95';
      particle.element.style.transform = `translate3d(${particle.x.toFixed(1)}px, ${particle.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(particle.size / 8).toFixed(3)})`;
    }
    if (!moving) {
      previousTime = 0;
      if (phase === 'return') stop();
      return;
    }
    schedule();
  }

  function move(event) {
    if (event.pointerType !== 'mouse' || reduced.matches || !mouseAvailable.matches || document.hidden) return;
    // Scroll and resize clear the effect, so its measured bounds stay valid
    // while particles move without forcing a new layout on every mouse event.
    if (!layer) bounds = desk.getBoundingClientRect();
    if (!bounds.width || !bounds.height) { stop(); return; }
    pointer = { x: event.clientX, y: event.clientY };
    const inside = within(pointer.x, pointer.y, bounds);
    const near = within(pointer.x, pointer.y, bounds, proximity);
    if (!layer) {
      if (!near) armed = true;
      if (!inside && (!near || !armed)) return;
      if (!start()) return;
      phase = inside ? 'inside' : 'approach';
    } else if (inside) {
      phase = 'inside';
    } else if (phase === 'inside') {
      phase = 'return';
      armed = false;
    } else if (phase === 'approach' && !near) {
      phase = 'return';
      armed = true;
    } else if (phase === 'return') {
      if (!near) armed = true;
      else if (armed) phase = 'approach';
    }
    layer.dataset.phase = phase;
    cursor.style.opacity = inside ? '1' : '0';
    cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(.875)`;
    schedule();
  }

  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', event => {
    if (layer && !event.relatedTarget) {
      phase = 'return';
      layer.dataset.phase = phase;
      cursor.style.opacity = '0';
      schedule();
    }
  });
  reduced.addEventListener('change', () => { if (reduced.matches) stop(); });
  mouseAvailable.addEventListener('change', () => { if (!mouseAvailable.matches) stop(); });
  window.addEventListener('scroll', stop, { passive: true });
  window.addEventListener('resize', stop);
  window.addEventListener('blur', stop);
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  if (document.fonts) document.fonts.addEventListener('loadingdone', stop);
})();
