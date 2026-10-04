const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'tools', 'pages');
const site = JSON.parse(fs.readFileSync(path.join(pagesDir, 'site.json'), 'utf8'));

function files(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? files(full, base) : [path.relative(base, full)];
  });
}

test('the generator reproduces every committed page byte for byte', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
  execFileSync(process.execPath, [path.join(pagesDir, 'build.mjs'), out]);
  const generated = files(out);
  assert.ok(generated.length >= 4 + site.order.length, `generated ${generated.length} files`);
  for (const rel of generated) {
    const committed = path.join(root, rel);
    assert.ok(fs.existsSync(committed), `${rel} is generated but not committed`);
    assert.equal(fs.readFileSync(committed, 'utf8'), fs.readFileSync(path.join(out, rel), 'utf8'), `${rel} differs from the generator's output; edit tools/pages and rebuild`);
  }
  fs.rmSync(out, { recursive: true, force: true });
});

test('every project has its data file, and body files belong to known projects', () => {
  for (const slug of site.order) assert.ok(fs.existsSync(path.join(pagesDir, 'projects', slug + '.json')), slug);
  const bodies = fs.existsSync(path.join(pagesDir, 'bodies')) ? fs.readdirSync(path.join(pagesDir, 'bodies')) : [];
  for (const file of bodies) assert.ok(site.order.includes(file.replace(/\.html$/, '')), `${file} has no project`);
});
