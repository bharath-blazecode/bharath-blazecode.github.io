// Tests for the simulated terminal. Run: node tests/terminal.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { startSite } = require('./helpers/site.cjs');

const root = path.resolve(__dirname, '..');
const rev = s => [...s].reverse().join('');

function staticChecks() {
  const names = ['js/terminal.js', 'js/terminal-data.js', 'css/terminal.css', 'tests/terminal.cjs'];
  const banned = ['evled', 'sselmaes', 'egarevel', 'tsubor', 'etavele', 'yrtsepat', 'ynomitset', 'yenruoj', 'detfarc', 'etanoissap', 'egde-gnittuc', 'rehcnahc-emag', 'kcolnu', 'rewopme', 'suluciteM', 'esacwohs'].map(rev);
  for (const name of names) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    assert.ok(!/[\u2013\u2014\u2192\u2190\u00b7\u2026\u2713\u2714\u2022]|\p{Extended_Pictographic}/u.test(text), `${name} has decorative characters`);
    for (const word of banned) assert.ok(!new RegExp(`\\b${word.replace('-', '[- ]')}`, 'i').test(text), `${name} uses a banned word`);
    if (name.startsWith('js/')) {
      assert.ok(!/\.innerHTML\s*=|\beval\s*\(|new Function|localStorage|document\.cookie|fetch\(|XMLHttpRequest|style="/.test(text), `${name} uses an unsafe primitive`);
    }
  }
  const size = ['js/terminal.js', 'js/terminal-data.js'].reduce((n, f) => n + zlib.gzipSync(fs.readFileSync(path.join(root, f)), { level: 9 }).length, 0);
  assert.ok(size < 15 * 1024, `terminal js is ${size} bytes gzipped`);
  return size;
}

function luminance(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

(async () => {
  const gzip = staticChecks();
  for (const fg of ['#eef0e6', '#a9b2a2', '#dde84a', '#9fc3b0', '#ff9d8a']) assert.ok(ratio(fg, '#161b16') >= 4.5, `${fg} fails AA on #161b16`);
  assert.ok(ratio('#161b16', '#dde84a') >= 4.5, 'match highlight fails AA');
  assert.ok(ratio('#a9b2a2', '#1d241d') >= 4.5, 'dim text fails AA on the title bar');

  const site = await startSite(48771);
  const origin = new URL(site.url).origin;
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const problems = [];
  const foreign = [];

  async function fresh(options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...options });
    const page = await context.newPage();
    page.on('console', m => { if (m.type() === 'error') problems.push(m.text()); });
    page.on('pageerror', e => problems.push(e.message));
    page.on('dialog', d => { problems.push('unexpected dialog ' + d.message()); d.dismiss(); });
    page.on('request', r => { if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) foreign.push(r.url()); });
    await page.goto(site.url + '/');
    return { context, page };
  }

  const input = page => page.locator('#term-input');
  async function open(page) {
    await page.locator('[data-terminal-open]').click();
    await page.locator('dialog.term[open]').waitFor();
    await page.waitForTimeout(260);
  }
  async function run(page, command) {
    const before = await page.locator('.term-out').count();
    await input(page).fill(command);
    await input(page).press('Enter');
    return page.evaluate(n => [...document.querySelectorAll('.term-out')].slice(n + 1).map(e => e.textContent).join('\n'), before);
  }
  const logText = page => page.locator('.term-log').innerText();
  const promptText = page => page.locator('.term-prompt').textContent();

  try {
    // Opening, closing and focus
    {
      const { context, page } = await fresh();
      const button = page.locator('[data-terminal-open]');
      await button.click();
      await page.locator('dialog.term[open]').waitFor();
      assert.equal(await page.locator('link[rel=stylesheet][href$="css/terminal.css"]').count(), 1, 'stylesheet link missing');
      await page.waitForTimeout(260);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'term-input', 'input is not focused on open');
      const first = await logText(page);
      assert.match(first, /help/); assert.match(first, /\bls\b/); assert.match(first, /cat README\.md/);
      assert.ok(await page.getByText('sandboxed in your browser. Nothing executes and nothing leaves this page.').isVisible(), 'honest line not visible');
      assert.equal(await page.locator('.term-log').getAttribute('role'), 'log');
      assert.equal(await page.locator('.term-log').getAttribute('aria-live'), 'polite');
      assert.equal(await page.locator('label[for=term-input]').count(), 1, 'input label missing');
      assert.ok(await page.locator('dialog.term').getByRole('button', { name: 'Close' }).isVisible(), 'Close button not visible');
      assert.equal(await page.locator('dialog.term').getAttribute('aria-label'), 'Terminal');
      assert.match(await promptText(page), /barry@field-notes:~\$/);

      await page.keyboard.press('Escape');
      await page.waitForFunction(() => !document.querySelector('dialog.term').open);
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-terminal-open')), true, 'focus did not return after Escape');

      // Backtick opens, and typed inside the terminal it is just a character
      await page.keyboard.press('`');
      await page.locator('dialog.term[open]').waitFor();
      await input(page).press('`');
      await input(page).pressSequentially('a`b');
      assert.equal(await input(page).inputValue(), '`a`b');
      assert.equal(await page.locator('dialog.term').count(), 1);
      assert.equal(await page.locator('dialog.term[open]').count(), 1, 'backtick in input closed the terminal');
      await input(page).fill('');

      assert.equal((await run(page, 'exit')), '');
      await page.waitForFunction(() => !document.querySelector('dialog.term').open);
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-terminal-open')), true, 'focus did not return after exit');
      await page.locator('[data-terminal-open]').focus();
      await page.keyboard.press('Enter');
      await page.locator('dialog.term[open]').waitFor();
      await page.locator('dialog.term').getByRole('button', { name: 'Close' }).click();
      await page.waitForFunction(() => !document.querySelector('dialog.term').open);
      assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-terminal-open')), true, 'focus did not return after Close');
      await context.close();
    }

    // Commands, pipes, errors, refusals
    {
      const { context, page } = await fresh();
      await open(page);

      let out = await run(page, 'ls');
      for (const n of ['about', 'contact', 'experience', 'logs', 'README.md', 'research', 'resume.pdf', 'work']) assert.match(out, new RegExp(n));
      assert.match(await run(page, 'ls -a'), /\.\.\s/);
      out = await run(page, 'ls -l');
      assert.match(out, /total/); assert.match(out, /drwxr-xr-x/); assert.match(out, /-rw-r--r--.*README\.md/);
      assert.match(await run(page, 'ls -la work'), /homelab/);
      assert.match(await run(page, 'ls work logs'), /work:|logs:/);
      assert.equal((await run(page, 'ls | wc -l')).trim(), '8');
      assert.equal((await run(page, 'ls | head -n 3')).split('\n').length, 3);

      assert.equal(await run(page, 'pwd'), '/home/barry');
      await run(page, 'cd work');
      assert.match(await promptText(page), /barry@field-notes:~\/work\$/);
      assert.match(await page.locator('.term-title').textContent(), /barry@field-notes: ~\/work/);
      assert.equal(await run(page, 'pwd'), '/home/barry/work');
      assert.match(await run(page, 'ls'), /classquest\s+competitions/);
      await run(page, 'cd homelab');
      assert.match(await run(page, 'cat README.md'), /ITDR Home Lab/);
      assert.match(await run(page, 'cat status.txt'), /Phase 1 complete/);
      assert.equal(await run(page, 'cd ..'), '');
      assert.equal(await run(page, 'pwd'), '/home/barry/work');
      assert.equal(await run(page, 'cd -'), '/home/barry/work/homelab');
      await run(page, 'cd ~');
      assert.equal(await run(page, 'pwd'), '/home/barry');
      await run(page, 'cd /home/barry/logs');
      assert.equal(await run(page, 'pwd'), '/home/barry/logs');
      await run(page, 'cd');
      await run(page, 'cd work/classquest');
      assert.equal(await run(page, 'pwd'), '/home/barry/work/classquest');
      await run(page, 'cd ../../..');
      assert.equal(await run(page, 'pwd'), '/home');
      await run(page, 'cd');

      out = await run(page, 'cat about/education.txt about/tools.txt');
      assert.match(out, /GPA 6\.09/); assert.match(out, /Wazuh, Sysmon, Linux, VMware/);
      assert.match(await run(page, 'cat README.md'), /simulated shell/);
      assert.match(await run(page, 'cat experience/sciencegears.txt'), /Cybersecurity and IT Automation Analyst/);
      out = await run(page, 'cat work/competitions/results.txt');
      assert.match(out, /476th of 1,629 ranked teams/); assert.match(out, /1,097th of 5,637 teams/); assert.match(out, /3rd place overall, Team SushiShield/);
      assert.match(await run(page, 'cat research/question.txt'), /no results yet/);
      assert.match(await run(page, 'cat work/luna/my-part.txt'), /Zhirui Lu/);
      assert.match(await run(page, 'cat contact/email.txt'), /barry\.sampath@outlook\.com/);
      assert.match(await run(page, 'cat experience/co*.txt | head -n 1'), /Engagement Officer/);

      out = await run(page, 'tree');
      assert.match(out, /\|-- about/); assert.match(out, /`-- work/); assert.match(out, /\d+ directories, \d+ files/);
      assert.match(await run(page, 'tree work/luna'), /my-part\.txt/);

      // The log files and the story they tell
      for (const f of ['README.txt', 'sysmon-process.log', 'sysmon-network.log', 'wazuh-alerts.log']) {
        assert.match(await run(page, `head -n 1 logs/${f}`), /^# Illustrative events written for this site\. Not recorded telemetry\.$/, f);
      }
      out = await run(page, 'grep WINWORD logs/sysmon-process.log');
      assert.match(out, /EventID=1/); assert.match(out, /ParentImage="[^"]*WINWORD\.EXE"/); assert.match(out, /powershell\.exe/);
      assert.match(out, /LAB\\student/); assert.match(out, /win11-lab/); assert.match(out, /UtcTime=/); assert.match(out, /CommandLine=/);
      assert.match(await run(page, 'grep -i -- -enc logs/sysmon-process.log'), /-nop -w hidden -enc/);
      assert.equal(await run(page, 'grep -c EventID=1 logs/sysmon-process.log'), '3');
      assert.match(await run(page, 'grep -n powershell logs/sysmon-process.log'), /^\d+:UtcTime=.*powershell/m);
      assert.equal((await run(page, 'grep -v "^#" logs/wazuh-alerts.log | wc -l')).trim(), '3');
      assert.match(await run(page, 'grep -i RULE logs/wazuh-alerts.log'), /Rule: 100210 \(level 12\)/);
      assert.match(await run(page, 'cat logs/sysmon-network.log | grep 192.168.56.20'), /EventID=3.*DestinationPort=8080/);
      assert.match(await run(page, 'tail -n 2 logs/wazuh-alerts.log'), /Event 3: Network connection/);
      assert.equal((await run(page, 'head -n 2 logs/sysmon-process.log')).split('\n').length, 2);
      assert.equal((await run(page, 'head -3 logs/sysmon-process.log')).split('\n').length, 3);
      assert.equal((await run(page, 'tail logs/sysmon-process.log')).split('\n').length, 5);
      assert.match(await run(page, 'head -n 1 logs/*.log'), /==> logs\/sysmon-network\.log <==/);
      assert.match(await run(page, 'grep -r Zhirui .'), /work\/luna\/README\.md:/);
      assert.match(await run(page, 'grep -c Zhirui work/luna/*'), /work\/luna\/my-part\.txt:\d/);
      assert.equal(await run(page, 'grep zzzz README.md'), '');
      assert.equal((await run(page, 'cat README.md | wc -l')).trim(), (await run(page, 'wc -l README.md')).split(' ')[0]);

      out = await run(page, 'find . -name "*.txt"');
      assert.match(out, /^\.\/logs\/README\.txt$/m); assert.match(out, /^\.\/experience\/sciencegears\.txt$/m); assert.doesNotMatch(out, /README\.md/);
      assert.match(await run(page, 'find work -type d'), /^work\/homelab$/m);

      assert.equal(await run(page, 'echo hello world'), 'hello world');
      assert.equal(await run(page, 'echo "a  b"'), 'a  b');
      assert.equal(await run(page, 'echo $USER'), 'barry');
      assert.equal(await run(page, 'whoami'), 'barry');
      assert.match(await run(page, 'uname -a'), /^Linux field-notes/);
      assert.match(await run(page, 'date'), /\d{4}/);
      assert.equal(await run(page, 'cd work && pwd'), '/home/barry/work');
      await run(page, 'cd');
      assert.equal(await run(page, 'cd nope && pwd'), 'bash: cd: nope: No such file or directory');
      assert.equal(await run(page, 'echo a; echo b'), 'a\nb');
      out = await run(page, 'history');
      assert.match(out, /^\s+1\s+ls$/m); assert.match(out, /history$/m);
      out = await run(page, 'man grep');
      assert.match(out, /NAME/); assert.match(out, /SYNOPSIS/); assert.match(out, /-i ignores case/);
      assert.equal(await run(page, 'man foo'), 'No manual entry for foo');
      out = await run(page, 'help');
      assert.match(out, /^ls {7}list directory contents$/m); assert.match(out, /^open {5}go to a page on the site$/m);
      assert.match(out, /Tab/); assert.match(out, /Up and Down/); assert.match(out, /Ctrl\+L/); assert.match(out, /Esc/);
      for (const c of ['ls', 'cd', 'pwd', 'cat', 'tree', 'grep', 'find', 'head', 'tail', 'echo', 'whoami', 'history', 'clear', 'man', 'help', 'open', 'exit', 'wc']) assert.match(out, new RegExp(`^${c} `, 'm'), `help lacks ${c}`);

      // Errors in bash wording
      assert.equal(await run(page, 'foo'), 'bash: foo: command not found');
      assert.equal(await run(page, 'cat nope'), 'cat: nope: No such file or directory');
      assert.equal(await run(page, 'cd logs/sysmon-process.log'), 'bash: cd: logs/sysmon-process.log: Not a directory');
      assert.equal(await run(page, 'cat work'), 'cat: work: Is a directory');
      assert.equal(await run(page, 'ls nope'), "ls: cannot access 'nope': No such file or directory");
      assert.equal(await run(page, 'cd nope'), 'bash: cd: nope: No such file or directory');
      assert.equal(await run(page, 'grep x nope'), 'grep: nope: No such file or directory');
      assert.equal(await run(page, 'ls -z'), "ls: invalid option -- 'z'");
      assert.equal(await run(page, 'open nope'), 'open: nope: No such file or directory');
      assert.match(await run(page, 'echo "oops'), /unexpected EOF/);
      assert.match(await run(page, 'ls |'), /syntax error/);
      assert.ok(await page.locator('.term-out .t-e').count() > 0, 'errors are not styled');

      // Refusals
      for (const c of ['nmap 192.168.56.1', 'ssh root@host', 'sudo ls', 'curl example.com', 'wget example.com', 'nc -l 4444', 'rm -rf /', 'ping 8.8.8.8']) {
        const text = await run(page, c);
        assert.match(text, /not run/); assert.match(text, /Nothing was run\./); assert.ok(text.startsWith(c.split(' ')[0] + ':'), c);
      }
      assert.match(await run(page, 'nmap x'), /permission/);

      // Ctrl+L and Ctrl+C
      await input(page).fill('half typed');
      await input(page).press('Control+c');
      assert.equal(await input(page).inputValue(), '');
      assert.match(await logText(page), /half typed\^C/);
      await input(page).press('Control+l');
      assert.equal(await page.locator('.term-out').count(), 0, 'Ctrl+L did not clear');
      await run(page, 'echo again');
      await run(page, 'clear');
      assert.equal(await page.locator('.term-out').count(), 0, 'clear did not clear');
      await context.close();
    }

    // Tab completion and history
    {
      const { context, page } = await fresh();
      await open(page);
      const tab = async text => { await input(page).fill(text); await input(page).press('Tab'); return input(page).inputValue(); };
      assert.equal(await tab('cat REA'), 'cat README.md ');
      assert.equal(await tab('cd wo'), 'cd work/');
      assert.equal(await tab('hist'), 'history ');
      assert.equal(await tab('cd work/h'), 'cd work/homelab/');
      assert.equal(await tab('ls ~/ex'), 'ls ~/experience/');
      assert.equal(await tab('cat logs/s'), 'cat logs/sysmon-');
      assert.equal(await tab('cat README.md | gr'), 'cat README.md | grep ');
      assert.equal(await tab('cd res'), 'cd research/');
      await input(page).fill('c');
      await input(page).press('Tab');
      assert.doesNotMatch(await logText(page), /\bclear\b/, 'first Tab listed matches');
      await input(page).press('Tab');
      assert.match(await logText(page), /cat\s+cd\s+chmod/, 'second Tab did not list matches');
      assert.equal(await input(page).inputValue(), 'c');
      await input(page).fill('cat ');
      await input(page).press('Tab'); await input(page).press('Tab');
      assert.match(await logText(page), /README\.md\s+research\/\s+resume\.pdf/);

      await input(page).fill('');
      await run(page, 'pwd'); await run(page, 'whoami');
      await input(page).fill('draft');
      await input(page).press('ArrowUp');
      assert.equal(await input(page).inputValue(), 'whoami');
      await input(page).press('ArrowUp');
      assert.equal(await input(page).inputValue(), 'pwd');
      await input(page).press('ArrowUp');
      assert.equal(await input(page).inputValue(), 'pwd');
      await input(page).press('ArrowDown');
      assert.equal(await input(page).inputValue(), 'whoami');
      await input(page).press('ArrowDown');
      assert.equal(await input(page).inputValue(), 'draft');
      await context.close();
    }

    // Chips, open, and safe rendering
    {
      const { context, page } = await fresh();
      await open(page);
      assert.deepEqual(await page.locator('.term-chip').allTextContents(), ['help', 'ls', 'cat README.md', 'cd logs', 'clear']);
      for (const h of await page.locator('.term-chip').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))) assert.ok(h >= 44, 'chip under 44px');
      await page.locator('.term-chip', { hasText: 'cd logs' }).click();
      assert.match(await promptText(page), /~\/logs\$/);

      assert.equal(await run(page, 'echo <img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>');
      assert.equal(await run(page, 'echo "<b>bold</b> <script>1</script>"'), '<b>bold</b> <script>1</script>');
      assert.equal(await page.locator('dialog.term img, dialog.term b, dialog.term script').count(), 0, 'visitor input created elements');
      await page.waitForTimeout(200);

      await run(page, 'cd');
      const nav = page.waitForURL(/\/work\/homelab\/$/);
      await run(page, 'open work/homelab');
      await nav;
      await context.close();
    }
    {
      const { context, page } = await fresh();
      await open(page);
      assert.match(await run(page, 'cat experience/qut-research.txt'), /^AI Cyber Risk Assessment Research/);
      assert.match(await run(page, 'cat research/question.txt'), /^AI Cyber Risk Assessment Research/);
      await run(page, 'cd');
      const nav = page.waitForURL(/\/research\/$/);
      await run(page, 'open ~/research');
      await nav;
      await context.close();
    }
    {
      const { context, page } = await fresh();
      await open(page);
      await run(page, 'open about');
      await page.waitForURL(/#about$/);
      await page.waitForFunction(() => !document.querySelector('dialog.term').open);
      await page.locator('[data-terminal-open]').click();
      await page.locator('dialog.term[open]').waitFor();
      const req = page.waitForRequest(r => r.url().endsWith('resume/Barry_Sampath_Resume.pdf'));
      await run(page, 'open resume.pdf');
      await req;
      await context.close();
    }

    // Accessibility scan of the open dialog
    {
      const { context, page } = await fresh();
      await open(page);
      await run(page, 'ls -l'); await run(page, 'grep -n WINWORD logs/sysmon-process.log'); await run(page, 'foo'); await run(page, 'tree');
      await page.waitForTimeout(250);
      await page.evaluate(fs.readFileSync(path.join(root, 'node_modules/axe-core/axe.min.js'), 'utf8'));
      const result = await page.evaluate(() => axe.run(document.querySelector('dialog.term'), { resultTypes: ['violations'] }));
      assert.deepEqual(result.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`), [], 'axe violations');
      const look = await page.evaluate(() => {
        const q = s => getComputedStyle(document.querySelector(s));
        return { bg: q('dialog.term').backgroundColor, fg: q('.term-log').color, font: q('.term-log').fontFamily, border: q('dialog.term').borderTopColor, width: document.querySelector('dialog.term').getBoundingClientRect().width };
      });
      assert.equal(look.bg, 'rgb(22, 27, 22)'); assert.equal(look.fg, 'rgb(238, 240, 230)'); assert.equal(look.border, 'rgb(74, 88, 74)');
      assert.match(look.font, /Cascadia Mono|Consolas|monospace/); assert.ok(look.width <= 920);
      await context.close();
    }

    // Dark site theme gives the same terminal
    {
      const { context, page } = await fresh({ colorScheme: 'dark' });
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      await open(page);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('dialog.term')).backgroundColor), 'rgb(22, 27, 22)');
      await context.close();
    }

    // Reduced motion
    {
      const { context, page } = await fresh({ reducedMotion: 'reduce' });
      await page.locator('[data-terminal-open]').click();
      await page.locator('dialog.term[open]').waitFor();
      const style = await page.evaluate(() => {
        const d = document.querySelector('dialog.term');
        return { opacity: getComputedStyle(d).opacity, time: getComputedStyle(d).transitionDuration, blink: getComputedStyle(document.querySelector('.term-caret'), '::after').animationName };
      });
      assert.equal(style.opacity, '1'); assert.ok(parseFloat(style.time) < 0.001, 'transition not skipped'); assert.equal(style.blink, 'none');
      await context.close();
    }
    {
      const { context, page } = await fresh({ reducedMotion: 'no-preference' });
      await open(page);
      const style = await page.evaluate(() => ({ time: getComputedStyle(document.querySelector('dialog.term')).transitionDuration, blink: getComputedStyle(document.querySelector('.term-caret'), '::after').animationName }));
      assert.equal(style.time, '0.2s, 0.2s'); assert.equal(style.blink, 'term-blink');
      await context.close();
    }

    // Phone: 390 by 844
    {
      const { context, page } = await fresh({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      await page.evaluate(() => document.querySelector('[data-terminal-open]').click());
      await page.locator('dialog.term[open]').waitFor();
      await page.waitForTimeout(260);
      const m = await page.evaluate(() => {
        const d = document.querySelector('dialog.term');
        const r = d.getBoundingClientRect();
        const inside = [...d.querySelectorAll('.term-bar, .term-log, .term-row, .term-note, .term-close')].map(e => e.getBoundingClientRect());
        return {
          w: r.width, h: r.height, overflow: d.scrollWidth - d.clientWidth,
          input: parseFloat(getComputedStyle(document.querySelector('#term-input')).fontSize),
          chips: [...document.querySelectorAll('.term-chip')].map(e => e.getBoundingClientRect().height),
          closeH: document.querySelector('.term-close').getBoundingClientRect().height,
          within: inside.every(b => b.left >= -0.5 && b.right <= innerWidth + 0.5 && b.bottom <= innerHeight + 0.5),
          hasVar: d.style.getPropertyValue('--term-h')
        };
      });
      assert.ok(Math.abs(m.w - 390) <= 1 && m.h >= 843, 'not a full-screen sheet');
      assert.ok(m.overflow <= 0, 'horizontal overflow in the dialog'); assert.ok(m.within, 'content leaves the viewport');
      assert.ok(m.input >= 16, 'input font under 16px'); assert.ok(m.chips.every(h => h >= 44), 'chips under 44px'); assert.ok(m.closeH >= 44);
      assert.ok(m.hasVar.endsWith('px'), 'visualViewport height not applied');
      assert.ok(await page.getByText('sandboxed in your browser. Nothing executes and nothing leaves this page.').isVisible());
      await run(page, 'tree');
      await run(page, 'cat work/competitions/results.txt');
      assert.ok(await page.evaluate(() => { const d = document.querySelector('dialog.term'); const l = document.querySelector('.term-log'); return d.scrollWidth <= d.clientWidth && l.scrollWidth <= l.clientWidth; }), 'long lines overflow');
      await page.locator('.term-chip', { hasText: 'ls' }).first().tap();
      await context.close();
    }

    assert.deepEqual(problems, [], 'console or page errors');
    assert.deepEqual(foreign, [], 'requests to other origins');
    console.log(`PASS: terminal opens, runs every command, completes, refuses safely, stays accessible on desktop and a 390px phone (${gzip} bytes gzipped).`);
  } finally {
    await browser.close();
    site.stop();
  }
})().catch(error => { console.error(error); process.exit(1); });
