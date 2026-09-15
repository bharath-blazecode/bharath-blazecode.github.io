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
  var reduce = window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------
     1. Day shift / night shift
     A SOC runs around the clock, so the two states are named
     for the two shifts. The switch wipes the document as a
     circle expanding from the button that was pressed, which
     gives the change a physical origin instead of a fade.
     Falls back to an instant switch where unsupported.
     --------------------------------------------------------- */
  var btn = document.getElementById('shiftBtn');
  var lbl = document.getElementById('shiftLbl');

  function isDark() {
    var explicit = root.getAttribute('data-theme');
    if (explicit) { return explicit === 'dark'; }
    return !!(window.matchMedia &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function syncLabel() {
    if (lbl) { lbl.textContent = isDark() ? 'Day shift' : 'Night shift'; }
  }

  /* restore a previous choice; absent one, the OS decides */
  try {
    var saved = localStorage.getItem('bs-shift');
    if (saved === 'dark' || saved === 'light') { root.setAttribute('data-theme', saved); }
  } catch (e) { /* private mode, blocked storage — OS preference stands */ }

  syncLabel();

  if (btn) {
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      var apply = function () {
        root.setAttribute('data-theme', next);
        syncLabel();
        try { localStorage.setItem('bs-shift', next); } catch (e) {}
      };

      if (reduce || !document.startViewTransition) { apply(); return; }

      var r = btn.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var far = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      /* The class scopes the root-animation override to this one
         transition, so page navigations keep their own cross-fade. */
      root.classList.add('theme-wipe');
      var vt = document.startViewTransition(apply);
      vt.ready.then(function () {
        root.animate(
          { clipPath: [
              'circle(0px at ' + x + 'px ' + y + 'px)',
              'circle(' + far + 'px at ' + x + 'px ' + y + 'px)'
          ] },
          {
            duration: 620,
            easing: 'cubic-bezier(.3,0,.2,1)',
            pseudoElement: '::view-transition-new(root)'
          }
        );
      }).catch(function () { /* transition unavailable — theme still applied */ });
      vt.finished
        .catch(function () {})
        .then(function () { root.classList.remove('theme-wipe'); });
    });
  }

  /* ---------------------------------------------------------
     2. Rotating role line
     Four lanes, one at a time, because listing them flat reads
     as indecision and listing one reads as narrower than true.
     Container is measured first so nothing on the page reflows.
     --------------------------------------------------------- */
  var rlist = document.getElementById('roleList');
  if (rlist && !reduce) {
    var roles = Array.prototype.slice.call(rlist.children);
    if (roles.length > 1) {
      var widest = 0;
      roles.forEach(function (el) { widest = Math.max(widest, el.offsetWidth); });
      rlist.classList.add('rotating');
      rlist.style.minWidth = (widest + 20) + 'px';
      var ri = 0;
      roles[0].classList.add('on');
      setInterval(function () {
        var cur = roles[ri];
        ri = (ri + 1) % roles.length;
        cur.classList.remove('on');
        cur.classList.add('out');
        roles[ri].classList.remove('out');
        roles[ri].classList.add('on');
        setTimeout(function () { cur.classList.remove('out'); }, 460);
      }, 2600);
    }
  }

  /* ---------------------------------------------------------
     3. The console
     Ordinary endpoint noise arriving in real time until one
     event is not ordinary, then a hold on the fired alert, then
     it starts over.

     It only ever runs when it is worth running: on screen, not
     hovered, not focused, tab in front, and not paused by hand.
     Anything else freezes it exactly where it is and it picks up
     from there — nothing restarts behind your back. Under
     reduced-motion the whole sequence prints at once and the
     controls come off, since there is nothing to pause.
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
  var HOLD = 9000;      /* time to read the alert before loop */

  if (con) {
    var cTimer = null;
    var cIndex = 0;
    var cPhase = 'lines';          /* lines -> alert -> hold   */
    var onScreen = false;
    var hovered = false;
    var byHand = false;            /* paused with the button   */

    var trim = function () {
      while (con.children.length > 10) { con.removeChild(con.firstChild); }
    };

    var addLine = function (row) {
      var d = document.createElement('div');
      d.className = 'ln fresh' + (row[2] ? ' hit' : '');
      d.textContent = row[0] + '  ' + row[1];
      con.appendChild(d);
      trim();
    };

    var addAlert = function () {
      var d = document.createElement('div');
      d.className = 'alertln';
      d.textContent = '▲  LEVEL 12  ·  rule 100210  ·  ' +
                      'Office application spawned PowerShell  ·  T1059.001';
      con.appendChild(d);
      trim();
    };

    var canRun = function () {
      return onScreen && !hovered && !byHand && !document.hidden;
    };

    var halt = function () { clearTimeout(cTimer); cTimer = null; };

    var step = function () {
      cTimer = null;
      if (!canRun()) { return; }

      if (cPhase === 'lines') {
        if (cIndex < FEED.length) {
          addLine(FEED[cIndex]);
          cIndex += 1;
          cTimer = setTimeout(step, cIndex >= FEED.length ? LAST_GAP : LINE_GAP);
          return;
        }
        cPhase = 'alert';
        cTimer = setTimeout(step, ALERT_GAP);
        return;
      }

      if (cPhase === 'alert') {
        addAlert();
        cPhase = 'hold';
        cTimer = setTimeout(step, HOLD);
        return;
      }

      /* hold is over — wipe and go again */
      con.textContent = '';
      cIndex = 0;
      cPhase = 'lines';
      cTimer = setTimeout(step, 320);
    };

    var resume = function () {
      if (cTimer || !canRun()) { return; }
      cTimer = setTimeout(step, 200);
    };

    /* Freeze or continue, whichever the current conditions call
       for. Called by every input that can change them. */
    var sync = function () {
      if (canRun()) { resume(); } else { halt(); }
    };

    var restart = function () {
      halt();
      con.textContent = '';
      cIndex = 0;
      cPhase = 'lines';
      sync();
    };

    var setByHand = function (state) {
      byHand = state;
      if (conPause) {
        conPause.textContent = state ? 'Resume' : 'Pause';
        conPause.setAttribute('aria-pressed', String(state));
      }
      sync();
    };

    if (reduce) {
      /* No motion: print the whole sequence once and drop the
         controls, because there is no longer anything to pause. */
      FEED.forEach(addLine);
      addAlert();
      var ctl = document.querySelector('.cctl');
      if (ctl) { ctl.hidden = true; }
    } else {
      con.textContent = '';

      if (conPause) {
        conPause.addEventListener('click', function () { setByHand(!byHand); });
      }
      if (conRestart) {
        conRestart.addEventListener('click', function () {
          if (byHand) { setByHand(false); }
          restart();
        });
      }

      /* Hover and keyboard focus hold it still so nobody loses
         the line they were reading. */
      con.addEventListener('mouseenter', function () { hovered = true; sync(); });
      con.addEventListener('mouseleave', function () { hovered = false; sync(); });
      con.addEventListener('focusin',   function () { hovered = true; sync(); });
      con.addEventListener('focusout',  function () { hovered = false; sync(); });

      /* A background tab should not be animating. */
      document.addEventListener('visibilitychange', sync);

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { onScreen = en.isIntersecting; });
          sync();
        }, { threshold: 0.2 }).observe(con);
      } else {
        onScreen = true;
        sync();
      }
    }
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
      panels.forEach(function (p, k) { p.classList.toggle('live', k === n); });
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
})();

