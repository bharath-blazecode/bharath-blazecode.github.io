/* Enhancements for the lab notebook, the telemetry diagram and the illustrative investigation. */
(() => {
  'use strict';

  const notebook = document.querySelector('[data-lab-notebook]');
  const pages = notebook ? [...notebook.querySelectorAll('[data-notebook-page]')] : [];
  const controls = notebook && notebook.querySelector('[data-notebook-controls]');
  const previous = notebook && notebook.querySelector('[data-notebook-previous]');
  const next = notebook && notebook.querySelector('[data-notebook-next]');
  const status = notebook && notebook.querySelector('[data-notebook-status]');
  if (pages.length > 1 && controls && previous && next && status && pages.every(page => page.dataset.notebookTitle)) {
    let current = 0;
    const showPage = (index, direction) => {
      if (index < 0 || index >= pages.length) return;
      current = index;
      if (direction) notebook.dataset.turn = direction;
      pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== current; });
      previous.setAttribute('aria-disabled', String(current === 0));
      next.setAttribute('aria-disabled', String(current === pages.length - 1));
      status.textContent = `Note ${current + 1} of ${pages.length}: ${pages[current].dataset.notebookTitle}`;
    };
    previous.addEventListener('click', () => showPage(current - 1, 'previous'));
    next.addEventListener('click', () => showPage(current + 1, 'next'));
    showPage(0);
    notebook.dataset.enhanced = 'true';
    controls.hidden = false;
  }

  document.querySelectorAll('.investigation-stages a[data-guide]').forEach(link => {
    const detail = document.getElementById(link.getAttribute('href').slice(1));
    if (detail) link.addEventListener('click', () => { detail.open = true; });
  });

  // The diagram, the process row and the trace loop only while on screen, in a visible tab, with motion allowed.
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window) {
    const live = document.querySelectorAll('[data-telemetry-flow], [data-investigation-flow], [data-event-trace]');
    const onScreen = new Map();
    const sync = () => {
      live.forEach(item => item.classList.toggle('is-live', Boolean(onScreen.get(item)) && !document.hidden && !reduced.matches));
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => onScreen.set(entry.target, entry.isIntersecting && entry.intersectionRatio >= .15));
      sync();
    }, { threshold: [0, .15] });
    live.forEach(item => observer.observe(item));
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', sync);
  }
})();
