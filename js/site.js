// Shared behaviour for every page: theme, menu, scroll reveals and the terminal loader.
(() => {
  'use strict';
  const root = document.documentElement;
  const here = document.currentScript ? document.currentScript.src : location.href;

  // Light is the default. A visitor's choice is remembered on this device only.
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    const label = toggle.querySelector('[data-theme-label]');
    const sync = () => {
      const dark = root.dataset.theme === 'dark';
      toggle.setAttribute('aria-pressed', String(dark));
      if (label) label.textContent = dark ? 'Switch to light theme' : 'Switch to dark theme';
    };
    toggle.hidden = false;
    sync();
    toggle.addEventListener('click', () => {
      const dark = root.dataset.theme !== 'dark';
      if (dark) root.dataset.theme = 'dark'; else delete root.dataset.theme;
      try { localStorage.setItem('bs-shift', dark ? 'dark' : 'light'); } catch (_) {}
      sync();
    });
  }

  // Move keyboard focus with the skip link, not only the scroll position.
  const skip = document.querySelector('.skip');
  const main = document.getElementById('main');
  if (skip && main) skip.addEventListener('click', () => { main.tabIndex = -1; main.focus(); });

  const menu = document.querySelector('.menu');
  if (menu) {
    const close = focus => { if (menu.open) { menu.open = false; if (focus) menu.querySelector('summary').focus(); } };
    menu.addEventListener('click', event => { if (event.target.closest('nav a')) close(false); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(true); });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) close(false); });
  }

  // Browsers without scroll-driven animations get a one-off class instead.
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && !(window.CSS && CSS.supports('animation-timeline: view()'))) {
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-in'); observer.unobserve(entry.target); }
      }, { rootMargin: '0px 0px -8% 0px' });
      reveals.forEach(item => observer.observe(item));
    } else {
      reveals.forEach(item => item.classList.add('is-in'));
    }
  }

  // The terminal loads on first use, from the header button, the backtick key
  // or any element with data-terminal-run="<command>".
  let terminal = null;
  function openTerminal(trigger, command) {
    terminal = terminal || import(new URL('terminal.js', here).href);
    terminal.then(module => module.openTerminal({ trigger, command })).catch(() => { terminal = null; });
  }
  document.querySelectorAll('[data-terminal-open]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => openTerminal(button));
  });
  document.querySelectorAll('[data-terminal-run]').forEach(item => {
    item.hidden = false;
    item.addEventListener('click', event => { event.preventDefault(); openTerminal(item, item.dataset.terminalRun); });
  });
  document.addEventListener('keydown', event => {
    if (event.key !== '`' || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    event.preventDefault();
    const active = document.activeElement;
    openTerminal(active instanceof HTMLElement && active !== document.body ? active : document.querySelector('[data-terminal-open]'));
  });
})();
