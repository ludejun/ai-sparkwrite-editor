import assert from 'node:assert/strict';
import { test } from 'node:test';

import { planToolbar, segmentOf } from '../src/kit/toolbarLayout';

import type { ToolbarGroupSpec } from '../src/kit/toolbarLayout';

// The kit toolbar's default row: AI, undo/redo, heading + font family, marks +
// colours, lists + alignment, insert. `null` never collapses.
const groups: ToolbarGroupSpec[] = [
  { id: 'ai', priority: null },
  { id: 'history', priority: 5 },
  { id: 'paragraph', priority: null, segment: 'text' },
  { id: 'font', priority: 3, segment: 'text' },
  { id: 'marks', priority: null, segment: 'marks' },
  { id: 'colors', priority: 1, segment: 'marks' },
  { id: 'lists', priority: null, segment: 'lists' },
  { id: 'align', priority: 2, segment: 'lists' },
  { id: 'insert', priority: 4 },
];

const widths = {
  ai: 40,
  history: 65,
  paragraph: 120,
  font: 96,
  marks: 131,
  colors: 98,
  lists: 131,
  align: 32,
  insert: 131,
};

const gap = 1;
const dividerWidth = 5 + gap;
const reserved = 32 + gap;

// 9 groups, 8 gaps, 6 segments → 5 dividers, plus the "More" trigger.
const fullWidth =
  Object.values(widths).reduce((sum, width) => sum + width, 0) +
  8 * gap +
  5 * dividerWidth +
  reserved;

const plan = (available: number, list = groups, sizes: Record<string, number> = widths) =>
  planToolbar({ groups: list, widths: sizes, available, gap, dividerWidth, reserved });

test('a row that exactly fits keeps every group inline', () => {
  const result = plan(fullWidth);
  assert.deepEqual(result.collapsed, []);
  assert.deepEqual(
    result.inline,
    groups.map((group) => group.id)
  );
  assert.equal(result.width, fullWidth);
});

test('one pixel short collapses the lowest priority group only', () => {
  const result = plan(fullWidth - 1);
  assert.deepEqual(result.collapsed, ['colors']);
  assert.ok(!result.inline.includes('colors'));
  assert.equal(result.inline.length, groups.length - 1);
  // Colours shared the marks divider slot, so no divider was saved — only its width and a gap.
  assert.equal(result.width, fullWidth - widths.colors - gap);
  assert.ok(result.width <= fullWidth - 1);
});

test('groups collapse in priority order: colours, alignment, font, insert, history', () => {
  const order = ['colors', 'align', 'font', 'insert', 'history'];
  let previous = fullWidth;
  for (let count = 1; count <= order.length; count++) {
    // Just narrower than the previous plan needs.
    const result = plan(previous - 1);
    assert.deepEqual(result.collapsed, order.slice(0, count));
    previous = result.width;
  }
});

test('removing a group that owns a divider slot saves the divider too', () => {
  // Collapse down to insert: it has its own slot, so a divider goes with it.
  const withoutThree = plan(fullWidth - widths.colors - widths.align - widths.font - 3 * gap - 1);
  assert.deepEqual(withoutThree.collapsed, ['colors', 'align', 'font', 'insert']);
  assert.equal(
    withoutThree.width,
    fullWidth - widths.colors - widths.align - widths.font - widths.insert - 4 * gap - dividerWidth
  );
});

test('an extremely narrow row keeps only the groups that never collapse', () => {
  const result = plan(10);
  assert.deepEqual(result.inline, ['ai', 'paragraph', 'marks', 'lists']);
  assert.deepEqual(result.collapsed, ['colors', 'align', 'font', 'insert', 'history']);
  assert.ok(result.width > 10, 'what is left still overflows, by design');
});

test('a wider row brings groups straight back — the plan is a function of the inputs', () => {
  const narrow = plan(fullWidth - 200);
  assert.ok(narrow.collapsed.length >= 2);
  const wide = plan(fullWidth);
  assert.deepEqual(wide.collapsed, []);
  const between = plan(fullWidth - 1);
  assert.deepEqual(between.collapsed, ['colors']);
});

test('pinned controls collapse first, the last pinned one before the others', () => {
  const pins: ToolbarGroupSpec[] = [
    { id: 'pin:fontSize', priority: 0, segment: 'pins' },
    { id: 'pin:katex', priority: 0, segment: 'pins' },
  ];
  const sizes = { ...widths, 'pin:fontSize': 40, 'pin:katex': 32 };
  const withPins = [...groups, ...pins];
  const total = plan(Number.POSITIVE_INFINITY, withPins, sizes).width;
  assert.equal(total, fullWidth + 40 + 32 + 2 * gap + dividerWidth);

  const one = plan(total - 1, withPins, sizes);
  assert.deepEqual(one.collapsed, ['pin:katex']);
  const two = plan(one.width - 1, withPins, sizes);
  assert.deepEqual(two.collapsed, ['pin:katex', 'pin:fontSize']);
  // The pins' divider slot went with the last pin.
  assert.equal(two.width, fullWidth);
  const three = plan(two.width - 1, withPins, sizes);
  assert.deepEqual(three.collapsed, ['pin:katex', 'pin:fontSize', 'colors']);
});

test('groups that never collapse are kept even when nothing else is left', () => {
  const rigid: ToolbarGroupSpec[] = [
    { id: 'a', priority: null },
    { id: 'b', priority: null },
  ];
  const result = planToolbar({ groups: rigid, widths: { a: 50, b: 50 }, available: 20 });
  assert.deepEqual(result.inline, ['a', 'b']);
  assert.deepEqual(result.collapsed, []);
  assert.equal(result.width, 100);
});

test('an unknown width counts as zero and an empty row costs the reserved space', () => {
  const result = planToolbar({ groups: [{ id: 'a', priority: 1 }], widths: {}, available: 100 });
  assert.deepEqual(result.inline, ['a']);
  assert.equal(result.width, 0);
  assert.equal(planToolbar({ groups: [], widths: {}, available: 100, reserved: 33 }).width, 33);
});

test('segmentOf falls back to the id', () => {
  assert.equal(segmentOf({ id: 'insert', priority: 4 }), 'insert');
  assert.equal(segmentOf({ id: 'font', priority: 3, segment: 'text' }), 'text');
});
