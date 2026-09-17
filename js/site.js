/* ============================================================
   Barry Sampath — portfolio v1.0.2
   Everything here is progressive enhancement. With JavaScript
   disabled the page still reads correctly: the role list shows
   as plain text, every walkthrough panel is visible stacked,
   and the theme follows the operating system.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var motionQuery = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = !!(motionQuery && motionQuery.matches);
  var motionListeners = [];

  function watchMedia(query, callback) {
    if (!query) { return; }
    if (query.addEventListener) { query.addEventListener('change', callback); }
    else if (query.addListener) { query.addListener(callback); }
  }

  function syncMotion() {
    reduce = !!(motionQuery && motionQuery.matches);
    root.setAttribute('data-reduced-motion', String(reduce));
    motionListeners.forEach(function (listener) { listener(); });
  }
  watchMedia(motionQuery, syncMotion);
  syncMotion();

  /* A suspended timer retains its remaining duration. CSS uses the same
     paused flag, so neither the sprite frames nor its state clock advances. */
  function makeClock(callback) {
    var timer = null;
    var started = 0;
    var remaining = 0;
    return {
      reset: function (delay) {
        clearTimeout(timer);
        timer = null;
        remaining = delay;
      },
      pause: function () {
        if (timer === null) { return; }
        clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (Date.now() - started));
      },
      resume: function () {
        if (timer !== null) { return; }
        started = Date.now();
        timer = setTimeout(function () { timer = null; callback(); }, remaining);
      }
    };
  }

  function watchVisibility(element, callback) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        callback(entries[0].isIntersecting);
      }, { threshold: 0.15 }).observe(element);
    } else { callback(true); }
  }

  var bar = document.querySelector('.bar');
  function headerHeight() {
    return bar ? Math.ceil(bar.getBoundingClientRect().height) : 0;
  }
  function measureHeader() {
    var height = headerHeight() + 'px';
    root.style.setProperty('--header-height', height);
    root.style.setProperty('--header-offset', height);
  }
  measureHeader();
  window.addEventListener('resize', measureHeader);
  if (bar && 'ResizeObserver' in window) { new ResizeObserver(measureHeader).observe(bar); }

  /* Record a section-relative position before a mode changes its height.
     Native scroll anchoring alone tends to pin the sticky mode controls. */
  function preserveReadingPosition(change) {
    var sections = Array.prototype.slice.call(document.querySelectorAll('main > [id], main > .hero, main > section'));
    var line = headerHeight() + 20;
    var current = null;
    sections.forEach(function (section) {
      var rect = section.getBoundingClientRect();
      if (rect.height && rect.top <= line) { current = section; }
    });
    var before = current && current.getBoundingClientRect();
    var fraction = before ? Math.max(0, Math.min(1, (line - before.top) / before.height)) : 0;
    change();
    measureHeader();
    if (current && before && current.getBoundingClientRect().height) {
      var after = current.getBoundingClientRect();
      window.scrollTo({ top: Math.max(0, window.scrollY + after.top + fraction * after.height - headerHeight() - 20), behavior: 'instant' });
    }
  }

  /* ---------------------------------------------------------
     1. Day shift / night shift
     Explicit choices have matching visible and programmatic states.
     Theme changes are immediate and preserve the reading position.
     --------------------------------------------------------- */
  var themeButtons = Array.prototype.slice.call(document.querySelectorAll('[data-theme-choice]'));
  var colourQuery = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) { return explicit === 'dark'; }
    return !!(colourQuery && colourQuery.matches);
  }

  function syncTheme() {
    themeButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-theme-choice') === (isDark() ? 'dark' : 'light')));
    });
  }

  /* restore a previous choice; absent one, the OS decides */
  try {
    var saved = localStorage.getItem('bs-shift');
    if (saved === 'dark' || saved === 'light') { root.setAttribute('data-theme', saved); }
  } catch (e) { /* private mode, blocked storage — OS preference stands */ }

  syncTheme();
  watchMedia(colourQuery, syncTheme);
  themeButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var next = button.getAttribute('data-theme-choice');
      if (next !== 'light' && next !== 'dark') { return; }
      preserveReadingPosition(function () { root.setAttribute('data-theme', next); });
      syncTheme();
      try { localStorage.setItem('bs-shift', next); } catch (e) {}
    });
  });

  /* ---------------------------------------------------------
     2. Roles stay visible. No timer or entrance animation changes
     the identity line while somebody is reading it.
     --------------------------------------------------------- */
  var rlist = document.getElementById('roleList');
  if (rlist) { rlist.classList.remove('rotating'); }

  /* ---------------------------------------------------------
     3. The console
     Nine illustrative events use condensed display timing.
     The alert holds for nine seconds before the example repeats.
     Hover, focus, manual pause, offscreen and hidden-tab states suspend it.
     Reduced motion prints the complete example without animation.
     --------------------------------------------------------- */
  var con        = document.getElementById('console');
  var conPause   = document.getElementById('conPause');
  var conRestart = document.getElementById('conRestart');

  var FEED = [
    ['11:42:04', 'EventID 1   svchost.exe    ← services.exe'],
    ['11:42:06', 'EventID 3   chrome.exe     → 142.250.76.14:443'],
    ['11:42:08', 'EventID 1   Teams.exe      ← explorer.exe'],
    ['11:42:09', 'EventID 3   Teams.exe      → 52.113.194.132:443'],
    ['11:42:11', 'EventID 11  OUTLOOK.EXE    created ~\\AppData\\Local\\Temp\\att.tmp'],
    ['11:42:13', 'EventID 1   conhost.exe    ← svchost.exe'],
    ['11:42:15', 'EventID 1   WINWORD.EXE    ← explorer.exe'],
    ['11:42:16', 'EventID 11  WINWORD.EXE    created ~\\AppData\\Roaming\\...\\index.dat'],
    ['11:42:18', 'EventID 1   powershell.exe ← WINWORD.EXE  -nop -w hidden -enc', true]
  ];

  var LINE_GAP = 560;   /* between ordinary events            */
  var LAST_GAP = 900;   /* beat before the one that matters   */
  var ALERT_GAP = 430;  /* event to alert card                */
  if (con) {
    var cIndex = 0;
    var onScreen = false;
    var hovered = false;
    var focused = false;
    var byHand = false;
    var complete = false;

    var addLine = function (row) {
      var d = document.createElement('div');
      d.className = 'ln' + (row[2] ? ' hit' : '');
      d.textContent = row[0] + '  ' + row[1];
      con.appendChild(d);
    };

    var addAlert = function () {
      var d = document.createElement('div');
      d.className = 'alertln';
      d.textContent = '▲  LEVEL 12  ·  rule 100210  ·  ' +
                      'Office application spawned PowerShell  ·  T1059.001';
      con.appendChild(d);
    };

    var canRun = function () {
      return !reduce && !complete && onScreen && !hovered && !focused && !byHand && !document.hidden;
    };
    var consoleClock = makeClock(function () {
      if (cIndex < FEED.length) {
        addLine(FEED[cIndex]);
        cIndex += 1;
        consoleClock.reset(cIndex === FEED.length ? ALERT_GAP : cIndex === FEED.length - 1 ? LAST_GAP : LINE_GAP);
      } else if (cIndex === FEED.length) {
        addAlert();
        cIndex += 1;
        consoleClock.reset(9000);
      } else {
        con.textContent = '';
        cIndex = 0;
        consoleClock.reset(320);
      }
      sync();
    });
    var sync = function () {
      var running = canRun();
      con.setAttribute('data-motion-paused', String(!running));
      con.setAttribute('data-motion-settled', String(complete));
      if (running) { consoleClock.resume(); } else { consoleClock.pause(); }
      if (conPause) {
        conPause.textContent = reduce ? 'Motion reduced' : complete ? 'Example complete' : byHand ? 'Resume' : 'Pause';
        conPause.setAttribute('aria-pressed', String(byHand));
        conPause.setAttribute('aria-disabled', String(reduce || complete));
      }
      if (conRestart) { conRestart.setAttribute('aria-disabled', String(reduce)); }
    };
    var restart = function () {
      consoleClock.reset(200);
      con.textContent = '';
      cIndex = 0;
      complete = false;
      byHand = false;
      sync();
    };
    var consoleMotionChanged = function () {
      if (reduce) {
        consoleClock.pause();
        con.textContent = '';
        FEED.forEach(addLine);
        addAlert();
        complete = true;
      }
      sync();
    };
    if (conPause) {
      conPause.addEventListener('click', function () {
        if (reduce || complete) { return; }
        byHand = !byHand;
        sync();
      });
    }
    if (conRestart) {
      conRestart.addEventListener('click', function () { if (!reduce) { restart(); } });
    }
    con.addEventListener('mouseenter', function () { hovered = true; sync(); });
    con.addEventListener('mouseleave', function () { hovered = false; sync(); });
    con.addEventListener('focusin', function () { focused = true; sync(); });
    con.addEventListener('focusout', function (event) { focused = con.contains(event.relatedTarget); sync(); });
    document.addEventListener('visibilitychange', sync);
    motionListeners.push(consoleMotionChanged);
    restart();
    consoleMotionChanged();
    watchVisibility(con, function (visible) { onScreen = visible; sync(); });
  }

  /* ---------------------------------------------------------
     4. Detection walkthrough tabs
     Without JavaScript every panel renders stacked, so the
     content is never hidden behind an interaction.
     --------------------------------------------------------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.steps [role="tab"]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.panel'));

  if (tabs.length && panels.length) {
    var host = document.getElementById('walkthrough');
    if (host) { host.classList.add('js-on'); }

    var show = function (n) {
      tabs.forEach(function (t, k) {
        t.setAttribute('aria-selected', String(k === n));
        t.tabIndex = k === n ? 0 : -1;
      });
      panels.forEach(function (p, k) {
        p.classList.toggle('live', k === n);
        p.hidden = k !== n;
      });
    };

    tabs.forEach(function (t, k) {
      t.tabIndex = k === 0 ? 0 : -1;
      t.addEventListener('click', function () { show(k); });
      t.addEventListener('keydown', function (e) {
        var n = null;
        if (e.key === 'ArrowRight') { n = (k + 1) % tabs.length; }
        if (e.key === 'ArrowLeft')  { n = (k - 1 + tabs.length) % tabs.length; }
        if (e.key === 'Home')       { n = 0; }
        if (e.key === 'End')        { n = tabs.length - 1; }
        if (n !== null) { e.preventDefault(); show(n); tabs[n].focus(); }
      });
    });

    show(0);
  }
/* ============================================================
   Incident responder
   A short automatic story plays only while the hero is visible:
   monitor, detect, contain, recover, investigate, then settle.
   Scrolling never controls or reverses the sequence.
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('incidentStage');
  var stageSprite = stage && stage.querySelector('.responder-sprite');
  var stageLabel = document.getElementById('incidentState');
  var pauseButton = document.getElementById('incidentPause');
  var replayButton = document.getElementById('incidentReplay');
  var controls = document.getElementById('incidentControls');
  if (!stage || !stageSprite) { return; }

  var stageStates = {
    idle:        { motion: 'idle',    label: 'Monitoring' },
    alert:       { motion: 'alert',   label: 'Signal detected' },
    contain:     { motion: 'contain', label: 'Containment active' },
    clear:       { motion: 'idle',    label: 'System recovered' },
    investigate: { motion: 'scan',    label: 'Investigating trace' }
  };
  var sequence = [
    { name: 'idle', duration: 2200 },
    { name: 'alert', duration: 2200 },
    { name: 'contain', duration: 3000 },
    { name: 'clear', duration: 2200 },
    { name: 'investigate', duration: 3000 }
  ];
  var currentStage = '';
  var phase = 0;
  var onScreen = false;
  var pausedByHand = false;
  var complete = false;

  try { pausedByHand = sessionStorage.getItem('bs-incident-paused') === 'true'; }
  catch (e) { /* blocked storage: default to playing */ }

  function setMotion(sprite, motion) {
    if (sprite.getAttribute('data-motion') !== motion) {
      sprite.setAttribute('data-motion', motion);
    }
  }

  function setStage(name) {
    if (currentStage === name) { return; }
    currentStage = name;
    stage.setAttribute('data-incident', name);
    setMotion(stageSprite, stageStates[name].motion);
    if (stageLabel) { stageLabel.textContent = stageStates[name].label; }
  }

  function canRun() {
    return !reduce && !complete && onScreen && !pausedByHand && !document.hidden;
  }

  var clock = makeClock(function () {
    phase += 1;
    if (phase >= sequence.length) {
      complete = true;
      setStage('clear');
      if (stageLabel) { stageLabel.textContent = 'Trace complete'; }
    } else {
      setStage(sequence[phase].name);
      clock.reset(sequence[phase].duration);
    }
    sync();
  });

  function sync() {
    var running = canRun();
    stage.setAttribute('data-motion-paused', String(!running));
    stage.setAttribute('data-motion-settled', String(complete));
    if (running) { clock.resume(); } else { clock.pause(); }
    updatePauseButton();
  }

  function updatePauseButton() {
    if (!pauseButton) { return; }
    pauseButton.textContent = reduce ? 'Motion reduced' : complete ? 'Sequence complete' : pausedByHand ? 'Resume animation' : 'Pause animation';
    pauseButton.setAttribute('aria-pressed', String(pausedByHand));
    pauseButton.setAttribute('aria-disabled', String(reduce || complete));
    if (replayButton) { replayButton.setAttribute('aria-disabled', String(reduce)); }
  }

  function setPaused(state) {
    pausedByHand = state;
    try { sessionStorage.setItem('bs-incident-paused', String(state)); } catch (e) {}
    sync();
  }

  function replay() {
    if (reduce) { return; }
    phase = 0;
    complete = false;
    clock.reset(sequence[0].duration);
    setStage(sequence[0].name);
    setPaused(false);
  }

  function motionChanged() {
    if (reduce) {
      clock.pause();
      complete = true;
      setStage('clear');
    }
    sync();
  }

  if (controls) { controls.hidden = false; }
  clock.reset(sequence[0].duration);
  setStage(sequence[0].name);
  if (pauseButton) {
    pauseButton.addEventListener('click', function () {
      if (!reduce && !complete) { setPaused(!pausedByHand); }
    });
  }
  if (replayButton) { replayButton.addEventListener('click', replay); }
  document.addEventListener('visibilitychange', sync);

  motionListeners.push(motionChanged);
  motionChanged();
  watchVisibility(stage, function (visible) { onScreen = visible; sync(); });
})();

