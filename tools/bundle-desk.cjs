// Rebuild the self-hosted Three.js scene after editing src/desk-scene.js.
const esbuild = require('esbuild');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
esbuild.buildSync({
  entryPoints: [path.join(root, 'src/desk-scene.js')],
  outfile: path.join(root, 'assets/desk/desk-scene.js'),
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2020'],
  legalComments: 'inline'
});
