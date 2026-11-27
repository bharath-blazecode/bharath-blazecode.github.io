// Homepage only: the 3D desk, its links to the project folders, and the responder.
(() => {
  'use strict';
  const here = document.currentScript ? document.currentScript.src : location.href;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  // Responder: one short loop per pose, then still. Other poses are fetched ahead so a change never flashes.
  const responder = document.querySelector('[data-responder]');
  function pose(name) {
    if (!responder || reduced.matches) return;
    responder.classList.remove('is-playing');
    responder.dataset.pose = name;
    void responder.getBoundingClientRect();
    responder.classList.add('is-playing');
  }
  if (responder) {
    const sprite = name => new URL(`../assets/incident-responder/${name}.png`, here).href;
    responder.addEventListener('animationend', event => {
      if (event.animationName === 'walk-in') { responder.classList.remove('is-walking'); pose('idle'); return; }
      responder.classList.remove('is-playing');
      responder.dataset.pose = 'idle';
    });
    // Walk in once the walking frames have arrived, so nothing flashes.
    addEventListener('load', () => {
      const walk = new Image();
      walk.onload = () => responder.classList.add('is-here', 'is-walking');
      walk.onerror = () => { responder.classList.add('is-here'); pose('idle'); };
      walk.src = sprite('walk');
      for (const name of ['point', 'scan']) new Image().src = sprite(name);
    }, { once: true });
    responder.addEventListener('pointerenter', () => { if (!responder.classList.contains('is-walking')) pose('point'); });
    responder.addEventListener('click', () => { const opener = document.querySelector('[data-terminal-open]'); if (opener) opener.click(); });
    const actions = document.querySelector('.hero-actions');
    if (actions) actions.addEventListener('pointerenter', () => pose('point'));
  }

  // Chess loads only when asked for.
  const chess = document.querySelector('[data-chess]');
  if (chess) {
    const begin = chess.querySelector('[data-chess-start]');
    const game = chess.querySelector('[data-chess-game]');
    begin.addEventListener('click', async () => {
      begin.disabled = true;
      try {
        const { startChess } = await import(new URL('chess.js', here).href);
        startChess(game, { trigger: begin });
      } catch (_) {
        begin.disabled = false;
      }
    });
  }

  // Experience: each role becomes a point on the path. One role at a time shows in the panel.
  const experience = document.getElementById('experience');
  const xpPath = document.querySelector('[data-experience-path]');
  const xpStops = document.querySelector('[data-experience-stops]');
  const xpRoles = document.querySelector('[data-experience-roles]');
  const xpEmpty = document.querySelector('[data-experience-empty]');
  const xpHead = document.querySelector('[data-experience-detail-head]');
  const xpClose = document.querySelector('[data-experience-close]');
  const xpStatus = document.querySelector('[data-experience-status]');
  const roles = xpRoles ? [...xpRoles.querySelectorAll(':scope > .role')] : [];
  const roleInfo = roles.map(role => {
    const summary = role.querySelector(':scope > summary');
    const time = summary && summary.querySelector('.role-time');
    return {
      role,
      date: time && time.firstChild.textContent.trim(),
      organisation: summary && summary.querySelector('.role-title > strong'),
      title: summary && summary.querySelector('.role-title > span')
    };
  });
  if (experience && xpPath && xpStops && xpEmpty && xpHead && xpClose && xpStatus && roleInfo.length &&
      roleInfo.every(item => item.role.id && item.role.dataset.pathLabel && item.date && item.organisation && item.title)) {
    let selected = null;
    let printing = false;
    const buttons = roleInfo.map(({ role, date, organisation, title }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'experience-stop';
      button.dataset.experienceTarget = role.id;
      button.setAttribute('aria-controls', role.id);
      button.setAttribute('aria-expanded', 'false');
      const full = organisation.textContent.trim();
      // Same order as the visible text, so the spoken name contains what is on screen.
      const extra = role.dataset.pathLabel === full ? '' : `, ${full}`;
      button.setAttribute('aria-label', `${date}, ${role.dataset.pathLabel}, ${title.textContent}${extra}`);
      const marker = document.createElement('span');
      marker.className = 'experience-marker';
      marker.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'experience-stop-label';
      for (const [className, value] of [['experience-stop-date', date], ['experience-stop-name', role.dataset.pathLabel], ['experience-stop-role', title.textContent]]) {
        const part = document.createElement('span');
        part.className = className;
        part.textContent = value;
        // The space keeps the words apart when the text is read as one string; flex layout does not show it.
        label.append(part, ' ');
      }
      button.append(marker, label);
      xpStops.append(button);
      return button;
    });
    function selectRole(next, restoreFocus = false, announce = true) {
      const previous = selected;
      selected = next;
      roles.forEach((role, index) => {
        const active = role === next;
        role.hidden = !active;
        role.open = active;
        buttons[index].setAttribute('aria-expanded', String(active));
      });
      xpHead.hidden = !next;
      xpRoles.hidden = !next;
      xpEmpty.hidden = Boolean(next);
      if (announce) xpStatus.textContent = next ? `${next.querySelector('.role-title > span').textContent}, ${next.dataset.pathLabel}. Details opened below.` : 'Role details closed.';
      if (restoreFocus && previous) buttons[roles.indexOf(previous)].focus();
    }
    buttons.forEach((button, index) => button.addEventListener('click', () => {
      const next = selected === roles[index] ? null : roles[index];
      selectRole(next);
      // On phones the path scrolls sideways; keep the chosen point in view.
      if (next) button.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduced.matches ? 'auto' : 'smooth' });
    }));
    xpClose.addEventListener('click', () => selectRole(null, true));
    experience.addEventListener('keydown', event => {
      if (event.key === 'Escape' && selected) { event.preventDefault(); selectRole(null, true); }
    });
    roles.forEach(role => {
      role.querySelector('summary').addEventListener('click', event => event.preventDefault());
      role.addEventListener('toggle', () => { if (!printing && role === selected && !role.open) selectRole(null, role.contains(document.activeElement)); });
    });
    addEventListener('beforeprint', () => { printing = true; roles.forEach(role => { role.open = true; }); });
    addEventListener('afterprint', () => { printing = false; roles.forEach(role => { role.open = role === selected; }); });
    experience.classList.add('has-experience-path');
    // The first role is open to begin with, so the panel is never empty on first view.
    selectRole(roles[0], false, false);
    xpPath.hidden = false;
  }

  const desk = document.querySelector('[data-desk]');
  if (!desk) return;
  const canvas = desk.querySelector('[data-desk-canvas]');
  const start = desk.querySelector('[data-desk-start]');
  const hint = desk.querySelector('[data-desk-hint]');
  const tags = new Map([...desk.querySelectorAll('[data-tag]')].map(tag => [tag.dataset.tag, tag]));
  const folders = new Map([...document.querySelectorAll('.folder[data-object]')].map(folder => [folder.dataset.object, folder]));
  const mouse = matchMedia('(hover: hover) and (pointer: fine)');
  const wide = matchMedia('(min-width: 901px)');
  const saver = navigator.connection && navigator.connection.saveData;

  let scene = null;
  let loading = false;
  let failed = false;
  let inView = false;
  const sync = () => { if (scene) scene.setVisible(inView && !document.hidden); };

  function mark(key) {
    tags.forEach((tag, name) => tag.classList.toggle('is-active', name === key));
    folders.forEach((folder, name) => folder.classList.toggle('is-linked', name === key));
  }
  function go(key, event) {
    if (key === 'research') { location.href = new URL('../research/', here).href; return; }
    const link = folders.get(key) && folders.get(key).querySelector('h3 a');
    if (!link) return;
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey)) window.open(link.href, '_blank', 'noopener');
    else link.click();
  }
  async function load() {
    if (scene || loading || failed) return;
    loading = true;
    try {
      const { createDeskScene } = await import(new URL('../assets/desk/desk-scene.js', here).href);
      scene = createDeskScene(canvas, {
        reducedMotion: reduced.matches,
        pointerEffects: mouse.matches,
        onReady() {
          desk.classList.add('has-3d');
          if (start) start.hidden = true;
          if (hint && mouse.matches) hint.hidden = false;
        },
        onFailure() {
          failed = true;
          desk.classList.remove('has-3d', 'has-tags');
          if (scene) { scene.dispose(); scene = null; }
        },
        onLayout(anchors) {
          for (const [key, tag] of tags) {
            const spot = anchors[key];
            if (spot) tag.style.transform = `translate(${Math.round(spot[0] + 10)}px, ${Math.round(spot[1] - 14)}px)`;
          }
          desk.classList.add('has-tags');
        },
        onHover(key) { mark(key); if (key) pose('point'); },
        onSelect: go
      });
      sync();
    } catch (_) {
      failed = true; // The still image and the project folders are the complete fallback.
    } finally {
      loading = false;
    }
  }

  folders.forEach((folder, key) => {
    const on = () => { if (scene) scene.highlight(key); tags.forEach((tag, name) => tag.classList.toggle('is-active', name === key)); };
    const off = () => { if (scene) scene.highlight(null); tags.forEach(tag => tag.classList.remove('is-active')); };
    folder.addEventListener('pointerenter', () => { on(); pose('scan'); });
    folder.addEventListener('pointerleave', off);
    folder.addEventListener('focusin', on);
    folder.addEventListener('focusout', off);
  });

  // Desktops with a mouse load the scene once the page is idle and the desk is near. Phones and data-saver visitors choose.
  const auto = mouse.matches && wide.matches && !saver && 'IntersectionObserver' in window;
  if (start) {
    start.hidden = auto;
    start.addEventListener('click', () => { start.disabled = true; load(); });
  }
  if ('IntersectionObserver' in window) {
    const idle = window.requestIdleCallback || (run => setTimeout(run, 200));
    let ready = document.readyState === 'complete';
    let near = false;
    const maybe = () => { if (auto && ready && near) idle(load); };
    if (!ready) addEventListener('load', () => { ready = true; maybe(); }, { once: true });
    // Fetch the scene when the desk is within a screen of the viewport; animate it only while it is on screen.
    new IntersectionObserver((entries, observer) => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      near = true;
      observer.disconnect();
      maybe();
    }, { rootMargin: '100% 0px' }).observe(desk);
    new IntersectionObserver(entries => {
      inView = entries.some(entry => entry.isIntersecting);
      sync();
    }).observe(desk);
  } else {
    inView = true;
  }
  reduced.addEventListener('change', () => { if (scene) scene.setReduced(reduced.matches); });
  document.addEventListener('visibilitychange', sync);
  addEventListener('pagehide', () => { if (scene) scene.setVisible(false); });
  addEventListener('pageshow', sync);
  // Used when making the still image.
  desk.capture = async () => { await load(); return scene ? scene.capture() : null; };
})();