/* The terminal responder points once, then holds the final frame. */
(function () {
  var terminal = document.querySelector('.terminal-responder');
  if (!terminal) { return; }
  var visible = false;
  var complete = false;
  var clock = makeClock(function () { complete = true; sync(); });
  clock.reset(860);
  function sync() {
    if (reduce) { complete = true; }
    var running = !reduce && !complete && visible && !document.hidden;
    terminal.setAttribute('data-motion-paused', String(!running));
    terminal.setAttribute('data-motion-settled', String(complete));
    if (running) { clock.resume(); } else { clock.pause(); }
  }
  document.addEventListener('visibilitychange', sync);
  motionListeners.push(sync);
  sync();
  watchVisibility(terminal, function (onScreen) { visible = onScreen; sync(); });
})();

/* ============================================================
   Skim / Read, and the hello-world panel.
   Static example cards and a text-only simulated terminal.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------------------------------------------------------
     Skim mode
     Skim is the default for a first visit. A saved choice wins.
     With JavaScript off, CSS leaves every section visible.
     --------------------------------------------------------- */
  var modeBtns = Array.prototype.slice.call(document.querySelectorAll('.modectl button'));
  if (modeBtns.length) {
    var setMode = function (m) {
      if (m === 'skim') { root.setAttribute('data-mode', 'skim'); }
      else { root.removeAttribute('data-mode'); }
      modeBtns.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.mode === m));
      });
    };
    var startMode = 'skim';
    try { startMode = localStorage.getItem('bs-mode') || 'skim'; } catch (e) {}
    setMode(startMode);
    modeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        preserveReadingPosition(function () { setMode(b.dataset.mode); });
        try { localStorage.setItem('bs-mode', b.dataset.mode); } catch (e) {}
      });
    });
  }

  Array.prototype.slice.call(document.querySelectorAll('.mobile-nav a')).forEach(function (link) {
    link.addEventListener('click', function () {
      var menu = link.closest('details');
      if (menu) { menu.open = false; }
    });
  });

  /* ---------------------------------------------------------
     hello, world
     Every field has a first line everyone recognises. Security
     has several. Advances only when the visitor asks.
     --------------------------------------------------------- */
  var LINES = [
    {
      cmd: 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      raw: true,
      gloss: 'The EICAR test string is a harmless sample used to check whether antivirus detection is working.'
    },
    {
      cmd: 'nmap -sV scanme.nmap.org',
      gloss: 'A common service scan against the test host that explicitly permits it. Scanning another system requires permission.'
    },
    {
      cmd: "' OR '1'='1",
      raw: true,
      gloss: 'A basic SQL injection example that shows why applications should use parameterised queries.'
    },
    {
      cmd: 'whoami',
      gloss: 'Shows the current user. It is useful context for an administrator and a common post-compromise command.'
    },
    {
      cmd: 'It depends.',
      raw: true,
      gloss: 'A GRC answer depends on the system, the risk and the constraints. The useful follow-up is: on what?'
    },
    {
      cmd: 'Have you tried turning MFA on?',
      raw: true,
      gloss: 'MFA is a high-impact identity control, although it is only one part of a secure access design.'
    }
  ];

  var hwCode  = document.getElementById('hwCode');
  var hwGloss = document.getElementById('hwGloss');
  var hwNext  = document.getElementById('hwNext');
  var hwDots  = document.getElementById('hwDots');
  var hwState = document.getElementById('hwState');
  var hwLog   = document.getElementById('hwLog');
  var hwForm  = document.getElementById('hwForm');
  var hwInput = document.getElementById('hwInput');

  if (hwCode && hwGloss) {
    var hi = 0;

    if (hwDots) {
      LINES.forEach(function () { hwDots.appendChild(document.createElement('i')); });
    }

    /* ---------------------------------------------------------
       The card. Always visible, always the same six lines.
       Typing never replaces it. No timer changes its content.
       --------------------------------------------------------- */
    var paint = function (n) {
      hi = (n + LINES.length) % LINES.length;
      var L = LINES[hi];
      hwCode.textContent = L.cmd;
      hwCode.className = 'hwcode' + (L.raw ? ' nocmd' : '');
      hwGloss.textContent = L.gloss;
      if (hwDots) {
        Array.prototype.slice.call(hwDots.children).forEach(function (d, k) {
          d.className = k === hi ? 'on' : '';
        });
      }
    };

    var advance = function () { paint(hi + 1); };

    paint(0);
    if (hwState) { hwState.hidden = true; }

    if (hwNext) {
      hwNext.addEventListener('click', advance);
    }

    /* ---------------------------------------------------------
       The terminal. Appends below the card, never over it.
       Every response is written with textContent, so the xss and
       sqli answers below are inert text rather than markup.
       --------------------------------------------------------- */
    var EICAR = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';

    var COMMANDS = {
      help: function () {
        return [['Commands: whoami, nmap, eicar, sqli, xss, grc, mfa, cards, ' +
                 'ls, resume, contact, sudo, clear.'],
                ['cards prints all six of the lines above at once. Nothing here ' +
                 'touches your machine. This is a static page and it has no idea ' +
                 'what you are running.']];
      },
      cards: function () {
        var rows = [['All six, in order:']];
        LINES.forEach(function (L) {
          rows.push([L.cmd, 1]);
          rows.push([L.gloss]);
        });
        return rows;
      },
      whoami: function () {
        return [['bharath (barry)', 1],
                ['Bharath is my given name, and I use Barry professionally. ' +
                 'I am a QUT cybersecurity and AI student in Brisbane.']];
      },
      nmap: function () {
        return [['nmap -sV scanme.nmap.org', 1],
                ['A common service scan against the test host that explicitly ' +
                 'permits it. Scanning another system requires permission.']];
      },
      eicar: function () {
        return [[EICAR, 1],
                ['A harmless test string used to check whether antivirus ' +
                 'detection is working without using real malware.']];
      },
      sqli: function () {
        return [["' OR '1'='1", 1],
                ['A basic SQL injection example and a reason applications use ' +
                 'parameterised queries.']];
      },
      xss: function () {
        return [['<script>alert(1)</script>', 1],
                ['This page prints the example as text, so the browser does not ' +
                 'interpret it as markup.']];
      },
      grc: function () {
        return [['It depends.', 1],
                ['A GRC answer depends on the system, the risk and the ' +
                 'constraints. The useful follow-up is: on what?']];
      },
      mfa: function () {
        return [['Have you tried turning MFA on?', 1],
                ['MFA is a high-impact identity control, although it is only one ' +
                 'part of a secure access design.']];
      },
      ls: function () {
        var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
                   (!document.documentElement.getAttribute('data-theme') &&
                    window.matchMedia &&
                    window.matchMedia('(prefers-color-scheme: dark)').matches);
        return [['about  work  experience  skills  background' +
                 (dark ? '  off-shift' : ''), 1],
                [dark ? 'All of it. You are on the night shift.'
                      : 'That is everything the day shift shows.']];
      },
      resume: function () {
        return [['resume/Barry_Sampath_Resume.pdf', 1],
                ['One page. The link is in the header and at the bottom of the page.']];
      },
      contact: function () {
        return [['barry.sampath@outlook.com', 1],
                ['Also on LinkedIn at /in/barrysampath and GitHub as bharath-blazecode.']];
      },
      sudo: function () {
        return [['Nice try.', 1],
                ['This is a static page. There is no shell, no server and nothing ' +
                 'to escalate to. Which is its own small security lesson.']];
      }
    };

    function write(echo, rows) {
      hwLog.hidden = false;
      if (echo !== null) {
        var e = document.createElement('p');
        e.className = 'hwecho';
        e.textContent = echo;
        hwLog.appendChild(e);
      }
      rows.forEach(function (row) {
        var r = document.createElement('p');
        r.className = 'hwreply' + (row[1] ? ' mono' : '');
        r.textContent = row[0];
        hwLog.appendChild(r);
      });
      hwLog.scrollTop = hwLog.scrollHeight;
    }

    if (hwForm && hwInput && hwLog) {
      hwForm.hidden = false;
      var history = [];
      var hpos = -1;

      hwInput.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') { return; }
        if (!history.length) { return; }
        e.preventDefault();
        if (e.key === 'ArrowUp') { hpos = Math.min(hpos + 1, history.length - 1); }
        else { hpos = Math.max(hpos - 1, -1); }
        hwInput.value = hpos < 0 ? '' : history[hpos];
      });

      hwForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var raw = hwInput.value.trim();
        hwInput.value = '';
        hwInput.focus({ preventScroll: true });
        if (!raw) { return; }
        history.unshift(raw);
        hpos = -1;

        var cmd = raw.toLowerCase().split(/\s+/)[0];

        if (cmd === 'clear') {
          hwLog.textContent = '';
          hwLog.hidden = true;
          return;
        }
        if (cmd === 'exit' || cmd === 'q') {
          hwLog.textContent = '';
          hwLog.hidden = true;
          hwInput.blur();
          return;
        }

        var fn = Object.prototype.hasOwnProperty.call(COMMANDS, cmd) ? COMMANDS[cmd] : null;
        write(raw, fn ? fn()
                      : [['command not found: ' + cmd, 1],
                         ['Try help.']]);
      });
    }
  }
})();

