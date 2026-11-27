// Usage: node tools/build.cjs [--out <dir>] [--no-verify]
const path = require('node:path');
const { root, build } = require('./site.cjs');

const args = process.argv.slice(2);
const at = args.indexOf('--out');
const out = path.resolve(root, at > -1 ? args[at + 1] : 'dist');
const pages = build(out);
if (!args.includes('--no-verify')) require('./verify.cjs').verify(out);
console.log(`Built ${pages.length} pages into ${path.relative(root, out) || '.'}/`);
