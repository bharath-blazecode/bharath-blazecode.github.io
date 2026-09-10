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
     event is not ordinary. Starts when scrolled into view,
     runs once, replays on request. Under reduced-motion the
     whole sequence is printed at once.
     --------------------------------------------------------- */
  var con = document.getElementById('console');
  var replay = document.getElementById('replay');

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

  var timer = null;

  function trim() {
    while (con.children.length > 10) { con.removeChild(con.firstChild); }
  }

  function addLine(row) {
    var d = document.createElement('div');
    d.className = 'ln fresh' + (row[2] ? ' hit' : '');
    d.textContent = row[0] + '  ' + row[1];
    con.appendChild(d);
    trim();
  }

  function addAlert() {
    var d = document.createElement('div');
    d.className = 'alertln';
    d.textContent = '▲  LEVEL 12  ·  rule 100210  ·  ' +
                    'Office application spawned PowerShell  ·  T1059.001';
    con.appendChild(d);
    trim();
  }

  function runConsole() {
    if (!con) { return; }
    clearTimeout(timer);
    con.textContent = '';
    if (reduce) {
      FEED.forEach(addLine);
      addAlert();
      return;
    }
    var i = 0;
    (function step() {
      if (i >= FEED.length) { timer = setTimeout(addAlert, 430); return; }
      addLine(FEED[i]);
      i += 1;
      timer = setTimeout(step, i >= FEED.length - 1 ? 920 : 560);
    })();
  }

  if (con) {
    if (replay) { replay.addEventListener('click', runConsole); }
    if ('IntersectionObserver' in window) {
      var started = false;
      new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting && !started) { started = true; runConsole(); }
        });
      }, { threshold: 0.2 }).observe(con);
    } else {
      runConsole();
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
   Skim / Read, and the hello-world panel.
   Appended as a second IIFE so the first stays readable.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;

  /* ---------------------------------------------------------
     Skim mode
     Read is the default, so nothing is ever hidden without a
     deliberate choice — and with JavaScript off the control
     is not rendered at all, which is the correct fallback.
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
    var startMode = 'read';
    try { startMode = localStorage.getItem('bs-mode') || 'read'; } catch (e) {}
    setMode(startMode);
    modeBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        setMode(b.dataset.mode);
        try { localStorage.setItem('bs-mode', b.dataset.mode); } catch (e) {}
      });
    });
  }

  /* ---------------------------------------------------------
     hello, world
     Every field has a first line everyone recognises. Security
     has several. Cycles on a timer, advances on click.
     --------------------------------------------------------- */
  var LINES = [
    {
      cmd: 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
      raw: true,
      gloss: 'The EICAR test string. Sixty-eight harmless characters that every antivirus on earth agrees to flag, so you can prove your scanner works without touching real malware. This is the closest thing security has to Hello World.'
    },
    {
      cmd: 'nmap -sV scanme.nmap.org',
      gloss: 'Everyone’s first scan, run against the one host on the internet that explicitly asks to be scanned. Point it anywhere else without permission and the lesson changes.'
    },
    {
      cmd: "' OR '1'='1",
      raw: true,
      gloss: 'The first thing anybody learns to break, and the reason parameterised queries exist. Still turning up in production in 2026.'
    },
    {
      cmd: 'whoami',
      gloss: 'The first command after you land somewhere. Also the first thing a detection rule should notice you running.'
    },
    {
      cmd: 'It depends.',
      raw: true,
      gloss: 'The technically correct answer to almost every GRC question, and the reason the follow-up is always "on what?".'
    },
    {
      cmd: 'Have you tried turning MFA on?',
      raw: true,
      gloss: 'Unglamorous, unfashionable, and still the single control that removes most of the incidents you would otherwise be writing up.'
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
                 'touches your machine — this is a static page and it has no idea ' +
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
        return [['barry', 1],
                ['Bharath Sampath. QUT cybersecurity and AI student in Brisbane. ' +
                 'Also the first command anyone runs after landing on a box, ' +
                 'and one a decent detection rule notices.']];
      },
      nmap: function () {
        return [['nmap -sV scanme.nmap.org', 1],
                ['Everyone’s first scan, against the one host on the internet ' +
                 'that explicitly asks to be scanned. Point it anywhere else ' +
                 'without permission and the lesson changes.']];
      },
      eicar: function () {
        return [[EICAR, 1],
                ['Sixty-eight harmless characters that every antivirus on earth ' +
                 'agrees to flag, so you can prove your scanner works without ' +
                 'touching real malware. The closest thing security has to Hello World.']];
      },
      sqli: function () {
        return [["' OR '1'='1", 1],
                ['The first thing anybody learns to break, and the reason ' +
                 'parameterised queries exist. Still turning up in production in 2026.']];
      },
      xss: function () {
        return [['<script>alert(1)</script>', 1],
                ['And the second. This one is printed as text, which is exactly ' +
                 'the fix.']];
      },
      grc: function () {
        return [['It depends.', 1],
                ['The technically correct answer to almost every GRC question. ' +
                 'The follow-up is always “on what?”, and that is where ' +
                 'the actual work is.']];
      },
      mfa: function () {
        return [['Have you tried turning MFA on?', 1],
                ['Unglamorous, unfashionable, and still the single control that ' +
                 'removes most of the incidents you would otherwise be writing up.']];
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
