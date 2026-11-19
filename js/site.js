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

  // A decorative thread tracks the chapters already in the document. The
  // regular navigation remains available even without this enhancement.
  const chapterRail = document.querySelector('[data-chapter-rail]');
  const chapterProgress = document.querySelector('[data-chapter-progress]');
  const chapters = ['work', 'experience', 'competitions', 'about', 'contact'].map(id => document.getElementById(id));
  const chapterStops = chapterRail ? [...chapterRail.querySelectorAll('.chapter-rail-stop')] : [];
  if (chapterRail && chapterProgress && chapters.every(Boolean) && chapterStops.length === chapters.length) {
    let scheduled = false;
    function updateChapterThread() {
      scheduled = false;
      const readingLine = innerHeight * .38;
      let current = -1;
      chapters.forEach((chapter, index) => {
        if (chapter.getBoundingClientRect().top <= readingLine) current = index;
      });
      chapterStops.forEach((stop, index) => {
        stop.classList.toggle('is-current', index === current);
        stop.classList.toggle('is-past', index < current);
      });
      chapterProgress.style.transform = `scaleY(${Math.max(current, 0) / (chapters.length - 1)})`;
      chapterRail.classList.toggle('is-intro', current < 0);
    }
    function scheduleChapterThread() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(updateChapterThread);
    }
    updateChapterThread();
    chapterRail.hidden = false;
    window.addEventListener('scroll', scheduleChapterThread, { passive: true });
    window.addEventListener('resize', scheduleChapterThread);
  }

  // A cached failed response can leave both uses of a project image broken.
  // Retry each affected image once with a fresh URL; keep failures bounded.
  document.querySelectorAll('#work .project-folder img, #work .project-art img').forEach(image => {
    let retried = false;
    function retryImage() {
      if (retried) return;
      retried = true;
      const url = new URL(image.currentSrc || image.src, document.baseURI);
      if (url.origin !== location.origin) return;
      url.searchParams.set('image_retry', Date.now().toString(36));
      image.src = url.href;
    }
    image.addEventListener('error', retryImage, { once: true });
    // An image can fail before this script attaches its listener.
    if (image.complete && image.currentSrc && !image.naturalWidth) retryImage();
  });

  // The summaries remain ordinary, visible HTML until this enhancement is ready.
  const folders = document.querySelector('[data-project-folders]');
  const projectDetails = document.querySelector('[data-project-details]');
  const detailsHead = document.querySelector('[data-project-details-head]');
  const closeProject = document.querySelector('[data-project-close]');
  const projectStatus = document.querySelector('[data-project-status]');
  const folderButtons = folders ? [...folders.querySelectorAll('[data-project]')] : [];
  const projectPanels = projectDetails ? [...projectDetails.querySelectorAll(':scope > .project')] : [];
  if (folders && projectDetails && detailsHead && closeProject && projectStatus && folderButtons.length &&
      folderButtons.length === projectPanels.length &&
      folderButtons.every(button => projectPanels.some(panel => panel.id === button.dataset.project))) {
    let selected = null;
    function selectProject(button) {
      selected = button;
      folderButtons.forEach(folder => folder.setAttribute('aria-expanded', String(folder === button)));
      projectPanels.forEach(panel => { panel.hidden = !button || panel.id !== button.dataset.project; });
      projectDetails.hidden = !button;
      projectStatus.textContent = button ? `${button.querySelector('.folder-title').textContent} summary opened below.` : 'Project summary closed.';
    }
    folderButtons.forEach(button => button.addEventListener('click', () => selectProject(selected === button ? null : button)));
    closeProject.addEventListener('click', () => {
      const previous = selected;
      selectProject(null);
      if (previous) previous.focus();
    });
    folders.closest('#work').addEventListener('keydown', event => {
      if (event.key === 'Escape' && selected) {
        event.preventDefault();
        closeProject.click();
      }
    });
    detailsHead.hidden = false;
    selectProject(null);
    projectStatus.textContent = '';
    folders.hidden = false;
  }

  // Build a navigable path from the existing role summaries. Without this
  // enhancement, the original details elements remain available as a list.
  const experience = document.getElementById('experience');
  const experiencePath = document.querySelector('[data-experience-path]');
  const experienceStops = document.querySelector('[data-experience-stops]');
  const experienceRoles = document.querySelector('[data-experience-roles]');
  const experienceEmpty = document.querySelector('[data-experience-empty]');
  const experienceHead = document.querySelector('[data-experience-detail-head]');
  const experienceClose = document.querySelector('[data-experience-close]');
  const experienceStatus = document.querySelector('[data-experience-status]');
  // The HTML order puts the most relevant work first; dates remain visible.
  const roles = experienceRoles ? [...experienceRoles.querySelectorAll(':scope > .role')] : [];
  const roleInfo = roles.map(role => {
    const summary = role.querySelector(':scope > summary');
    const time = summary && summary.querySelector('.role-time');
    const organisation = summary && summary.querySelector('strong');
    const title = summary && summary.querySelector(':scope > span:nth-child(2) > span');
    return { role, time, organisation, title, date: time && time.firstChild.textContent.trim() };
  });
  if (experience && experiencePath && experienceStops && experienceRoles && experienceEmpty && experienceHead && experienceClose && experienceStatus &&
      roleInfo.length && roleInfo.every(item => item.role.id && item.role.dataset.pathLabel && item.date && item.organisation && item.title)) {
    let selectedRole = null;
    let printingExperience = false;
    const buttons = roleInfo.map(({ role, date, organisation, title }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'experience-stop';
      button.dataset.experienceTarget = role.id;
      button.setAttribute('aria-controls', role.id);
      button.setAttribute('aria-expanded', 'false');
      const fullName = organisation.textContent.trim();
      const labelName = role.dataset.pathLabel === fullName ? fullName : `${role.dataset.pathLabel}, ${fullName}`;
      button.setAttribute('aria-label', `${labelName}, ${title.textContent}, ${date}`);
      const marker = document.createElement('span');
      marker.className = 'experience-marker';
      marker.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'experience-stop-label';
      for (const [className, value] of [
        ['experience-stop-date', date],
        ['experience-stop-name', role.dataset.pathLabel],
        ['experience-stop-role', title.textContent]
      ]) {
        const part = document.createElement('span');
        part.className = className;
        part.textContent = value;
        label.append(part);
      }
      button.append(marker, label);
      experienceStops.append(button);
      return button;
    });
    function selectRole(next, restoreFocus = false) {
      const previous = selectedRole;
      selectedRole = next;
      roles.forEach((role, index) => {
        const active = role === next;
        role.hidden = !active;
        role.open = active;
        buttons[index].setAttribute('aria-expanded', String(active));
      });
      experienceHead.hidden = !next;
      experienceRoles.hidden = !next;
      experienceEmpty.hidden = Boolean(next);
      experienceStatus.textContent = next ? `${next.querySelector('strong').textContent} role details opened below.` : 'Role details closed.';
      if (restoreFocus && previous) buttons[roles.indexOf(previous)].focus();
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => {
      const next = selectedRole === roles[index] ? null : roles[index];
      selectRole(next);
      if (next && matchMedia('(max-width: 600px)').matches) {
        const frame = experienceStops.getBoundingClientRect();
        const point = button.getBoundingClientRect();
        if (point.left < frame.left || point.right > frame.right) {
          const offset = (point.left + point.right - frame.left - frame.right) / 2;
          experienceStops.scrollTo({ left: experienceStops.scrollLeft + offset, behavior: reduced.matches ? 'auto' : 'smooth' });
        }
      }
    }));
    experienceClose.addEventListener('click', () => selectRole(null, true));
    experience.addEventListener('keydown', event => {
      if (event.key === 'Escape' && selectedRole) {
        event.preventDefault();
        selectRole(null, true);
      }
    });
    roles.forEach(role => role.addEventListener('toggle', () => {
      if (!printingExperience && role === selectedRole && !role.open) {
        selectRole(null, role.contains(document.activeElement));
      }
    }));
    window.addEventListener('beforeprint', () => { printingExperience = true; });
    window.addEventListener('afterprint', () => { printingExperience = false; });
    experience.classList.add('has-experience-path');
    selectRole(null);
    experienceStatus.textContent = '';
    experiencePath.hidden = false;
  }

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

  sprites.forEach(sprite => {
    const pose = sprite.dataset.pose || 'idle';
    const gesture = sprite.dataset.gesture;
    const poseDurations = { idle: 2400, point: 2400, scan: 3600 };
    createViewportActivity(sprite, {
      duration: Number(sprite.dataset.motionDuration) || poseDurations[pose] || 2800,
      threshold: 0.15,
      reset() {
        if (gesture) sprite.dataset.pose = pose;
        sprite.classList.remove('is-active', 'is-complete', 'is-static');
        restartAnimation(sprite);
      },
      play() {
        if (gesture) sprite.dataset.pose = gesture;
        sprite.classList.add('is-active');
      },
      settle() {
        sprite.classList.remove('is-active');
        if (gesture) sprite.dataset.pose = pose;
        sprite.classList.add('is-complete');
      },
      staticState() {
        sprite.classList.remove('is-active');
        if (gesture) sprite.dataset.pose = pose;
        sprite.classList.add('is-static', 'is-complete');
      }
    });
  });

  const heroSketch = document.querySelector('.hero-sketch');
  if (heroSketch) {
    createViewportActivity(heroSketch, {
      duration: 1500,
      threshold: .15,
      reset() { heroSketch.classList.remove('is-drawing'); },
      play() { heroSketch.classList.add('is-drawing'); },
      settle() { heroSketch.classList.remove('is-drawing'); },
      staticState() { heroSketch.classList.remove('is-drawing'); }
    });
  }
  document.querySelectorAll('.chapter-label').forEach(label => {
    createViewportActivity(label, {
      duration: 800,
      threshold: .15,
      reset() { label.classList.remove('is-inking'); },
      play() { label.classList.add('is-inking'); },
      settle() { label.classList.remove('is-inking'); },
      staticState() { label.classList.remove('is-inking'); }
    });
  });

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
      // On phones the path is drawn vertically and fits, so the region has nothing to scroll and no reason to take focus.
      if (wideFlow.matches) diagram.setAttribute('tabindex', '0');
      else diagram.removeAttribute('tabindex');
      diagram.classList.toggle('has-flow-control', available);
      diagram.classList.toggle('is-user-paused', userPaused);
      if (available) {
        diagram.setAttribute('role', 'button');
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
    help: 'whoami — a short introduction\nwork or ls — the three projects\ncontact — email and profiles\nresume — where to find the downloadable PDF\nmfa · grc · nmap · eicar · sqli · xss — small security notes\nsudo — nice try\nclear — clear this log\nexit — close the terminal',
    whoami: 'Barry Sampath. Bharath personally. Cybersecurity & IT Automation Analyst at ScienceGears, based in Brisbane. Curious about systems; careful with the details.',
    work: '01 ITDR home lab — Phase 1 telemetry collection complete; development paused.\n02 ClassQuest — five-person hackathon build; ten merged PRs from me.\n03 LUNA — Raspberry Pi robot, built with Zhirui Lu.\nUse the Work links above to inspect each case study.',
    contact: 'Email: barry.sampath@outlook.com\nLinkedIn: linkedin.com/in/barrysampath\nGitHub: github.com/bharath-blazecode\nOpen to suitable 2027 internships and early-career opportunities. Work rights remain subject to student visa conditions.',
    resume: 'Use Résumé in the navigation or introduction to open my current PDF. It is also available in Contact.',
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
