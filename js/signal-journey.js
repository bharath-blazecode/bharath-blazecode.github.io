/* Decorative motion only: text, links and normal scrolling never depend on it. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const stage = document.querySelector('.desk-stage');
  const signals = document.querySelector('[data-desk-signals]');
  const journey = document.querySelector('[data-evidence-journey]');
  const folders = document.querySelector('[data-project-folders]');
  const note = document.querySelector('[data-note-signal]');
  let pointerFrame = 0;
  let pointer = null;
  let pulseTimer = null;
  let scrollFrame = 0;

  function resetPointer() {
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointer = null;
    clearTimeout(pulseTimer);
    if (signals) signals.classList.remove('is-tracking', 'is-pulsing');
  }
  function locate(event) {
    const rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }
  function place(point) {
    signals.style.setProperty('--signal-x', `${(point.x * 100).toFixed(1)}%`);
    signals.style.setProperty('--signal-y', `${(point.y * 100).toFixed(1)}%`);
  }
  if (stage && signals) {
    stage.addEventListener('pointermove', event => {
      if (!finePointer.matches || reduced.matches || document.hidden || event.pointerType !== 'mouse') return;
      pointer = locate(event);
      if (!pointer || pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        if (!pointer) return;
        place(pointer);
        signals.classList.add('is-tracking');
      });
    }, { passive: true });
    stage.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'touch' || reduced.matches || document.hidden) return;
      const point = locate(event);
      if (!point) return;
      place(point);
      signals.classList.remove('is-pulsing');
      void signals.offsetWidth;
      signals.classList.add('is-pulsing');
      clearTimeout(pulseTimer);
      pulseTimer = setTimeout(() => signals.classList.remove('is-pulsing'), 800);
    }, { passive: true });
    // Touch pointers leave immediately after a tap; let their pulse finish.
    stage.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') resetPointer(); });
    stage.addEventListener('pointercancel', resetPointer);
    finePointer.addEventListener('change', resetPointer);
    reduced.addEventListener('change', resetPointer);
  }

  function updateJourney() {
    scrollFrame = 0;
    if (!journey || document.hidden) return;
    if (reduced.matches) { journey.style.setProperty('--journey-progress', '1'); return; }
    const rect = journey.getBoundingClientRect();
    const span = Math.max(rect.height * .8, innerHeight * .35);
    const progress = Math.max(0, Math.min(1, (innerHeight * .85 - rect.top) / span));
    journey.style.setProperty('--journey-progress', progress.toFixed(3));
  }
  function scheduleJourney() {
    if (!scrollFrame && !document.hidden) scrollFrame = requestAnimationFrame(updateJourney);
  }
  if (journey) {
    updateJourney();
    window.addEventListener('scroll', scheduleJourney, { passive: true });
    window.addEventListener('resize', scheduleJourney);
  }

  const visible = new Map();
  function syncDecor() {
    for (const [element, inView] of visible) {
      const active = inView && !document.hidden && !reduced.matches;
      element.classList.toggle(element === folders ? 'is-journey-visible' : 'is-drawing', active);
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => visible.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= .1));
      syncDecor();
    }, { threshold: [0, .1] });
    [folders, note].filter(Boolean).forEach(element => { visible.set(element, false); observer.observe(element); });
  }
  reduced.addEventListener('change', () => { resetPointer(); updateJourney(); syncDecor(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetPointer(); else scheduleJourney(); syncDecor(); });
})();
