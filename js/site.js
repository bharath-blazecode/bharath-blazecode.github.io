/* Field Notes: optional enhancements; core content is ordinary HTML. */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('has-js');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const themeButton = document.getElementById('theme-toggle');
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

  document.querySelectorAll('[data-offshift-index]').forEach(index => {
    const tablist = index.querySelector('[data-offshift-tabs]');
    const tabs = [...index.querySelectorAll('[data-offshift-tab]')];
    const notes = [...index.querySelectorAll('[data-offshift-note]')];
    if (!tablist || !tabs.length || tabs.length !== notes.length) return;

    index.dataset.enhanced = '';
    tablist.hidden = false;
    tablist.setAttribute('role', 'tablist');
    tabs.forEach(tab => tab.setAttribute('role', 'tab'));
    notes.forEach(note => {
      note.setAttribute('role', 'tabpanel');
      note.setAttribute('aria-labelledby', `offshift-tab-${note.dataset.offshiftNote}`);
      note.tabIndex = 0;
    });

    function activate(nextIndex, moveFocus = false) {
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === nextIndex;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        notes[tabIndex].hidden = !active;
        notes[tabIndex].classList.remove('is-entering');
        if (active) {
          void notes[tabIndex].offsetWidth;
          notes[tabIndex].classList.add('is-entering');
        }
      });
      if (moveFocus) tabs[nextIndex].focus();
    }

    tabs.forEach((tab, tabIndex) => {
      tab.addEventListener('click', () => activate(tabIndex));
      tab.addEventListener('keydown', event => {
        let nextIndex = tabIndex;
        if (event.key === 'ArrowRight') nextIndex = (tabIndex + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') nextIndex = 0;
        else if (event.key === 'End') nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(nextIndex, true);
      });
    });
    activate(1);
  });

  /*
   * Decorative motion begins in view. Most sequences settle within five seconds
   * and only become eligible to replay after fully leaving the viewport. The
   * telemetry diagram is the one continuous sequence; it stops off screen and
   * can be paused locally. Reduced-motion visitors receive the final state.
   */
  const activities = [];
  function restartAnimation(element) {
    element.style.animationName = 'none';
    void element.getBoundingClientRect();
    element.style.removeProperty('animation-name');
  }
  function createViewportActivity(element, options) {
    const duration = Math.min(Number(options.duration) || 3000, 4900);
    const threshold = Number(options.threshold) || 0.1;
    const continuous = options.continuous === true;
    let inView = false;
    let armed = true;
    let running = false;
    let interrupted = false;
    let finishTimer = null;
    let leaveTimer = null;
    let cancelPlayback = null;

    function cancelTimer() {
      clearTimeout(finishTimer);
      finishTimer = null;
      if (cancelPlayback) cancelPlayback();
      cancelPlayback = null;
    }
    function settle() {
      cancelTimer();
      running = false;
      options.settle();
    }
    function showStatic() {
      cancelTimer();
      running = false;
      armed = false;
      interrupted = false;
      options.staticState();
    }
    function play() {
      if (!armed || running || reduced.matches || document.hidden || !inView) return;
      armed = false;
      running = true;
      interrupted = false;
      options.reset();
      cancelPlayback = options.play() || null;
      if (!continuous) finishTimer = setTimeout(settle, duration);
    }
    function leave() {
      inView = false;
      interrupted = false;
      if (running) settle();
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        if (!inView && !reduced.matches) armed = true;
      }, 350);
    }
    function enter(entry) {
      inView = true;
      if (leaveTimer !== null) {
        clearTimeout(leaveTimer);
        leaveTimer = null;
        if (!reduced.matches) armed = true;
      }
      if (entry.intersectionRatio >= threshold || entry.boundingClientRect.height < 40) play();
    }
    function interrupt() {
      if (!running) return;
      interrupted = true;
      settle();
      interrupted = true;
    }
    function resume() {
      if (!inView || reduced.matches || document.hidden) return;
      if (interrupted) armed = true;
      if (armed && !running) play();
    }
    function preferenceChanged() {
      if (reduced.matches) showStatic();
      else {
        options.reset();
        armed = true;
        if (inView && !document.hidden) play();
      }
    }

    const activity = { element, enter, leave, interrupt, resume, preferenceChanged, play };
    activities.push(activity);
    if (reduced.matches) showStatic();
    return activity;
  }

  const sprites = [...document.querySelectorAll('.responder')];
  const reel = document.getElementById('role-reel');
  const roles = ['Blue team', 'Identity & access', 'GRC', 'IT automation', 'SOC opportunities'];
  const fullRoleList = 'Blue team · Identity & access · GRC · IT automation · SOC opportunities';
  function showRole(text, changed = false) {
    if (!reel) return;
    reel.replaceChildren();
    const span = document.createElement('span');
    span.className = 'role-reel-item' + (changed ? ' changed' : '');
    span.setAttribute('aria-hidden', 'true');
    span.textContent = text;
    reel.append(span);
  }

  sprites.forEach(sprite => {
    const pose = sprite.dataset.pose || 'idle';
    const poseDurations = { idle: 2400, point: 2400, scan: 3600 };
    createViewportActivity(sprite, {
      duration: Number(sprite.dataset.motionDuration) || poseDurations[pose] || 2800,
      threshold: 0.15,
      reset() {
        sprite.classList.remove('is-active', 'is-complete', 'is-static');
        restartAnimation(sprite);
      },
      play() { sprite.classList.add('is-active'); },
      settle() {
        sprite.classList.remove('is-active');
        sprite.classList.add('is-complete');
      },
      staticState() {
        sprite.classList.remove('is-active');
        sprite.classList.add('is-static', 'is-complete');
      }
    });
  });

  if (reel) {
    reel.setAttribute('aria-hidden', 'true');
    createViewportActivity(reel, {
      duration: 4200,
      threshold: 0.15,
      reset() { showRole(roles[0]); },
      play() {
        const timers = roles.slice(1).map((role, index) =>
          setTimeout(() => showRole(role, true), (index + 1) * 720)
        );
        timers.push(setTimeout(() => showRole(fullRoleList, true), 3700));
        return () => timers.forEach(clearTimeout);
      },
      settle() { showRole(fullRoleList); },
      staticState() { showRole(fullRoleList); }
    });
  }

  const flowDiagrams = [...document.querySelectorAll('[data-telemetry-flow], .diagram')]
    .filter((diagram, index, all) => diagram.querySelector('.dpacket') && all.indexOf(diagram) === index);
  const wideFlow = window.matchMedia('(min-width: 601px)');
  flowDiagrams.forEach(diagram => {
    const packets = [...diagram.querySelectorAll('.dpacket')];
    const instruction = diagram.parentElement.querySelector('[data-flow-instruction]');
    const packetStagger = 700;
    let userPaused = false;
    packets.forEach((packet, index) => {
      packet.style.setProperty('--packet-index', index);
      packet.style.setProperty('--packet-delay', `${index * packetStagger}ms`);
    });
    function controlAvailable() {
      return wideFlow.matches && !reduced.matches;
    }
    function syncFlowControl() {
      const available = controlAvailable();
      const narrow = !wideFlow.matches;
      diagram.classList.toggle('has-flow-control', available);
      diagram.classList.toggle('is-user-paused', userPaused);
      if (available) {
        diagram.setAttribute('role', 'button');
        diagram.tabIndex = 0;
        diagram.setAttribute('aria-pressed', String(userPaused));
        diagram.setAttribute('aria-keyshortcuts', 'Enter Space');
        if (instruction) {
          instruction.hidden = false;
          instruction.textContent = userPaused
            ? ' Packet flow paused. Select the diagram or press Enter to resume.'
            : ' Select the diagram or press Enter to pause.';
        }
      } else {
        diagram.setAttribute('role', 'region');
        if (narrow) diagram.tabIndex = 0;
        else diagram.removeAttribute('tabindex');
        diagram.removeAttribute('aria-pressed');
        diagram.removeAttribute('aria-keyshortcuts');
        if (instruction) instruction.hidden = true;
      }
    }
    function toggleFlow() {
      if (!controlAvailable()) return;
      userPaused = !userPaused;
      syncFlowControl();
    }
    diagram.addEventListener('click', toggleFlow);
    diagram.addEventListener('keydown', event => {
      if (!controlAvailable()) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleFlow();
    });
    wideFlow.addEventListener('change', syncFlowControl);
    reduced.addEventListener('change', syncFlowControl);
    syncFlowControl();
    createViewportActivity(diagram, {
      threshold: 0.3,
      continuous: true,
      reset() {
        diagram.classList.remove('is-flowing', 'is-complete', 'is-static');
        packets.forEach(restartAnimation);
      },
      play() { diagram.classList.add('is-flowing'); },
      settle() {
        diagram.classList.remove('is-flowing');
        diagram.classList.add('is-complete');
      },
      staticState() {
        diagram.classList.remove('is-flowing');
        diagram.classList.add('is-static', 'is-complete');
      }
    });
  });

  const traces = [...document.querySelectorAll('[data-event-trace], .event-trace')];
  traces.forEach(trace => {
    const lines = [...trace.querySelectorAll('[data-trace-line], [data-trace-step], .trace-line, .event-trace-row')];
    if (!lines.length) return;
    lines.forEach((line, index) => line.style.setProperty('--trace-index', index));
    const revealDelay = Math.min(Number(trace.dataset.traceDelay) || 450, 600);
    const revealInterval = Math.min(Number(trace.dataset.traceInterval) || 850, 900);
    createViewportActivity(trace, {
      duration: Math.min(revealDelay + (lines.length - 1) * revealInterval + 650, 4700),
      threshold: 0.3,
      reset() {
        trace.classList.remove('is-playing', 'is-complete', 'is-static');
        lines.forEach(line => line.classList.remove('is-revealed'));
      },
      play() {
        trace.classList.add('is-playing');
        const timers = lines.map((line, index) =>
          setTimeout(() => line.classList.add('is-revealed'), revealDelay + index * revealInterval)
        );
        return () => timers.forEach(clearTimeout);
      },
      settle() {
        trace.classList.remove('is-playing');
        trace.classList.add('is-complete');
        lines.forEach(line => line.classList.add('is-revealed'));
      },
      staticState() {
        trace.classList.remove('is-playing');
        trace.classList.add('is-static', 'is-complete');
        lines.forEach(line => line.classList.add('is-revealed'));
      }
    });
  });

  function syncMotionState() {
    root.dataset.motion = reduced.matches || document.hidden ? 'paused' : 'running';
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const activity = activities.find(candidate => candidate.element === entry.target);
        if (!activity) return;
        if (entry.isIntersecting) activity.enter(entry);
        else activity.leave();
      });
    }, { threshold: [0, 0.1, 0.15, 0.3] });
    activities.forEach(activity => observer.observe(activity.element));
  } else {
    activities.forEach(activity => {
      activity.enter({ intersectionRatio: 1, boundingClientRect: activity.element.getBoundingClientRect() });
    });
  }
  reduced.addEventListener('change', () => {
    syncMotionState();
    activities.forEach(activity => activity.preferenceChanged());
  });
  document.addEventListener('visibilitychange', () => {
    syncMotionState();
    if (document.hidden) activities.forEach(activity => activity.interrupt());
    else activities.forEach(activity => activity.resume());
  });
  syncMotionState();
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