/* ============================================================
   Incident responder prototype
   The hero scene is scroll-stepped; the guide only occupies the
   outer reading gutter on wide screens. PixelLab frames remain
   transparent sprite sheets, so no generated video is required.
   ============================================================ */
(function () {
  'use strict';

  var stage = document.getElementById('incidentStage');
  var guide = document.getElementById('responderGuide');
  var hero = document.querySelector('.hero');
  var work = document.getElementById('work');
  var terminal = document.getElementById('helloworld');
  var terminalBox = terminal && terminal.querySelector('.hwbox');
  var stageSprite = stage && stage.querySelector('.responder-sprite');
  var guideSprite = guide && guide.querySelector('.responder-sprite');
  var stageLabel = document.getElementById('incidentState');
  var guideLabel = guide && guide.querySelector('.guide-note');
  var reduced = window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!stage || !guide || !hero || !stageSprite || !guideSprite) { return; }

  var stageStates = {
    idle:    { motion: 'idle',    label: 'Monitoring' },
    alert:   { motion: 'alert',   label: 'Signal detected' },
    contain: { motion: 'contain', label: 'Containment active' },
    clear:   { motion: 'idle',    label: 'Threat contained' },
    exit:    { motion: 'walk',    label: 'Trace authorised' }
  };
  var currentStage = '';
  var currentGuide = '';
  var ticking = false;

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

  function setGuide(name, note) {
    if (currentGuide !== name) {
      currentGuide = name;
      guide.setAttribute('data-guide', name);
      setMotion(guideSprite, name);
    }
    if (guideLabel) { guideLabel.textContent = note; }
  }

  function placeGuide(zone) {
    var shell = Math.min(1160, window.innerWidth - 64);
    var gutter = Math.max(8, (window.innerWidth - shell) / 2 - 92);
    var x = window.innerWidth - 128 - gutter;
    var y = window.innerHeight - 156;

    if (zone === 'terminal' && terminalBox) {
      var box = terminalBox.getBoundingClientRect();
      x = Math.max(12, box.left - 112);
      y = Math.max(92, Math.min(window.innerHeight - 138, box.top + 12));
    }

    guide.style.setProperty('--guide-x', Math.round(x) + 'px');
    guide.style.setProperty('--guide-y', Math.round(y) + 'px');
  }

  function render() {
    ticking = false;
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var span = Math.max(460, hero.offsetHeight * 0.92);
    var progress = Math.max(0, Math.min(1, scrollY / span));

    if (reduced) {
      setStage('clear');
      guide.classList.remove('is-visible');
      return;
    }

    if (progress < 0.10) { setStage('idle'); }
    else if (progress < 0.28) { setStage('alert'); }
    else if (progress < 0.55) { setStage('contain'); }
    else if (progress < 0.76) { setStage('clear'); }
    else { setStage('exit'); }

    var terminalRect = terminal && terminal.getBoundingClientRect();
    var workRect = work && work.getBoundingClientRect();
    var terminalActive = terminalRect &&
      terminalRect.top < window.innerHeight * 0.74 && terminalRect.bottom > 80;
    var workActive = workRect &&
      workRect.top < window.innerHeight * 0.62 && workRect.bottom > window.innerHeight * 0.28;
    var journeyActive = progress >= 0.74 && (!terminalRect || terminalRect.bottom > 0);

    guide.classList.toggle('is-visible', journeyActive);
    if (!journeyActive) { return; }

    if (terminalActive) {
      setGuide('point', 'type help');
      placeGuide('terminal');
    } else if (workActive) {
      setGuide('scan', 'checking evidence');
      placeGuide('gutter');
    } else {
      setGuide('walk', 'following trace');
      placeGuide('gutter');
    }
  }

  function queueRender() {
    if (ticking) { return; }
    ticking = true;
    window.requestAnimationFrame(render);
  }

  window.addEventListener('scroll', queueRender, { passive: true });
  window.addEventListener('resize', queueRender);
  render();
})();

