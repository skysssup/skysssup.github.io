# skysssup.github.io

Personal site for [skysssup](https://github.com/skysssup). Plain HTML/CSS/JS, dark/light theme via `localStorage`, hosted on GitHub Pages.

Project blurbs match the public repos and call out real limitations (capture exclusion is best-effort; MoltDAO is a toy; Spanforge redaction is pattern-based and not universal). Demo links are omitted unless the live page returns 200 (as of 2026-10-02).

## Local

Open `index.html` or serve the folder with any static file server.

Theme behavior tests (Node.js 22 or newer, no dependencies):

```sh
node --test test/site.test.cjs
```
