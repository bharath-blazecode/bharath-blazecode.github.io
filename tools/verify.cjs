// Static checks on the built site: links, metadata, safe markup, writing rules and the factual
// boundaries listed in the README. Run directly it builds into .tmp/verify first.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { root, origin, listPages, build } = require('./site.cjs');
const { checkWriting } = require('./check-writing.cjs');

function verify(dir) {
  const read = rel => fs.readFileSync(path.join(dir, rel), 'utf8');
  const routes = listPages();
  for (const expected of ['index.html', '404.html', 'work/homelab/index.html', 'work/classquest/index.html', 'work/luna/index.html', 'work/competitions/index.html']) {
    assert.ok(routes.includes(expected), 'Missing page ' + expected);
  }
  let checked = 0;

  for (const rel of routes) {
    const html = read(rel);
    assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, rel + ' must have one h1');
    assert.match(html, /<main id="main"/, rel + ' needs main#main');
    assert.match(html, /<html lang="en-AU"/);
    for (const tag of ['<meta name="description"', '<meta property="og:image"', '<meta name="twitter:image"', '<meta http-equiv="Content-Security-Policy"', '<meta name="referrer"', '<link rel="canonical"']) {
      assert.ok(html.includes(tag), `${rel} is missing ${tag}`);
    }
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate ids in ' + rel);

    // The Content-Security-Policy allows no inline styles or handlers, and nothing from other origins.
    const body = html.slice(html.indexOf('<body'));
    assert.doesNotMatch(body, /\sstyle="/, rel + ' has an inline style attribute');
    assert.doesNotMatch(body, /\son[a-z]+="/, rel + ' has an inline event handler');
    assert.doesNotMatch(html, /<(?:script|link|img|source|iframe)\b[^>]*\s(?:src|href|srcset)="https?:\/\/(?!bharath-blazecode\.github\.io)/, rel + ' loads something from another origin');
    assert.doesNotMatch(html, /fonts\.(?:googleapis|gstatic)/, rel + ' uses an external font service');

    const refs = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g)].map(match => match[1]);
    for (const set of html.matchAll(/\ssrcset="([^"]+)"/g)) refs.push(...set[1].split(',').map(part => part.trim().split(/\s+/)[0]));
    for (const ref of html.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)) refs.push(ref[2]);
    for (const ref of refs) {
      if (/^(?:https?:|mailto:|data:|#$)/.test(ref)) continue;
      const url = new URL(ref, 'https://local/' + rel.replace(/index\.html$/, ''));
      let file = path.join(dir, decodeURIComponent(url.pathname));
      assert.ok(fs.existsSync(file), `Missing ${ref} in ${rel}`);
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      if (url.hash && file.endsWith('.html')) {
        assert.ok(fs.readFileSync(file, 'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing fragment ${ref} in ${rel}`);
      }
      checked++;
    }
    for (const image of html.matchAll(/<img\b[^>]+>/g)) {
      assert.match(image[0], /\salt="[^"]*"/, 'Image without alt in ' + rel);
      assert.match(image[0], /\swidth="\d+"/, 'Image without width in ' + rel);
      assert.match(image[0], /\sheight="\d+"/, 'Image without height in ' + rel);
    }
  }

  const home = read('index.html');
  const lab = read('work/homelab/index.html');
  const quest = read('work/classquest/index.html');
  const luna = read('work/luna/index.html');
  const comps = read('work/competitions/index.html');

  // Light is the default theme; only a saved choice switches to dark.
  assert.doesNotMatch(home, /prefers-color-scheme:\s*dark/, 'The theme must not follow the operating system');
  assert.match(fs.readFileSync(path.join(root, 'js/theme.js'), 'utf8'), /getItem\('bs-shift'\) === 'dark'/);

  // Homepage facts.
  for (const fact of ['2027 internships and early-career roles', 'ubject to student visa conditions', 'Blue team, SOC, identity and access, GRC, IT automation', 'Cybersecurity and IT Automation Analyst', 'ScienceGears', 'expected December 2027', 'train in boxing', 'beginner on guitar', 'Tools in use', 'Identity and automation', 'Download resume (PDF)', 'effectiveness has not been independently established']) {
    assert.ok(home.includes(fact), 'Homepage is missing: ' + fact);
  }
  const research = (home.match(/<section class="section research"[\s\S]*?<\/section>/) || [''])[0];
  for (const fact of ['in progress', 'not a finding', 'large language models can analyse security evidence', 'the ASD Essentials', 'Helping design and evaluate experiments', 'Dr Gowri Sankar Ramachandran', 'Kat McCrabb of Flame Tree Cyber as external supervisor', 'Atticus D’Mello is the QUT contact']) {
    assert.ok(research.includes(fact), 'Research section is missing: ' + fact);
  }
  for (const fact of ['An illustration of the research question', 'Nothing here is a result or the output of a model']) {
    assert.ok(home.includes(fact), 'The explainer must stay labelled: ' + fact);
  }
  assert.doesNotMatch(research, /Essential Eight (?:framework|maturity)/i, 'The research is on the ASD Essentials, not the Essential Eight');
  assert.match(home, /Nov 2026 to present/);
  assert.match(home, /QUT’s 2026 to 2027 Vacation Research Experience Scheme/);
  assert.match(home, /The award belongs to the team/);
  assert.match(home, /with Zhirui Lu/);

  // Case studies.
  assert.match(lab, /Illustrative, not a recorded incident/);
  assert.match(lab, /Teaching example, not live telemetry/);
  assert.match(lab, /OpenSearch/);
  assert.ok(!/two seconds|real speed|Elasticsearch-based|Kibana-based/i.test(lab));
  assert.equal((lab.match(/data-flow-packet/g) || []).length, 3, 'Lab must contain three telemetry packets');
  assert.deepEqual([...lab.matchAll(/data-flow-step="(\d)"/g)].map(match => match[1]), ['1', '2', '3'], 'Telemetry packets must be ordered');
  assert.deepEqual([...lab.matchAll(/data-trace-step="(\d)"/g)].map(match => match[1]), ['1', '2', '3', '4', '5'], 'Illustrative trace must have five ordered rows');
  for (const number of [5, 11, 12, 14, 20, 21, 23, 24, 25, 26]) assert.ok(quest.includes(`/pull/${number}"`), 'Missing pull request ' + number);
  assert.match(luna, /Zhirui/);
  assert.match(luna, /vendor routine/);

  // Competition results are team results and every figure is pinned.
  const eventIds = [...comps.matchAll(/<section class="spine event" id="([a-z]+)"/g)].map(match => match[1]);
  assert.deepEqual(eventIds, ['downtime', 'byteme', 'csaw', 'holmes', 'hackathon', 'cimctf'], 'Scoreboard events are missing or out of order');
  const homeComps = (home.match(/<section class="section competitions"[\s\S]*?<\/section>/) || [''])[0];
  const board = (homeComps.match(/<ul class="scoreboard[\s\S]*?<\/ul>/) || [''])[0];
  const tileIds = [...board.matchAll(/href="work\/competitions\/#([a-z]+)"/g)].map(match => match[1]);
  assert.equal(tileIds.length, 4, 'The teaser shows four headline results');
  for (const id of tileIds) assert.ok(eventIds.includes(id), 'Teaser tile points at a missing event: ' + id);
  for (const fact of ['3rd', 'People’s Choice', '15 teams', '476th', '1,629', '1,097th', '5,637']) {
    assert.ok(board.includes(fact), 'Teaser is missing ' + fact);
    assert.ok(comps.includes(fact), 'Scoreboard is missing ' + fact);
  }
  assert.deepEqual(
    [...comps.matchAll(/<p class="event-result"><b>([^<]+)<\/b><span>([^<]+)<\/span>/g)].map(match => match[1] + ' | ' + match[2]),
    ['476th | of 1,629 ranked teams, 1,150 XP, Team SushiShield, with Alan Nguyen', '189th | of 530 teams, Team SushiShield', '1,097th | of 5,637 teams, 8 of 111 challenges, 825 points, Team SushiShield', 'Award | People’s Choice, 15 teams, ClassQuest', '3rd | place overall, Team SushiShield'],
    'Scoreboard result lines changed; check them against the event pages and certificates'
  );
  assert.ok(comps.includes('189th') && comps.includes('530 teams') && homeComps.includes('189th of 530'), 'CSAW result must match on both pages');
  assert.match(comps, /Alan Nguyen/);
  assert.match(comps, /Akira Hasuo/);
  assert.match(comps, /Every placement here is a team result/);
  assert.match(homeComps, /Placements are team results/);
  const byteme = (comps.match(/<section class="spine event" id="byteme"[\s\S]*?<\/section>/) || [''])[0];
  assert.match(byteme, /Certificate of participation/);
  assert.doesNotMatch(byteme, /\b\d[\d,]*(st|nd|rd|th)\b|\b(placed|ranked|ranking|finished)\b/i, 'ByteMe is a participation certificate with no placement');
  assert.match(homeComps, /ByteMe CTF participation/);
  assert.match(comps, /not a claim to have solved everything unaided/);
  assert.doesNotMatch((comps + homeComps).replace('not a claim to have solved everything unaided', ''), /unaided|on my own|solo\b|single-handed|flawless|perfect score/i, 'Competitions must not claim unaided or flawless work');
  assert.match(comps, /used AI tools as a guide/);
  assert.match(read('404.html'), /<meta name="robots" content="noindex">/);

  // Scripts never build markup from strings or evaluate text.
  for (const name of fs.readdirSync(path.join(root, 'js'))) {
    const script = fs.readFileSync(path.join(root, 'js', name), 'utf8');
    assert.ok(!/\beval\s*\(|new Function|\.innerHTML\s*=|insertAdjacentHTML|document\.write/.test(script), 'Unsafe rendering primitive in js/' + name);
    assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/, 'js/' + name + ' must not make network requests');
  }
  const terminal = fs.readFileSync(path.join(root, 'js/terminal.js'), 'utf8');
  assert.match(terminal, /Nothing executes and nothing leaves this page/);

  // The published folder holds only the site.
  assert.ok(!fs.existsSync(path.join(dir, 'past looks')), 'past looks must not be published');
  for (const file of ['llms.txt', 'robots.txt', 'sitemap.xml', 'resume/Barry_Sampath_Resume.pdf']) assert.ok(fs.existsSync(path.join(dir, file)), 'Missing ' + file);
  JSON.parse(fs.readFileSync(path.join(root, 'src/data/person.json'), 'utf8'));
  assert.ok(read('sitemap.xml').includes(origin + '/work/homelab/'));

  const writing = checkWriting(dir);
  for (const line of writing.warnings) console.log('warn  ' + line);
  assert.equal(writing.errors.length, 0, 'Writing rules:\n' + writing.errors.join('\n'));

  console.log(`PASS: ${routes.length} pages, ${checked} local resources and fragments, metadata, safe markup, writing rules and factual boundaries.`);
}

module.exports = { verify };

if (require.main === module) {
  const out = path.join(root, '.tmp', 'verify');
  build(out);
  verify(out);
}