/* ============================================================
   Skim / Read, and the hello-world panel.
   Appended as a second IIFE so the first stays readable.
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
        setMode(b.dataset.mode);
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
     has several. Cycles on a timer, advances on click.
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
    var hTimer = null;
    var paused = false;
    var reduceMotion = window.matchMedia &&
                       window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (hwDots) {
      LINES.forEach(function () { hwDots.appendChild(document.createElement('i')); });
    }

    /* ---------------------------------------------------------
       The card. Always visible, always the same six lines.
       Typing never replaces it — it only pauses the cycle so the
       text does not change out from under someone mid-sentence.
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

    var startCycle = function () {
      clearInterval(hTimer);
      if (!reduceMotion && !paused) { hTimer = setInterval(advance, 7000); }
    };

    var setPaused = function (state) {
      paused = state;
      if (hwState) { hwState.hidden = !state; }
      startCycle();
    };

    paint(0);
    startCycle();

    if (hwNext) {
      hwNext.addEventListener('click', function () { advance(); startCycle(); });
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

      /* Focus pauses the card. Leaving an empty box resumes it.
         The card itself is never cleared. */
      hwInput.addEventListener('focus', function () { setPaused(true); });
      hwInput.addEventListener('blur', function () {
        if (!hwInput.value.trim()) { setPaused(false); }
      });

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
          setPaused(false);
          return;
        }

        var fn = COMMANDS[cmd];
        write(raw, fn ? fn()
                      : [['command not found: ' + cmd, 1],
                         ['Try help.']]);
      });
    }
  }
})();
