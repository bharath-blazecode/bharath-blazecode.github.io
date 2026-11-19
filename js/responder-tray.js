/* Enhances existing project controls and native details; no navigation depends on it. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const guide = document.querySelector('[data-case-guide]');
  const avatar = guide && guide.querySelector('.case-guide-avatar');
  const message = guide && guide.querySelector('[data-guide-message]');
  const projectButtons = [...document.querySelectorAll('[data-project]')];
  const projectClose = document.querySelector('[data-project-close]');
  const notes = {
    'project-lab': 'Start with the signal, then follow the evidence.',
    'project-quest': 'A team build, with decisions you can inspect.',
    'project-luna': 'Explore a robot built with Zhirui Lu.'
  };
  let gestureTimer;
  function stopGesture() {
    clearTimeout(gestureTimer);
    if (avatar) avatar.classList.remove('is-gesturing');
  }
  function syncGuide() {
    if (!guide || !avatar || !message) return;
    const selected = projectButtons.find(button => button.getAttribute('aria-expanded') === 'true');
    stopGesture();
    guide.hidden = !selected || !notes[selected.dataset.project];
    if (guide.hidden) return;
    message.textContent = notes[selected.dataset.project];
    if (!reduced.matches && !document.hidden) {
      // A new selection starts a single gesture, never a looping animation.
      void avatar.offsetWidth;
      avatar.classList.add('is-gesturing');
      gestureTimer = setTimeout(stopGesture, 1200);
    }
  }
  projectButtons.forEach(button => button.addEventListener('click', syncGuide));
  if (projectClose) projectClose.addEventListener('click', syncGuide);

  const tray = document.querySelector('[data-tray-details]');
  const shards = document.querySelector('[data-tray-shards]');
  const close = document.querySelector('[data-tray-close]');
  const summary = tray && tray.querySelector('summary');
  let shardTimer;
  function stopShards() {
    clearTimeout(shardTimer);
    if (shards) shards.classList.remove('is-shattering');
  }
  if (tray && shards && close && summary) {
    close.hidden = false;
    function closeTray(restoreFocus) {
      tray.open = false;
      stopShards();
      if (!reduced.matches && !document.hidden) {
        void shards.offsetWidth;
        shards.classList.add('is-shattering');
        shardTimer = setTimeout(stopShards, 1100);
      }
      if (restoreFocus) summary.focus();
    }
    summary.addEventListener('click', event => {
      if (!tray.open) { stopShards(); return; }
      event.preventDefault();
      closeTray(false);
    });
    close.addEventListener('click', () => closeTray(true));
    tray.addEventListener('keydown', event => {
      if (event.key === 'Escape' && tray.open) {
        event.preventDefault();
        closeTray(true);
      }
    });
  }
  reduced.addEventListener('change', () => { stopGesture(); stopShards(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopGesture(); stopShards(); }
  });
})();
