import assert from 'node:assert/strict';
import { test } from 'node:test';

import zhCn from '../src/locales/zh-cn';
import zhTw from '../src/locales/zh-tw';

test('Traditional Chinese covers every key of Simplified Chinese', () => {
  assert.deepEqual(Object.keys(zhTw).sort(), Object.keys(zhCn).sort());
});

test('Traditional Chinese uses no Simplified-only characters', () => {
  // Characters that exist only in Simplified script (their Traditional forms differ): a catch for unconverted strings.
  const simplified =
    /[这个们发说时为对开记录笔经过还让进门间问题设户数据网络软视频删编辑写图链标题栏]/;
  for (const [key, text] of Object.entries(zhTw)) assert.doesNotMatch(text, simplified, key);
});
