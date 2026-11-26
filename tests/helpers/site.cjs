// Builds the site into a scratch folder and serves it for one test run.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { root, build } = require('../../tools/site.cjs');

async function startSite(port) {
  const out = path.join(root, '.tmp', 'site-' + port);
  build(out);
  const server = spawn(process.execPath, [path.join(root, 'tools/serve.cjs'), out, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    server.stdout.once('data', resolve);
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Preview server exited ${code}`)));
  });
  return { url: `http://127.0.0.1:${port}`, dir: out, stop: () => server.kill() };
}

module.exports = { startSite };
