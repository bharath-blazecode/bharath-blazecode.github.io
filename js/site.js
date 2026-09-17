/* Field Notes: optional enhancements; core content is ordinary HTML. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const themeButton = document.getElementById('theme-toggle');
  const motionButton = document.getElementById('motion-toggle');
  let paused = false;
  try { paused = localStorage.getItem('bs-motion') === 'paused'; } catch (_) {}
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : dark.matches; }
  function themeLabel() {
    if (!themeButton) return;
    themeButton.textContent = isDark() ? 'Day' : 'Night';
    themeButton.setAttribute('aria-label', `Switch to ${isDark() ? 'light' : 'dark'} theme`);
  }
  if (themeButton) {
    themeButton.hidden = false;
    themeLabel();
    themeButton.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem('bs-shift', next); } catch (_) {}
      themeLabel();
    });
    dark.addEventListener('change', themeLabel);
  }
  document.querySelectorAll('.mobile-menu a').forEach(link => {
    link.addEventListener('click', () => link.closest('details').removeAttribute('open'));
  });
  document.querySelectorAll('.mobile-menu').forEach(menu => {
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { menu.open = false; menu.querySelector('summary').focus(); }
    });
  });
  const sprites = [...document.querySelectorAll('.responder')];
  const visible = new WeakMap();
  const reel = document.getElementById('role-reel');
  const roles = ['Blue team', 'Identity & access', 'GRC', 'IT automation', 'SOC opportunities'];
  let reelVisible = false, roleIndex = 0, reelTimer = null;
  if (reel) reel.setAttribute('aria-hidden', 'true');
  function showRole(staticMode) {
    if (!reel) return;
    reel.replaceChildren();
    const span = document.createElement('span');
    span.className = 'role-reel-item' + (staticMode ? '' : ' changed');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = staticMode ? 'Blue team · Identity · GRC · Automation · SOC' : roles[roleIndex];
    reel.append(span);
  }
  function motionSync() {
    clearTimeout(reelTimer); reelTimer = null;
    const stop = paused || reduced.matches;
    root.dataset.motion = stop ? 'paused' : 'running';
    sprites.forEach(sprite => sprite.classList.toggle('is-active', !stop && !document.hidden && visible.get(sprite) === true));
    if (motionButton) {
      motionButton.hidden = !(sprites.length || reel);
      motionButton.textContent = reduced.matches ? 'Motion off' : paused ? 'Play motion' : 'Pause motion';
      motionButton.setAttribute('aria-pressed', String(stop));
      motionButton.setAttribute('aria-label', reduced.matches ? 'Motion disabled by your system preference' : paused ? 'Play decorative motion' : 'Pause decorative motion');
      motionButton.disabled = reduced.matches;
    }
    showRole(stop);
    if (!stop && !document.hidden && reelVisible && reel) {
      reelTimer = setTimeout(() => { roleIndex = (roleIndex + 1) % roles.length; motionSync(); }, 3300);
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.target === reel) reelVisible = entry.isIntersecting;
        else visible.set(entry.target, entry.isIntersecting);
      });
      motionSync();
    }, { threshold: 0.1 });
    sprites.forEach(sprite => observer.observe(sprite));
    if (reel) observer.observe(reel);
  }
  if (motionButton) motionButton.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('bs-motion', paused ? 'paused' : 'running'); } catch (_) {}
    motionSync();
  });
  reduced.addEventListener('change', motionSync);
  document.addEventListener('visibilitychange', motionSync);
  motionSync();
  const form = document.getElementById('terminal-form');
  const input = document.getElementById('terminal-input');
  const log = document.getElementById('terminal-log');
  const terminal = document.getElementById('terminal');
  const replies = {
    help: 'whoami — a short introduction\nwork or ls — the three projects\ncontact — email and profiles\nresume — the existing PDF and its update status\nmfa · grc · nmap · eicar · sqli · xss — small security notes\nsudo — nice try\nclear — clear this log\nexit — close the terminal',
    whoami: 'Barry Sampath. Bharath personally. Cybersecurity & IT Automation Analyst at ScienceGears, based in Brisbane. Curious about systems; careful with the details.',
    work: '01 ITDR home lab — Phase 1 telemetry collection complete; development paused.\n02 ClassQuest — five-person hackathon build; ten merged PRs from me.\n03 LUNA — Raspberry Pi robot, built with Zhirui Lu.\nUse the Work links above to inspect each case study.',
    contact: 'Email: barry.sampath@outlook.com\nLinkedIn: linkedin.com/in/barrysampath\nGitHub: github.com/bharath-blazecode\nOpen to suitable 2027 internships and early-career opportunities. Work rights remain subject to student visa conditions.',
    resume: 'The linked résumé is from June 2026 and needs updating. GPA, graduation date and lab-status claims are superseded by this site. Find the labelled PDF in Contact.',
    mfa: 'Multi-factor authentication asks for more than one kind of proof. It is one part of an access-control system, alongside permissions and the conditions under which access is allowed.',
    grc: 'Governance, risk and compliance: deciding which controls are needed, who owns them, and what evidence shows that they work.',
    nmap: 'Nmap helps inspect network services. Only scan systems you own or have explicit permission to test. This sandbox performs no scans.',
    eicar: 'EICAR provides a standard harmless file for checking antivirus handling. No test file is created or downloaded here.',
    sqli: 'SQL injection happens when untrusted input changes the meaning of a database query. Parameterised queries keep data separate from query structure.',
    xss: 'Untrusted input should be rendered as text. This terminal uses textContent; submitted markup is never inserted as HTML.',
    sudo: 'Permission denied. The little responder runs a tight ship.',
    cards: 'mfa · grc · nmap · eicar · sqli · xss — choose a topic for a short explanation.'
  };
  replies.ls = replies.work;
  if (form && input && log) {
    form.hidden = false;
    document.querySelector('.terminal-shortcuts').hidden = false;
    const history = []; let historyIndex = 0;
    function run(raw) {
      const command = raw.trim().slice(0, 200);
      if (!command) return;
      history.push(command); if (history.length > 50) history.shift(); historyIndex = history.length;
      const key = command.toLowerCase();
      if (key === 'clear') { log.replaceChildren(); input.value = ''; return; }
      if (key === 'exit') { terminal.open = false; terminal.querySelector('summary').focus(); input.value = ''; return; }
      const line = document.createElement('p'), echo = document.createElement('span');
      echo.className = 'command-echo'; echo.textContent = '$ ' + command;
      const response = document.createElement('span');
      response.textContent = Object.prototype.hasOwnProperty.call(replies, key)
        ? replies[key]
        : 'Unknown command. Try help for the available commands.';
      line.append(echo, response); log.append(line);
      while (log.children.length > 30) log.firstElementChild.remove();
      log.scrollTop = log.scrollHeight; input.value = '';
    }
    form.addEventListener('submit', event => { event.preventDefault(); run(input.value); });
    document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => { run(button.dataset.command); input.focus(); }));
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowUp') { event.preventDefault(); historyIndex = Math.max(0, historyIndex - 1); input.value = history[historyIndex] || ''; }
      if (event.key === 'ArrowDown') { event.preventDefault(); historyIndex = Math.min(history.length, historyIndex + 1); input.value = history[historyIndex] || ''; }
    });
  }
  let printStates = [];
  window.addEventListener('beforeprint', () => {
    printStates = [...document.querySelectorAll('details:not(.mobile-menu):not(.terminal-disclosure)')].map(detail => [detail, detail.open]);
    printStates.forEach(([detail]) => { detail.open = true; });
  });
  window.addEventListener('afterprint', () => printStates.forEach(([detail, open]) => { detail.open = open; }));
})();
