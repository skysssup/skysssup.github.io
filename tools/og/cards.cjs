// What each share image shows, read from the committed pages. tools/og/render.mjs draws these, and
// test/content.test.cjs compares their fingerprints with assets/og/stamp.json to catch stale images.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta (?:property|name)="${prop}" content="([^"]*)"`));
  return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'") : '';
};

function cards(root) {
  const read = p => fs.readFileSync(path.join(root, p), 'utf8');
  const host = new URL(JSON.parse(read('tools/pages/site.json')).origin).host;
  const list = [
    { out: 'home.png', kicker: 'Developer tools · Physics software', title: 'Aakash Dahal', summary: meta(read('index.html'), 'description'), label: 'Work · Contact', host, still: true },
    { out: 'work.png', kicker: 'Work', title: 'Eight projects', summary: 'AI systems, developer tools, and physics software, each with a case study.', label: 'AI systems · Developer tools · Physics software', host, still: true },
  ];
  for (const slug of fs.readdirSync(path.join(root, 'work')).sort()) {
    const file = path.join('work', slug, 'index.html');
    if (!fs.existsSync(path.join(root, file))) continue;
    const html = read(file);
    const cover = path.posix.join('work', slug, 'media', 'cover-1344.webp');
    const themes = (html.match(/<dt class="t-label">Themes<\/dt><dd>([^<]*)<\/dd>/) || [])[1] || '';
    list.push({
      out: `${slug}.png`,
      kicker: 'Case study · ' + themes.replace(/&amp;/g, '&'),
      title: meta(html, 'og:title').replace(/ — Aakash Dahal$/, ''),
      summary: (html.match(/<div class="case-title">\s*<h1[^>]*>[^<]*<\/h1>\s*<p>([^<]*)<\/p>/) || [])[1] || '',
      label: `${host}/work/${slug}`,
      host,
      visual: fs.existsSync(path.join(root, cover)) ? cover : null,
    });
  }
  return list;
}

// A card's fingerprint covers its text and the bytes of the image it shows.
function fingerprint(root, card) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(card));
  const image = card.still ? 'assets/hero/still.webp' : card.visual;
  if (image) hash.update(fs.readFileSync(path.join(root, image)));
  return hash.digest('hex').slice(0, 16);
}

module.exports = { cards, fingerprint };
