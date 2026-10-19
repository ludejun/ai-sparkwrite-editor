import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { after, test } from 'node:test';

import * as Y from 'yjs';

import { YSyncProvider, collaborationKitOptions } from '../src/extensions/Collaboration/provider';

// Awareness keeps a renewal timer: destroy every provider so the test process can exit.
const providers: YSyncProvider[] = [];
function make(doc = new Y.Doc()) {
  const provider = new YSyncProvider(doc);
  providers.push(provider);
  return provider;
}
after(() => providers.forEach((p) => p.destroy()));

function varUint(n: number): number[] {
  const out: number[] = [];
  while (n > 0x7f) {
    out.push(0x80 | (n & 0x7f));
    n = Math.floor(n / 128);
  }
  out.push(n);
  return out;
}
const frame = (head: number[], payload: Uint8Array) =>
  new Uint8Array([...head, ...varUint(payload.length), ...payload]);
function readFrame(data: Uint8Array): { type: number; step?: number; payload: Uint8Array } {
  let pos = 0;
  const uint = () => {
    let n = 0;
    let mult = 1;
    for (;;) {
      const b = data[pos++];
      n += (b & 0x7f) * mult;
      if (b < 0x80) return n;
      mult *= 128;
    }
  };
  const type = uint();
  const step = type === 0 ? uint() : undefined;
  const len = uint();
  return { type, step, payload: data.subarray(pos, pos + len) };
}

/** A relay like the StarNote API: its own doc, answers SyncStep1, applies + forwards updates and awareness. */
function relay() {
  const doc = new Y.Doc();
  const clients = new Set<YSyncProvider>();
  const relayAwareness: Uint8Array[] = [];
  return {
    doc,
    join(client: YSyncProvider) {
      clients.add(client);
      const toClient = (data: Uint8Array) => client.receive(data);
      client.connect((data) => {
        const msg = readFrame(data);
        if (msg.type === 0 && msg.step === 0) {
          toClient(frame([0, 1], Y.encodeStateAsUpdate(doc, msg.payload)));
        } else if (msg.type === 0) {
          Y.applyUpdate(doc, msg.payload);
          clients.forEach((other) => other !== client && other.receive(frame([0, 2], msg.payload)));
        } else if (msg.type === 1) {
          relayAwareness.push(msg.payload);
          clients.forEach((other) => other !== client && other.receive(data));
        }
      });
      toClient(frame([0, 0], Y.encodeStateVector(doc)));
      relayAwareness.forEach((update) => toClient(frame([1], update)));
    },
    leave(client: YSyncProvider) {
      clients.delete(client);
      client.disconnect();
    },
  };
}

test('two docs converge through a relay, with the y-websocket wire format', () => {
  const hub = relay();
  const a = make();
  const b = make();
  a.doc.getText('title').insert(0, 'Hello');
  hub.join(a);
  assert.equal(a.synced, true);
  hub.join(b);
  assert.equal(b.synced, true);
  assert.equal(b.doc.getText('title').toString(), 'Hello');

  // concurrent edits on both sides merge
  b.doc.getText('title').insert(5, ' B');
  a.doc.getText('title').insert(0, 'A ');
  assert.equal(a.doc.getText('title').toString(), b.doc.getText('title').toString());
  assert.equal(hub.doc.getText('title').toString(), 'A Hello B');

  // XML fragments (what the editor writes) sync too
  const p = new Y.XmlElement('paragraph');
  p.insert(0, [new Y.XmlText('正文')]);
  a.doc.getXmlFragment('default').insert(0, [p]);
  assert.equal(b.doc.getXmlFragment('default').toString(), '<paragraph>正文</paragraph>');
});

test('awareness travels and remote states go on disconnect', () => {
  const hub = relay();
  const a = make();
  const b = make();
  a.awareness.setLocalStateField('user', { name: '张三', color: '#1677ff' });
  hub.join(a);
  hub.join(b);
  b.awareness.setLocalStateField('user', { name: '李四', color: '#52c41a' });
  assert.equal(a.awareness.getStates().get(b.doc.clientID)?.user.name, '李四');
  assert.equal(b.awareness.getStates().get(a.doc.clientID)?.user.name, '张三');
  hub.leave(b);
  assert.equal(
    b.awareness.getStates().has(a.doc.clientID),
    false,
    'remote cursors cleared offline'
  );
  assert.equal(b.status, 'disconnected');
  assert.equal(b.synced, false);
});

test('offline edits are kept and sent on reconnect', () => {
  const hub = relay();
  const a = make();
  hub.join(a);
  hub.leave(a);
  a.doc.getText('title').insert(0, '离线写的');
  assert.equal(hub.doc.getText('title').toString(), '');
  hub.join(a);
  assert.equal(hub.doc.getText('title').toString(), '离线写的');
});

test('permission-denied frames surface as an event', () => {
  const a = make();
  const reasons: string[] = [];
  a.on('denied', (r) => reasons.push(r));
  const reason = new TextEncoder().encode('40301');
  a.receive(new Uint8Array([2, 0, reason.length, ...reason]));
  assert.deepEqual(reasons, ['40301']);
});

test('collaborationKitOptions wires the document and the caret', () => {
  const doc = new Y.Doc();
  const provider = make(doc);
  const options = collaborationKitOptions({
    document: doc,
    provider,
    user: { name: 'n', color: '#000' },
  });
  assert.equal(options.collaboration.document, doc);
  assert.equal(options.collaboration.field, 'default');
  assert.equal(options.collaborationCaret.provider, provider);
});

test('the kit leaves history out when collaboration is on', async () => {
  if (!existsSync(new URL('../lib/vue.js', import.meta.url))) return; // needs `pnpm build:lib`
  const { RichTextKit } = await import('../lib/vue.js');
  const names = (options: Record<string, unknown>) => {
    const kit = RichTextKit.configure(options);
    return kit.config.addExtensions
      .call({ options: kit.options })
      .map((e: { name: string }) => e.name);
  };
  const plain = names({});
  assert.ok(plain.includes('undoRedo'));
  assert.ok(!plain.includes('collaboration'), 'collaboration is opt-in');
  const doc = new Y.Doc();
  const collab = names({
    collaboration: { document: doc },
    collaborationCaret: { provider: make(doc), user: { name: 'n', color: '#000' } },
  });
  assert.ok(collab.includes('collaboration') && collab.includes('collaborationCaret'));
  assert.ok(!collab.includes('undoRedo'), 'Yjs brings its own undo manager');
});

test('golden fixtures are up to date (y-prosemirror output for every fixture)', () => {
  if (!existsSync(new URL('../lib/vue.js', import.meta.url))) return;
  execFileSync(
    process.execPath,
    [new URL('../scripts/gen-collab-golden.mjs', import.meta.url).pathname, '--check'],
    {
      stdio: 'pipe',
    }
  );
});
