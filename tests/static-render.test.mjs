import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';

import { highlightCode, renderStaticHTML, sanitizeStyle } from '../lib/static.js';

const text = (t, marks) => (marks ? { type: 'text', text: t, marks } : { type: 'text', text: t });
const p = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });

test('code blocks: the node view DOM with the highlighter token classes', () => {
  const html = renderStaticHTML(
    doc({
      type: 'codeBlock',
      attrs: { language: 'javascript' },
      content: [text('const a = 1;\nreturn a;')],
    })
  );
  assert.match(
    html,
    /^<div class="richtext-code-block" data-language="javascript"><pre class="shj"><code class="language-javascript"><span class="shj-kwd">const<\/span>/
  );
  assert.match(
    html,
    /<div aria-hidden="true" class="richtext-code-block__gutter"><span>1<\/span><span>2<\/span><\/div>/
  );
  assert.match(html, /<span class="richtext-code-block__lang">Javascript<\/span>/);
  assert.match(html, /data-sn-copy[^>]* hidden>/);
});

test('code blocks without a language use the editor guess (and the same tokens as the editor)', () => {
  const hl = highlightCode('{\n  "a": true\n}', null);
  assert.equal(hl.language, 'json');
  assert.equal(hl.detected, true);
  assert.ok(hl.tokens.some((t) => t.type === 'bool' && t.text === 'true'));
});

test('tables keep the column group, merges, alignment and cell colours', () => {
  const cell = (t, attrs) => ({ type: 'tableCell', attrs, content: [p(text(t))] });
  const html = renderStaticHTML(
    doc({
      type: 'table',
      content: [
        {
          type: 'tableRow',
          content: [cell('a', { colwidth: [120] }), cell('b', { colwidth: [80], align: 'right' })],
        },
        {
          type: 'tableRow',
          content: [cell('ab', { colspan: 2, colwidth: [120, 80], backgroundColor: '#fef3c7' })],
        },
      ],
    })
  );
  assert.ok(
    html.startsWith(
      '<div class="tableWrapper"><table style="width: 200px;"><colgroup><col style="width: 120px;"><col style="width: 80px;"></colgroup><tbody>'
    )
  );
  assert.match(
    html,
    /<td colspan="1" rowspan="1" colwidth="80" style="text-align: right"><p>b<\/p><\/td>/
  );
  assert.match(html, /<td style="background-color: #fef3c7" colspan="2"/);
});

test('images: size, alignment, caption, lazy loading', () => {
  const html = renderStaticHTML(
    doc({
      type: 'imageBlock',
      attrs: { src: '/a.gif', width: 320, align: 'right', caption: 'Cap <b>' },
    })
  );
  assert.equal(
    html,
    '<figure class="image-view" data-type="imageBlock" style="display: block; text-align: right;"><span class="image-view__body"><img class="image-view__body__image block" src="/a.gif" alt="Cap &lt;b&gt;" loading="lazy" decoding="async" style="width: 320px; transform: none"></span><figcaption class="image-view__caption" style="text-align: right;">Cap &lt;b&gt;</figcaption></figure>'
  );
});

test('marks merge across text nodes; unsafe URLs, styles and unknown types are dropped', () => {
  const html = renderStaticHTML(
    doc(
      p(
        text('a', [{ type: 'bold' }]),
        text('b', [{ type: 'bold' }, { type: 'italic' }]),
        text('x', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])
      ),
      { type: 'paragraph', attrs: { textAlign: 'center; position: fixed' }, content: [text('c')] },
      { type: 'mystery', content: [p(text('kept'))] }
    )
  );
  assert.match(
    html,
    /<p><strong>a<em>b<\/em><\/strong><a target="_blank"[^>]*class="link">x<\/a><\/p>/
  );
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('position'));
  assert.match(html, /<p>kept<\/p>/);
  assert.equal(sanitizeStyle('color: red; background: url(x); top: 0'), 'color: red');
});

test('task items, details, callouts and formulas without a script', () => {
  const html = renderStaticHTML(
    doc(
      {
        type: 'taskList',
        content: [{ type: 'taskItem', attrs: { checked: true }, content: [p(text('done'))] }],
      },
      {
        type: 'details',
        attrs: { open: false },
        content: [
          { type: 'detailsSummary', content: [text('More')] },
          { type: 'detailsContent', content: [p(text('Hidden'))] },
        ],
      },
      { type: 'callout', attrs: { type: 'tip', title: 'T', body: 'B <script>x</script>' } },
      p({ type: 'katex', attrs: { text: 'x^2' } })
    ),
    { katex: { renderToString: (tex) => `<span class="katex">${tex}</span>` } }
  );
  assert.match(
    html,
    /<li class="task-list-item" data-checked="true" data-type="taskItem"><label><input type="checkbox" tabindex="-1" aria-readonly="true" checked>/
  );
  assert.match(
    html,
    /<details class="details" data-type="details"><summary class="details-summary">More<\/summary>/
  );
  assert.match(html, /richtext-border-\[#238636\]/);
  assert.ok(!html.includes('<script>'));
  assert.match(
    html,
    /<span class="katex-node" style="display: inline-block;"><span class="katex">x\^2<\/span><\/span>/
  );
});

test('heading ids come from the host', () => {
  const html = renderStaticHTML(
    doc({ type: 'heading', attrs: { level: 2, id: 'uuid' }, content: [text('Intro')] }),
    {
      headingId: (t, i) => `h-${i}-${t.toLowerCase()}`,
    }
  );
  assert.equal(html, '<h2 id="h-0-intro">Intro</h2>');
});

test('content.css is scoped to .sn-article and keeps the editor cascade', () => {
  const css = fs.readFileSync(new URL('../lib/content.css', import.meta.url), 'utf8');
  assert.ok(css.includes(':where(.sn-article) .shj-kwd{color:var(--shj-kwd)}'));
  assert.ok(css.includes('.sn-article.sn-article table{border-collapse:separate'));
  assert.ok(css.includes(':where(.sn-article) .richtext-code-block__gutter span{display:block}'));
  assert.ok(!/\.ProseMirror|\.sparkwrite/.test(css));
  assert.ok(!/ProseMirror-selectednode|placeholder/.test(css));
});
