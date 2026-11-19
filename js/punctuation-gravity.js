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
  const splatterDuration = 700;
  let layer = null;
  let cursor = null;
  let liquidCore = null;
  let particles = [];
  let phase = 'idle';
  let armed = true;
  let frame = 0;
  let previousTime = 0;
  let pointer = { x: 0, y: 0 };
  let bounds = null;
  let enteredAt = 0;
  let motionSample = null;
  let splitUntil = 0;
  let fusedOnce = false;
  let splatterStarted = 0;
  let selectionTimer = null;
  let pendingSelection = null;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const within = (x, y, rect, margin = 0) => x >= rect.left - margin && x <= rect.right + margin &&
    y >= rect.top - margin && y <= rect.bottom + margin;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    clearTimeout(selectionTimer);
    selectionTimer = null;
    frame = 0;
    previousTime = 0;
    if (layer) layer.remove();
    layer = null;
    cursor = null;
    liquidCore = null;
    particles = [];
    phase = 'idle';
    fusedOnce = false;
    const action = pendingSelection;
    pendingSelection = null;
    if (action) action();
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
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const defs = document.createElementNS(svgNS, 'defs');
    const filter = document.createElementNS(svgNS, 'filter');
    filter.id = 'field-map-liquid';
    filter.setAttribute('x', '-50%');
    filter.setAttribute('y', '-50%');
    filter.setAttribute('width', '200%');
    filter.setAttribute('height', '200%');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const blur = document.createElementNS(svgNS, 'feGaussianBlur');
    blur.setAttribute('in', 'SourceGraphic');
    blur.setAttribute('stdDeviation', '2');
    blur.setAttribute('result', 'blur');
    const threshold = document.createElementNS(svgNS, 'feColorMatrix');
    threshold.setAttribute('in', 'blur');
    threshold.setAttribute('mode', 'matrix');
    threshold.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8');
    threshold.setAttribute('result', 'liquid');
    const blend = document.createElementNS(svgNS, 'feBlend');
    blend.setAttribute('in', 'SourceGraphic');
    blend.setAttribute('in2', 'liquid');
    filter.append(blur, threshold, blend);
    defs.append(filter);
    const liquid = document.createElementNS(svgNS, 'g');
    liquid.dataset.liquidSurface = '';
    liquid.setAttribute('filter', 'url(#field-map-liquid)');
    svg.append(defs, liquid);
    const fragment = document.createDocumentFragment();
    particles = sources.map((source, index) => {
      const element = document.createElement('span');
      element.dataset.sourceKind = source.kind;
      const droplet = document.createElementNS(svgNS, 'circle');
      droplet.setAttribute('fill', '#dce64e');
      droplet.style.display = 'none';
      liquid.append(droplet);
      const angle = index * goldenAngle;
      const radius = 6 + 38 * Math.sqrt((index + .5) / sources.length);
      fragment.append(element);
      return {
        element, droplet, source, index, x: source.x, y: source.y, size: source.size,
        offsetX: Math.cos(angle) * radius, offsetY: Math.sin(angle) * radius,
        lag: 170 + (index % 7) * 21, kickX: 0, kickY: 0, inDesk: false
      };
    });
    liquidCore = document.createElementNS(svgNS, 'circle');
    liquidCore.classList.add('liquid-core');
    liquidCore.setAttribute('fill', '#dce64e');
    liquidCore.setAttribute('r', '5.5');
    liquidCore.style.display = 'none';
    liquid.append(liquidCore);
    cursor = document.createElement('span');
    cursor.className = 'gravity-cursor';
    cursor.style.opacity = '0';
    fragment.append(cursor);
    layer.append(svg, fragment);
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
    let farthest = 0;
    const insideTime = Math.max(0, time - enteredAt);
    const contraction = phase === 'inside' ? Math.exp(-insideTime / 430) : 1;
    const splatterProgress = phase === 'splatter' ? clamp((time - splatterStarted) / splatterDuration, 0, 1) : 0;
    const splatterEase = 1 - Math.pow(1 - splatterProgress, 3);
    const spread = Math.sin(Math.PI * splatterProgress) * (1 - splatterProgress) * 30;
    for (const particle of particles) {
      const returning = phase === 'return';
      if (phase === 'splatter') {
        const angle = particle.index * goldenAngle;
        particle.x = particle.splatterX + (particle.source.x - particle.splatterX) * splatterEase + Math.cos(angle) * spread;
        particle.y = particle.splatterY + (particle.source.y - particle.splatterY) * splatterEase + Math.sin(angle) * spread;
        particle.size = particle.splatterSize + (particle.source.size - particle.splatterSize) * splatterEase;
      } else {
        particle.kickX *= Math.exp(-elapsed / 250);
        particle.kickY *= Math.exp(-elapsed / 250);
        const wobble = phase === 'inside' ? 1 + .18 * Math.sin(insideTime / 100 + particle.index * .7) : 1;
        let targetX = returning ? particle.source.x : pointer.x + particle.offsetX * contraction * wobble + particle.kickX;
        let targetY = returning ? particle.source.y : pointer.y + particle.offsetY * contraction * wobble + particle.kickY;
        if (phase === 'inside') {
          targetX = clamp(targetX, bounds.left + 5, bounds.right - 5);
          targetY = clamp(targetY, bounds.top + 5, bounds.bottom - 5);
        }
        const targetSize = returning ? particle.source.size : phase === 'inside' ? 4.5 : 5;
        const amount = 1 - Math.exp(-elapsed / (returning ? 230 : particle.lag));
        particle.x += (targetX - particle.x) * amount;
        particle.y += (targetY - particle.y) * amount;
        particle.size += (targetSize - particle.size) * amount;
        if (Math.abs(targetX - particle.x) > .4 || Math.abs(targetY - particle.y) > .4 || Math.abs(targetSize - particle.size) > .08) moving = true;
      }
      const drawnX = particle.x.toFixed(1);
      const drawnY = particle.y.toFixed(1);
      const inDesk = within(Number(drawnX), Number(drawnY), bounds);
      if (inDesk !== particle.inDesk) {
        particle.inDesk = inDesk;
        particle.element.classList.toggle('is-in-desk', inDesk);
        particle.droplet.style.display = inDesk ? '' : 'none';
      }
      const distanceHome = Math.hypot(particle.x - particle.source.x, particle.y - particle.source.y);
      const opacity = returning || phase === 'splatter' ? Math.min(.95, distanceHome / 22).toFixed(2) : '.95';
      particle.element.style.opacity = inDesk ? '0' : opacity;
      particle.element.style.transform = `translate3d(${drawnX}px, ${drawnY}px, 0) translate(-50%, -50%) scale(${(particle.size / 8).toFixed(3)})`;
      particle.droplet.style.opacity = opacity;
      particle.droplet.setAttribute('cx', drawnX);
      particle.droplet.setAttribute('cy', drawnY);
      particle.droplet.setAttribute('r', (particle.size / 2).toFixed(2));
      if (phase === 'inside') farthest = Math.max(farthest, Math.hypot(particle.x - pointer.x, particle.y - pointer.y));
    }
    if (phase === 'inside') {
      liquidCore.setAttribute('r', (5.5 + .5 * Math.exp(-insideTime / 700) * Math.sin(insideTime / 95)).toFixed(2));
      if (time < splitUntil) layer.dataset.liquid = 'splitting';
      else if (contraction < .025 && farthest < 6) { layer.dataset.liquid = 'fused'; fusedOnce = true; }
      else layer.dataset.liquid = 'gathering';
      if (contraction > .02 || time < splitUntil) moving = true;
    }
    if (phase === 'splatter') {
      if (splatterProgress >= 1) { stop(); return; }
      schedule();
      return;
    }
    if (!moving) {
      previousTime = 0;
      if (phase === 'return') stop();
      return;
    }
    schedule();
  }

  function move(event) {
    if (event.pointerType !== 'mouse' || reduced.matches || !mouseAvailable.matches || document.hidden || phase === 'splatter') return;
    // Scroll and resize clear the effect, so its measured bounds stay valid
    // while particles move without forcing a new layout on every mouse event.
    if (!layer) bounds = desk.getBoundingClientRect();
    if (!bounds.width || !bounds.height) { stop(); return; }
    const now = performance.now();
    const previousPhase = phase;
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
    if (inside && previousPhase !== 'inside') {
      enteredAt = now;
      splitUntil = 0;
      fusedOnce = false;
      motionSample = { ...pointer, time: now };
      particles.forEach(particle => { particle.kickX = 0; particle.kickY = 0; });
    } else if (inside && fusedOnce) {
      if (!motionSample) motionSample = { ...pointer, time: now };
      const dx = pointer.x - motionSample.x;
      const dy = pointer.y - motionSample.y;
      const distance = Math.hypot(dx, dy);
      const sampleAge = now - motionSample.time;
      const speed = distance / clamp(sampleAge, 8, 48);
      if (distance > 7 && speed > .7) {
        const amount = Math.min(34, distance * .45);
        particles.forEach(particle => {
          if (particle.index % 3 !== 0) return;
          const side = Math.sin(particle.index * goldenAngle) * amount * .55;
          particle.kickX = clamp(particle.kickX - dx / distance * amount - dy / distance * side, -45, 45);
          particle.kickY = clamp(particle.kickY - dy / distance * amount + dx / distance * side, -45, 45);
        });
        splitUntil = now + 500;
        motionSample = { ...pointer, time: now };
      } else if (sampleAge >= 32) {
        motionSample = { ...pointer, time: now };
      }
    } else if (!inside) motionSample = null;
    layer.dataset.phase = phase;
    cursor.style.opacity = inside ? '1' : '0';
    cursor.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) translate(-50%, -50%) scale(.875)`;
    liquidCore.style.display = inside ? '' : 'none';
    liquidCore.setAttribute('cx', pointer.x);
    liquidCore.setAttribute('cy', pointer.y);
    if (!inside) delete layer.dataset.liquid;
    schedule();
  }

  function splatter(link) {
    if (!layer || phase !== 'inside') return false;
    phase = 'splatter';
    layer.dataset.phase = phase;
    delete layer.dataset.liquid;
    cursor.style.opacity = '0';
    liquidCore.style.display = 'none';
    splatterStarted = performance.now();
    particles.forEach(particle => {
      particle.splatterX = particle.x;
      particle.splatterY = particle.y;
      particle.splatterSize = particle.size;
    });
    pendingSelection = link ? () => link.click() : null;
    // If animation frames stop, never leave an ordinary link waiting forever.
    selectionTimer = setTimeout(stop, splatterDuration + 300);
    schedule();
    return true;
  }

  function modified(event) {
    return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  }
  desk.addEventListener('fieldmap:select', event => {
    const { link, pointer: source } = event.detail || {};
    if (!link || !source || !source.isTrusted || source.pointerType !== 'mouse' || source.button !== 0) return;
    if (modified(source)) {
      if (phase === 'splatter') { pendingSelection = null; stop(); }
      else splatter(null);
      return;
    }
    if (phase === 'splatter') { pendingSelection = () => link.click(); event.preventDefault(); return; }
    if (splatter(link)) event.preventDefault();
  });
  desk.addEventListener('click', event => {
    const link = event.target.closest('[data-desk-link]');
    if (!link || !desk.contains(link) || event.defaultPrevented) return;
    if (!event.isTrusted || event.detail === 0) {
      // Keyboard activation remains immediate, even during a pending effect.
      if (event.isTrusted && phase === 'splatter') { pendingSelection = null; stop(); }
      return;
    }
    if (event.button !== 0 || modified(event) || link.hasAttribute('download') || (link.target && link.target !== '_self')) {
      if (phase === 'splatter') { pendingSelection = null; stop(); }
      else splatter(null);
      return;
    }
    if (phase === 'splatter') {
      pendingSelection = () => link.click();
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (splatter(link)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, { capture: true });
  document.addEventListener('pointerdown', event => {
    if (layer && (event.pointerType !== 'mouse' || (phase === 'splatter' && !desk.contains(event.target)))) {
      // A new action outside the desk supersedes the pending selection.
      pendingSelection = null;
      stop();
    }
  }, { capture: true, passive: true });
  document.addEventListener('keydown', event => {
    if (phase === 'splatter' && (event.key === 'Escape' || event.key === 'Tab')) { pendingSelection = null; stop(); }
  }, { capture: true });
  document.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerout', event => {
    if (layer && phase !== 'splatter' && !event.relatedTarget) {
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
  window.addEventListener('pagehide', () => { pendingSelection = null; stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  if (document.fonts) document.fonts.addEventListener('loadingdone', stop);
})();