/* Offset same-document navigation by the measured sticky header, close the
   mobile menu first, and put keyboard focus at the destination. */
function anchorTarget(hash) {
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
  catch (e) { return null; }
}
function revealAnchor(target) {
  if (root.getAttribute('data-mode') === 'skim' && target.closest('.detail-only')) {
    root.removeAttribute('data-mode');
    Array.prototype.forEach.call(document.querySelectorAll('.modectl button'), function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.mode === 'read'));
    });
    try { localStorage.setItem('bs-mode', 'read'); } catch (e) {}
  }
}
function scrollToAnchor(target, smooth) {
  measureHeader();
  window.scrollTo({ top: Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerHeight() - 16), behavior: smooth && !reduce ? 'smooth' : 'instant' });
}
document.addEventListener('click', function (event) {
  var link = event.target.closest && event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.hasAttribute('download') || link.target === '_blank') { return; }
  var url;
  try { url = new URL(link.href, window.location.href); } catch (e) { return; }
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || url.search !== window.location.search || !url.hash) { return; }
  var target = anchorTarget(url.hash);
  if (!target) { return; }
  event.preventDefault();
  var menu = link.closest('details');
  if (menu) { menu.open = false; }
  revealAnchor(target);
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
    target.addEventListener('blur', function () { target.removeAttribute('tabindex'); }, { once: true });
  }
  target.focus({ preventScroll: true });
  try { window.history.pushState(null, '', url.hash); } catch (e) { /* native URL may be unavailable in a local preview */ }
  scrollToAnchor(target, true);
});

/* A case-study link can request the detailed walkthrough even when the
   visitor last chose Skim. Reveal it before native hash positioning. */
var initialTarget = anchorTarget(window.location.hash);
if (initialTarget) { revealAnchor(initialTarget); }
function restoreHashPosition() {
  var target = anchorTarget(window.location.hash);
  if (!target) { return; }
  revealAnchor(target);
  scrollToAnchor(target, false);
}
window.addEventListener('load', restoreHashPosition);
window.addEventListener('hashchange', restoreHashPosition);
})();
