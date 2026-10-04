const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const ORIGIN = 'https://skysssup.github.io';
const pages = ['index.html', 'work/index.html', '404.html']
  .concat(fs.readdirSync(path.join(root, 'work')).filter(d => fs.existsSync(path.join(root, 'work', d, 'index.html'))).map(d => `work/${d}/index.html`));
const html = Object.fromEntries(pages.map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
const caseStudies = pages.filter(p => /^work\/[^/]+\/index\.html$/.test(p) && p !== 'work/index.html');
const meta = (doc, key) => { const m = doc.match(new RegExp(`<meta (?:name|property)="${key}" content="([^"]*)"`)); return m ? m[1] : null; };
const strip = s => s.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');

function resolve(url) {
  const clean = url.split('#')[0].split('?')[0];
  if (!clean) return null;
  const rel = clean.replace(/^\//, '');
  return clean.endsWith('/') ? path.join(root, rel, 'index.html') : path.join(root, rel);
}

test('every page has a title, description, canonical URL, and complete share tags', () => {
  for (const [p, doc] of Object.entries(html)) {
    assert.match(doc, /<html lang="en">/, p);
    assert.match(doc, /<title>[^<]{5,}<\/title>/, p);
    assert.ok((meta(doc, 'description') || '').length > 30, `${p} description`);
    if (p === '404.html') { assert.match(doc, /<meta name="robots" content="noindex">/); continue; }
    const canonical = (doc.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
    assert.ok(canonical && canonical.startsWith(ORIGIN + '/'), `${p} canonical`);
    assert.equal(meta(doc, 'og:url'), canonical, `${p} og:url matches canonical`);
    for (const key of ['og:title', 'og:description', 'og:image', 'og:image:alt', 'twitter:card']) assert.ok(meta(doc, key), `${p} ${key}`);
    const image = meta(doc, 'og:image');
    assert.ok(image.startsWith(ORIGIN + '/'), `${p} og:image is absolute`);
    assert.ok(fs.existsSync(path.join(root, image.slice(ORIGIN.length + 1))), `${p} og:image file exists`);
    assert.equal(meta(doc, 'twitter:card'), 'summary_large_image');
  }
});

test('titles and descriptions are unique per page', () => {
  const indexable = pages.filter(p => p !== '404.html');
  const titles = indexable.map(p => html[p].match(/<title>([^<]+)<\/title>/)[1]);
  const descriptions = indexable.map(p => meta(html[p], 'description'));
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('each page has exactly one h1, a skip link to main, and landmarks', () => {
  for (const [p, doc] of Object.entries(html)) {
    assert.equal((doc.match(/<h1[\s>]/g) || []).length, 1, `${p} h1 count`);
    assert.match(doc, /<a class="skip" href="#main">/, p);
    assert.match(doc, /<main id="main">/, p);
    assert.match(doc, /<header class="site-header">/, p);
    assert.match(doc, /<footer class="site-footer">/, p);
  }
});

test('every internal link, script, stylesheet, image, video, and poster resolves to a file', () => {
  for (const [p, doc] of Object.entries(html)) {
    const refs = [...doc.matchAll(/(?:href|src|poster)="(\/[^"]*)"/g)].map(m => m[1]);
    for (const srcset of doc.matchAll(/srcset="([^"]+)"/g)) for (const part of srcset[1].split(',')) refs.push(part.trim().split(' ')[0]);
    for (const ref of refs) {
      if (ref.startsWith('//')) continue;
      const file = resolve(ref);
      if (!file) continue;
      assert.ok(fs.existsSync(file), `${p} links to missing ${ref}`);
    }
  }
});

test('images have alt text and dimensions; videos are muted, inline, labelled, and have posters', () => {
  for (const [p, doc] of Object.entries(html)) {
    for (const img of doc.match(/<img [^>]*>/g) || []) {
      assert.match(img, /\salt="/, `${p} ${img}`);
      assert.match(img, /\swidth="\d+"/, `${p} ${img}`);
      assert.match(img, /\sheight="\d+"/, `${p} ${img}`);
    }
    for (const video of doc.match(/<video [^>]*>/g) || []) {
      for (const attr of ['muted', 'playsinline', 'poster=', 'aria-label=', 'preload="none"']) assert.ok(video.includes(attr), `${p} video needs ${attr}`);
    }
  }
});

test('the header and footer are identical on every page apart from the current-page marker', () => {
  const part = (doc, tag) => doc.match(new RegExp(`<${tag} class="site-${tag}">[\\s\\S]*?</${tag}>`))[0].replace(/ aria-current="page"/g, '');
  const header = part(html['index.html'], 'header');
  const footer = part(html['index.html'], 'footer');
  for (const [p, doc] of Object.entries(html)) {
    assert.equal(part(doc, 'header'), header, `${p} header`);
    assert.equal(part(doc, 'footer'), footer, `${p} footer`);
  }
  assert.match(html['work/index.html'], /<a href="\/work\/" aria-current="page">Work<\/a>/);
});

test('every case study has the full section structure, stack, and code link', () => {
  for (const p of caseStudies) {
    const doc = html[p];
    for (const id of ['problem', 'built', 'how', 'decisions', 'hard', 'status', 'stack']) assert.match(doc, new RegExp(`<section id="${id}"`), `${p} #${id}`);
    for (const id of ['problem', 'built', 'how', 'decisions', 'hard', 'status', 'stack']) assert.match(doc, new RegExp(`<a href="#${id}">`), `${p} index links #${id}`);
    assert.match(doc, /<dt class="t-label">Code<\/dt><dd>(<a href="https:\/\/github\.com\/skysssup\/[a-z-]+">|Private repository)/, `${p} code link`);
    assert.match(doc, /<nav class="row pager" aria-label="More projects">/, p);
  }
});

test('the work index lists every case study once, and the home page links each featured one', () => {
  const listed = [...html['work/index.html'].matchAll(/<h2><a href="\/work\/([a-z-]+)\/">/g)].map(m => m[1]);
  assert.deepEqual([...listed].sort(), caseStudies.map(p => p.split('/')[1]).sort());
  for (const m of html['index.html'].matchAll(/<h3><a href="(\/work\/[a-z-]+\/)">/g)) assert.ok(fs.existsSync(resolve(m[1])));
});

test('copy avoids marketing filler and shouting', () => {
  const banned = /\b(seamless(ly)?|robust|cutting[- ]edge|leverag(e|es|ing)|empower(s|ing)?|unlock(s|ing)?|delve|blazing(ly)?|revolutionary|game[- ]changer|world[- ]class|state[- ]of[- ]the[- ]art|supercharg(e|ed|es)|synerg(y|ies)|passionate|rockstar|ninja)\b/i;
  for (const [p, doc] of Object.entries(html)) {
    const text = strip(doc);
    assert.doesNotMatch(text, banned, p);
    assert.doesNotMatch(text, /!/, `${p} has an exclamation mark`);
    for (const para of doc.match(/<p[^>]*>([\s\S]*?)<\/p>/g) || []) {
      const words = strip(para).trim().split(/\s+/).filter(w => /[a-z]/i.test(w));
      if (words.length > 4) assert.ok(words.some(w => /[a-z]/.test(w)), `${p} paragraph in capitals: ${strip(para).trim().slice(0, 60)}`);
    }
  }
});

test('/portfolio/ forwards to /work/', () => {
  const doc = fs.readFileSync(path.join(root, 'portfolio', 'index.html'), 'utf8');
  assert.match(doc, /<meta http-equiv="refresh" content="0; url=\/work\/">/);
  assert.match(doc, /<link rel="canonical" href="https:\/\/skysssup\.github\.io\/work\/">/);
});

test('share images are current: each matches the title, summary, and visual of its page', () => {
  const { cards, fingerprint } = require('../tools/og/cards.cjs');
  const stamp = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'og', 'stamp.json'), 'utf8'));
  for (const card of cards(root)) {
    assert.ok(card.title && card.summary, `${card.out} has a title and summary`);
    assert.equal(stamp[card.out], fingerprint(root, card), `assets/og/${card.out} is stale: run npm run og`);
  }
});
