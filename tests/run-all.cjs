// Usage: node tests/run-all.cjs [suite name ...]
// Names are the file names without the folder or extension, for example "browser" or "verify".
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const SUITES = [
  'tools/verify.cjs', 'tests/writing.cjs', 'tests/browser.cjs', 'tests/home.cjs', 'tests/desk.cjs',
  'tests/terminal.cjs', 'tests/explainer.cjs', 'tests/homelab.cjs', 'tests/classquest.cjs', 'tests/mobile.cjs'
].map(file => ({ file, name: path.basename(file, '.cjs') }));

const wanted = process.argv.slice(2).map(name => path.basename(name, '.cjs'));
const unknown = wanted.filter(name => !SUITES.some(suite => suite.name === name));
if (unknown.length) {
  console.error(`Unknown suite: ${unknown.join(', ')}. Known suites: ${SUITES.map(suite => suite.name).join(', ')}`);
  process.exit(2);
}

const results = [];
for (const suite of SUITES) {
  if (wanted.length && !wanted.includes(suite.name)) continue;
  const full = path.join(root, suite.file);
  if (!fs.existsSync(full)) {
    console.log(`\nSKIP ${suite.name}: ${suite.file} does not exist`);
    results.push({ name: suite.name, status: 'skipped', seconds: 0 });
    continue;
  }
  console.log(`\n=== ${suite.name} ===`);
  const started = Date.now();
  const run = spawnSync(process.execPath, [full], { cwd: root, stdio: 'inherit' });
  results.push({ name: suite.name, status: run.status === 0 ? 'pass' : 'fail', seconds: (Date.now() - started) / 1000 });
}

const width = Math.max(5, ...results.map(result => result.name.length));
console.log('\nSummary');
console.log(`${'Suite'.padEnd(width)}  Result   Seconds`);
for (const result of results) console.log(`${result.name.padEnd(width)}  ${result.status.padEnd(7)}  ${result.seconds.toFixed(1)}`);
const failed = results.filter(result => result.status === 'fail');
console.log(failed.length ? `\n${failed.length} suite(s) failed: ${failed.map(result => result.name).join(', ')}` : '\nAll suites that ran passed.');
process.exit(failed.length ? 1 : 0);
