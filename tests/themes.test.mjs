import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// Run after pnpm build:lib: the article themes (src/styles/themes.scss) in the editor sheet and in
// the read-only content.css (re-scoped from .ProseMirror to .sn-article).
const style = readFileSync(new URL('../lib/style.css', import.meta.url), 'utf8');
const content = readFileSync(new URL('../lib/content.css', import.meta.url), 'utf8');

const THEMES = {
  business: { accent: '#1f4e8c', font: '15px' },
  tech: { accent: '#1e6fff', font: '15px' },
  warm: { accent: '#b4613a', font: '16px' },
  magazine: { accent: '#c8102e', font: '16px' },
  fresh: { accent: '#2a9d6f', font: '15px' },
};

/** Declarations of the first rule whose selector list contains `selector` exactly. */
function ruleBody(css, selector) {
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    const selectors = m[1].split(',').map((s) => s.trim());
    if (selectors.includes(selector)) return m[2];
  }
  return null;
}

for (const [scope, css] of [
  ['.ProseMirror', style],
  ['.sn-article', content],
]) {
  for (const [id, t] of Object.entries(THEMES)) {
    const root = `${scope}.sn-theme.sn-theme--${id}`;
    test(`themes: ${id} rules in ${scope === '.ProseMirror' ? 'style.css' : 'content.css'}`, () => {
      const body = ruleBody(css, root);
      assert.ok(body, `${root} rule`);
      assert.match(body, new RegExp(`--sn-accent:\\s*${t.accent}`, 'i'));
      assert.match(body, new RegExp(`font-size:\\s*${t.font}`));
      assert.match(body, /text-align:\s*justify/);
      assert.ok(ruleBody(css, `${root} p:not(.sn-box--stat p)`), 'paragraph rule');
      assert.ok(ruleBody(css, `${root} h2:not(.sn-h)`), 'h2 rule');
      assert.ok(ruleBody(css, `${root} h3:not(.sn-h)`), 'h3 rule');
      assert.ok(ruleBody(css, `${root} blockquote:not(.sn-quote)`), 'quote rule');
      assert.ok(ruleBody(css, `${root} .divider.divider--line>hr`), 'plain divider rule');
      assert.ok(ruleBody(css, `${root} .image-view__caption`), 'caption rule');
    });
  }
}

test('themes: dark pages keep the page text colour', () => {
  assert.ok(
    content.includes(":is([data-theme='dark'], .is-dark) .sn-article.sn-theme.sn-theme--tech"),
    'dark rule re-scoped'
  );
});
