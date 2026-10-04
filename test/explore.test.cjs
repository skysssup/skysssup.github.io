const { test } = require('node:test');
const assert = require('node:assert/strict');
const { matchesQuery, queryFromSearch, searchFor, themeFromSearch } = require('../js/page.js');

test('project search matches every word regardless of case, spacing, or accents', () => {
  const project = 'Recall Spaced repetition Developer tools Python FastAPI SQLite';
  for (const query of ['', '  ', 'RECALL', 'python sqlite', '  Python   FastAPI  ', 'récall']) {
    assert.equal(matchesQuery(project, query), true, query);
  }
  assert.equal(matchesQuery(project, 'python typescript'), false);
  assert.equal(matchesQuery(project, '[]'), false);
  assert.equal(matchesQuery(project, '<script>'), false);
  assert.equal(matchesQuery('', 'recall'), false);
});

test('search and theme share a URL without losing punctuation or Unicode', () => {
  for (const query of ['C++', 'AI & tools', '  Python SQLite ', 'électron', '# > < %']) {
    const search = searchFor('developer-tools', query);
    assert.equal(themeFromSearch(search), 'developer-tools');
    assert.equal(queryFromSearch(search), query.trim());
  }
  assert.equal(searchFor('all', ' '), '');
  assert.equal(searchFor('unknown', 'python'), '?q=python');
  assert.equal(searchFor('ai-systems', ''), '?theme=ai-systems');
});

test('malformed and unknown query parameters cannot break the page', () => {
  assert.equal(themeFromSearch('?theme=%E0%A4%A'), 'all');
  assert.equal(themeFromSearch('?theme=not-a-theme&q=python'), 'all');
  assert.equal(themeFromSearch('?theme=ai-systems&theme=developer-tools'), 'ai-systems');
  assert.equal(queryFromSearch('?q=React+TypeScript'), 'React TypeScript');
  assert.equal(queryFromSearch('?theme=ai-systems'), '');
  assert.doesNotThrow(() => queryFromSearch('?q=%E0%A4%A'));
});
