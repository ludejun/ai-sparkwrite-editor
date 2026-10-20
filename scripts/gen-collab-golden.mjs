/**
 * Golden fixtures for the Y.XmlFragment ⇄ ProseMirror JSON converters
 * (StarNote SPEC-r2-collaboration §4.4). For every `tests/fixtures/collab/*.json`:
 *
 *   <name>.pm.json       the fixture loaded through the real kit schema and serialized again
 *                        (= what `editor.getJSON()` stores: every attr, defaults filled in)
 *   <name>.yupdate.bin   Y.encodeStateAsUpdate of y-prosemirror's `prosemirrorJSONToYDoc(…, 'default')`
 *   <name>.yjson.json    y-prosemirror's `yDocToProsemirrorJSON(doc, 'default')` (the schema-less reading)
 *
 * Server-side converters are tested against these (bin → JSON must equal .yjson.json, JSON → Y → JSON too).
 * Updates written by the server (`<name>.py.yupdate.bin`, if present next to the output) are checked the other
 * way here: they must decode, with the real schema, to the same document as `.pm.json`.
 *
 *   pnpm build:lib && node scripts/gen-collab-golden.mjs [--out ../starnote-api/tests/fixtures/collab] [--check]
 *
 * `--check` regenerates in memory and fails when the committed files differ (the output is deterministic:
 * fixed Y client id).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getSchema } from '@tiptap/core';
import { Node } from '@tiptap/pm/model';
import { prosemirrorToYXmlFragment, yXmlFragmentToProsemirrorJSON } from '@tiptap/y-tiptap';
import * as Y from 'yjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'tests/fixtures/collab');
const args = process.argv.slice(2);
const check = args.includes('--check');
const outIdx = args.indexOf('--out');
const outDirs = [join(fixtures, 'golden')];
if (outIdx >= 0 && args[outIdx + 1]) outDirs.push(resolve(process.cwd(), args[outIdx + 1]));

export async function kitSchema() {
  const { RichTextKit } = await import(join(root, 'lib/vue.js'));
  const core = await import(join(root, 'lib/core.js'));
  const extra = [core.StyledBlocks].filter(Boolean);
  return getSchema([RichTextKit.configure({ column: {}, placeholder: false }), ...extra]);
}

/** Deterministic: same client id, same transaction shape → byte-identical updates. */
export function toYDoc(schema, json) {
  const doc = new Y.Doc();
  doc.clientID = 1;
  const fragment = doc.getXmlFragment('default');
  prosemirrorToYXmlFragment(Node.fromJSON(schema, json), fragment);
  return doc;
}

const stable = (value) => JSON.stringify(value, null, 1) + '\n';

async function main() {
  const schema = await kitSchema();
  const names = readdirSync(fixtures)
    .filter((f) => f.endsWith('.json'))
    .map((f) => basename(f, '.json'))
    .sort();
  let failures = 0;
  for (const name of names) {
    const input = JSON.parse(readFileSync(join(fixtures, `${name}.json`), 'utf8'));
    const node = Node.fromJSON(schema, input);
    node.check(); // fixtures must be valid documents for the kit schema
    const pm = node.toJSON();
    const doc = toYDoc(schema, pm);
    const files = {
      [`${name}.pm.json`]: stable(pm),
      [`${name}.yupdate.bin`]: Buffer.from(Y.encodeStateAsUpdate(doc)),
      [`${name}.yjson.json`]: stable(yXmlFragmentToProsemirrorJSON(doc.getXmlFragment('default'))),
    };
    for (const dir of outDirs) {
      mkdirSync(dir, { recursive: true });
      for (const [file, body] of Object.entries(files)) {
        const path = join(dir, file);
        if (check) {
          const current = existsSync(path) ? readFileSync(path) : null;
          if (!current || !Buffer.from(body).equals(current)) {
            console.error(`stale: ${path}`);
            failures++;
          }
        } else {
          writeFileSync(path, body);
        }
      }
      // the server's direction: its updates must load into the real schema as the same document
      const py = join(dir, `${name}.py.yupdate.bin`);
      if (existsSync(py)) {
        const back = new Y.Doc();
        Y.applyUpdate(back, new Uint8Array(readFileSync(py)));
        const json = yXmlFragmentToProsemirrorJSON(back.getXmlFragment('default'));
        const node = Node.fromJSON(schema, json);
        node.check();
        if (JSON.stringify(node.toJSON()) !== JSON.stringify(pm)) {
          console.error(`server update differs: ${py}`);
          failures++;
        } else {
          console.log(`ok   ${name}.py.yupdate.bin → ${name}.pm.json`);
        }
      }
    }
    console.log(`${check ? 'checked' : 'wrote  '} ${name}`);
  }
  if (failures) {
    console.error(`${failures} golden problem(s)`);
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
