#!/usr/bin/env node
// Checks the commit message header against .github/commit-convention.md.
// Only the first line is checked: a body, a footer (Closes #12, BREAKING CHANGE:,
// Co-Authored-By: …) and `#` comment lines are allowed, which the previous
// `verify-commit-msg` package rejected because its regex ran on the whole file.
// Usage: node scripts/verify-commit-msg.mjs [path-to-message-file]
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] ?? '.git/COMMIT_EDITMSG');
const lines = readFileSync(file, 'utf8')
  .split(/\r?\n/)
  .filter((line) => !line.startsWith('#'));
const header = lines.find((line) => line.trim() !== '')?.trim() ?? '';

const TYPES =
  'feat|fix|docs|style|core|i18n|a11y|report|misc|cli|audits|improve|security|deprecated|refactor|perf|test|workflow|build|ci|chore|types|wip|release|deps?|merge|examples?|revert';
const HEADER = new RegExp(`^((${TYPES})(\\(.+\\))?!?:|(Merge|Revert|Version)) .{1,200}$`);

if (!HEADER.test(header)) {
  const red = (s) => `\x1b[31m${s}\x1b[0m`;
  const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
  console.error(`${red('ERROR: invalid commit message header.')}

  ${header ? `Got: ${JSON.stringify(header)}` : 'The message is empty.'}

  The first line must look like one of these (a body and a footer may follow):

    feat(compiler): add 'comments' option
    fix(modal): handle events on blur (close #28)

  ${yellow('See .github/commit-convention.md for more details.')}
`);
  process.exit(1);
}
