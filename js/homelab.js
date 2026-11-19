/* Enhancements for the lab notebook and the illustrative investigation. */
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
    function showPage(index, direction) {
      if (index < 0 || index >= pages.length) return;
      current = index;
      if (direction) notebook.dataset.turn = direction;
      pages.forEach((page, pageIndex) => { page.hidden = pageIndex !== current; });
      previous.setAttribute('aria-disabled', String(current === 0));
      next.setAttribute('aria-disabled', String(current === pages.length - 1));
      status.textContent = `Note ${current + 1} of ${pages.length}: ${pages[current].dataset.notebookTitle}`;
    }
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

  const flow = document.querySelector('[data-investigation-flow]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (flow && 'IntersectionObserver' in window) {
    let visible = false;
    function syncDrawing() {
      flow.classList.toggle('is-drawing', visible && !document.hidden && !reduced.matches);
    }
    const observer = new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .15);
      syncDrawing();
    }, { threshold: [0, .15] });
    observer.observe(flow);
    document.addEventListener('visibilitychange', syncDrawing);
    reduced.addEventListener('change', syncDrawing);
  }
})();
