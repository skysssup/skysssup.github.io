// Rebuild demo/shipgate-core.mjs from a Shipgate checkout:
//   SHIPGATE_REPO=/path/to/shipgate node demo/build-core-bundle.mjs
// Uses the esbuild that the Shipgate workspace already installs (via Vite).
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(process.env.SHIPGATE_REPO ?? join(here, '../../../src/shipgate'));
const esbuild = createRequire(join(repo, 'package.json'))('esbuild');

const result = await esbuild.build({
  entryPoints: [join(here, 'src/shipgate-diff.ts')],
  outfile: join(here, 'shipgate-core.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  metafile: true,
  alias: { '@shipgate/core/browser': join(repo, 'packages/core/src/browser.ts') },
  banner: { js: '/* Shipgate core (MIT, github.com/skysssup/shipgate): scanner + policy + planRun, bundled for the browser */' },
});
for (const [file, info] of Object.entries(result.metafile.outputs)) console.log(file, info.bytes, 'bytes');
console.log('inputs:', Object.keys(result.metafile.inputs).map((p) => p.replace(repo, '<repo>')).join(', '));
