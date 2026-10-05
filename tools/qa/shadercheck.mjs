// Compiles js/hero.js's VERT and FRAG in Chrome (WebGL2 via SwiftShader), links them, and checks for GLSL ES reserved
// words used as identifiers (another driver may reject what this one accepts):
//   CHROME_PATH=/usr/bin/google-chrome-stable node tools/qa/shadercheck.mjs [path/to/hero.js]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const file = process.argv[2] || path.join(REPO, 'js/hero.js');
const text = fs.readFileSync(file, 'utf8');
const grab = name => {
  const start = text.indexOf(`var ${name} = [`);
  const end = text.indexOf('].join("\\n");', start);
  if (start < 0 || end < 0) throw new Error(`no ${name} in ${file}`);
  return eval(text.slice(start + `var ${name} = `.length, end + 1)).join('\n');
};
const sources = { VERT: grab('VERT'), FRAG: grab('FRAG') };
// GLSL ES 3.00 §3.8 reserved keywords for future use, plus a few that drivers trip over
const reserved = ['attribute', 'varying', 'coherent', 'volatile', 'restrict', 'readonly', 'writeonly', 'resource', 'atomic_uint',
  'noperspective', 'patch', 'sample', 'subroutine', 'common', 'partition', 'active', 'asm', 'class', 'union', 'enum', 'typedef',
  'template', 'this', 'goto', 'inline', 'noinline', 'public', 'static', 'extern', 'external', 'interface', 'long', 'short',
  'double', 'half', 'fixed', 'unsigned', 'superp', 'input', 'output', 'hvec2', 'hvec3', 'hvec4', 'dvec2', 'dvec3', 'dvec4',
  'fvec2', 'fvec3', 'fvec4', 'sampler3DRect', 'filter', 'sizeof', 'cast', 'namespace', 'using', 'buffer', 'shared', 'texture',
  'packed', 'precise', 'image1D', 'image2D', 'image3D', 'smooth'];
let bad = [];
for (const [name, src] of Object.entries(sources)) {
  const code = src.replace(/\/\/.*$/gm, '');
  for (const word of reserved) {
    const re = new RegExp(`\\b${word}\\b`);
    if (re.test(code) && !(word === 'smooth' && false)) bad.push(`${name}: reserved word "${word}"`);
  }
  // double underscores are reserved too
  if (/\b\w*__\w*\b/.test(code)) bad.push(`${name}: identifier with "__"`);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined, channel: process.env.CHROME_PATH ? undefined : 'chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const result = await page.evaluate(({ VERT, FRAG }) => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const out = {};
  const shaders = [];
  for (const [name, type, src] of [['VERT', gl.VERTEX_SHADER, VERT], ['FRAG', gl.FRAGMENT_SHADER, FRAG]]) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    out[name] = gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? 'ok' : gl.getShaderInfoLog(sh);
    shaders.push(sh);
  }
  const prog = gl.createProgram();
  shaders.forEach(sh => gl.attachShader(prog, sh));
  gl.linkProgram(prog);
  out.LINK = gl.getProgramParameter(prog, gl.LINK_STATUS) ? 'ok' : gl.getProgramInfoLog(prog);
  out.uniforms = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  out.varyings = (VERT.match(/^flat out /gm) || []).length;
  return out;
}, sources);
await browser.close();
console.log(JSON.stringify(result));
if (bad.length) console.log(bad.join('\n'));
process.exit(result.VERT === 'ok' && result.FRAG === 'ok' && result.LINK === 'ok' && !bad.length ? 0 : 1);
