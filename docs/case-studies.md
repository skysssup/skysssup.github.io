# Writing a case study

Each project page lives at `work/<slug>/index.html`, and it is generated: the chrome (head, header, case-study
header, lead figure, section index, stack and links, pager, footer) comes from `tools/pages/site.json` and
`tools/pages/projects/<slug>.json`, and the hand-written part comes from `tools/pages/bodies/<slug>.html`.

1. Edit `tools/pages/bodies/<slug>.html`: the prose sections in order, then a line `<!-- numbers -->`, then the
   numbers `<dl>`. Both parts are pasted into the page verbatim, so keep the indentation and never indent inside
   `<pre>`. The section index is read from each section's `id` and `h2`.
2. Run `node tools/pages/build.mjs` and commit the body file together with the regenerated pages.
   `npm test` fails when a committed page differs from the generator's output.

A project without a body file gets a concise evidence page: the verified summary, status, media, and source, with an honest in-progress note. It does not publish authoring instructions or a placeholder diagram.

## Sections

| Section | id | What goes in it |
|---|---|---|
| One-line summary | `.case-title p` | What it is and what it proves, under 20 words. Also used as the page description and share text. |
| The problem | `#problem` | The concrete failure or gap, in engineering terms: who runs into it, what goes wrong, why existing tools miss it. 80–140 words. |
| What I built | `#built` | What exists today: the main pieces and what someone does with them. 100–180 words. |
| How it works | `#how` | The pipeline or mechanism with real module names, data structures, and thresholds. 120–220 words, plus the diagram. |
| Key decisions | `#decisions` | Three or four decisions: the decision in one sentence, why, and what it cost. 40–70 words each. |
| What's hard | `#hard` | Two or three genuinely difficult problems in the code and how they are handled. 40–80 words each. |
| Status and next | `#status` | What works now, honest limits, and two or three next steps that follow from documented limitations. 60–120 words. |
| Stack and links | `#stack` | Stack chips and the repository link (or "The repository is private."). |
| Numbers | `.numbers` panel | Four to six facts from the code: counts, limits, sizes, test results. Each must be verifiable. |

## Rules for the writing

- First person, plain technical English. Every sentence carries a fact, a mechanism, or a reason.
- Use real names and numbers from the code, and check each one.
- No marketing words (seamless, robust, cutting-edge, leverage, empower, unlock, …), no exclamation marks,
  no invented users, metrics, employers, or credentials. `npm test` fails on the worst of these.
- Keep the repositories' candor about limits.

## Markup to paste

Paragraphs inside a section:

```html
<p>First paragraph.</p>
<p>Second paragraph, with <code>module/names</code> in code.</p>
```

Key decisions:

```html
<ol class="decisions">
  <li><p><b>Scan the staged index, not the working tree.</b> Why it was chosen. What it cost.</p></li>
</ol>
```

A bulleted list: `<ul class="list"><li>…</li></ul>`

Numbers panel (after the `<!-- numbers -->` line):

```html
<dl>
  <div><dt>10</dt><dd>fault kinds, from timeout_after_commit to schema_drift</dd></div>
  <div><dt>5</dt><dd>verdict levels, worst finding wins</dd></div>
</dl>
```

The diagram is drawn by `js/diagram.js` from the JSON inside `<figure class="diagram" data-diagram>`.
Keep 3–7 nodes in one direction; labels of up to three words, an optional short `sub`, and edge labels
only where they add information. Update the `<ol class="diagram-steps">` list next to it: it is what
screen readers and no-JavaScript visitors get.

```json
{"nodes": [{"id": "a", "label": "Scenario YAML", "sub": "faults and policies"}, {"id": "b", "label": "Mock world"}],
 "edges": [{"from": "a", "to": "b", "label": "injects"}]}
```

## Visuals

Files go in `work/<slug>/media/`:

- `cover-672.webp` and `cover-1344.webp`: 16:10 screenshots, used by the home cards, the /work rows, and the share image.
- `overview.mp4` (H.264, 1440 px wide, no audio, under about 1.5 MB) with `overview-poster.webp`, or `overview.webp` for a still.
  Videos play only while on screen and never under reduced motion.
- Extra figures inside a section use the same markup as Fig. 1:

```html
<figure class="fig wide">
  <div class="fig-frame"><img src="/work/<slug>/media/detail.webp" alt="What the image shows" width="1440" height="900" loading="lazy" decoding="async"></div>
  <figcaption><span class="t-label muted">Fig. 3</span><span class="t-small">One factual sentence.</span></figcaption>
</figure>
```

- Real terminal output: `<pre class="term"><span class="cmd">$ command</span>\noutput…</pre>`

After changing a title, summary, or cover, run `npm run og` to refresh `assets/og/<slug>.png`.
