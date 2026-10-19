import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getSchema } from '@tiptap/core';
import { Blockquote } from '@tiptap/extension-blockquote';
import { Document } from '@tiptap/extension-document';
import { Heading } from '@tiptap/extension-heading';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';

// Run after pnpm build:lib: the framework-free entry, as Vue / plain ProseMirror hosts use it.
const core = await import('../lib/core.js');

const schema = getSchema([
  Document,
  Paragraph,
  Text,
  Heading,
  Blockquote,
  core.StyledBlocks,
  core.Divider,
]);

const doc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 2, variant: 'pill' },
      content: [{ type: 'text', text: '一' }],
    },
    {
      type: 'blockquote',
      attrs: { variant: 'card' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'q' }] }],
    },
    {
      type: 'card',
      attrs: { variant: 'tip', label: '重点' },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }],
    },
    { type: 'divider', attrs: { variant: 'wave', label: null } },
  ],
};

test('styled blocks: schema accepts headings / quotes with looks, cards and ornament dividers', () => {
  const node = schema.nodeFromJSON(doc);
  node.check();
  assert.equal(node.child(0).attrs.variant, 'pill');
  assert.equal(node.child(1).attrs.variant, 'card');
  assert.deepEqual({ ...node.child(2).attrs }, { variant: 'tip', label: '重点' });
  assert.equal(node.child(3).attrs.variant, 'wave');
});

test('styled blocks: renderHTML writes the shared classes', () => {
  const node = schema.nodeFromJSON(doc);
  const [, cardAttrs, hole] = schema.nodes.card.spec.toDOM(node.child(2));
  assert.equal(cardAttrs.class, 'sn-box sn-box--tip');
  assert.equal(cardAttrs['data-label'], '重点');
  assert.equal(hole, 0);
  const [, headingAttrs] = schema.nodes.heading.spec.toDOM(node.child(0));
  assert.match(headingAttrs.class, /sn-h sn-h--pill/);
  const [, quoteAttrs] = schema.nodes.blockquote.spec.toDOM(node.child(1));
  assert.match(quoteAttrs.class, /sn-quote sn-quote--card/);
});

test('styled blocks: unsafe looks never reach a class name', () => {
  assert.equal(core.cleanVariant('pill'), 'pill');
  assert.equal(core.cleanVariant('x" onclick="y'), null);
  const node = schema.nodeFromJSON({
    type: 'heading',
    attrs: { level: 2, variant: 'bad variant' },
    content: [{ type: 'text', text: 'x' }],
  });
  const [, attrs] = schema.nodes.heading.spec.toDOM(node);
  assert.equal(attrs.class, undefined);
});

test('ornament dividers are exported for hosts', () => {
  assert.ok(core.ORNAMENT_DIVIDER_VARIANTS.includes('starsea'));
  assert.equal(core.ARTICLE_DIVIDER_VARIANTS.length, 15);
});

test('styled blocks: the 数据卡 look (stat) is a card variant with its own styles', async () => {
  assert.ok(core.CARD_STYLES.includes('stat'));
  const node = schema.nodeFromJSON({
    type: 'card',
    attrs: { variant: 'stat', label: '数据' },
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '68%' }] },
      { type: 'paragraph', content: [{ type: 'text', text: '原句' }] },
    ],
  });
  const [, attrs] = schema.nodes.card.spec.toDOM(node);
  assert.equal(attrs.class, 'sn-box sn-box--stat');
  const { readFile } = await import('node:fs/promises');
  const css = await readFile(new URL('../lib/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.sn-box\.sn-box--stat/);
});
