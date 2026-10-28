import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { version } from '../../package.json';

import type { SiteConfig } from 'vitepress';

const docsLink = 'https://ludejun.github.io/ai-sparkwrite-editor';

/** Every English Markdown page of the docs, in sidebar-ish order (guide first, then extensions). */
async function collectPages(srcDir: string): Promise<string[]> {
  const files: string[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'zh')
        continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else if (entry.name.endsWith('.md')) files.push(path);
    }
  }
  await walk(srcDir);
  const rank = (file: string) => {
    const rel = relative(srcDir, file);
    if (rel === 'index.md') return 0;
    if (rel.startsWith('guide/getting-started')) return 1;
    if (rel.startsWith('guide/kit')) return 2;
    if (rel.startsWith('guide/')) return 3;
    if (rel.startsWith('extensions/AI/')) return 4;
    return 5;
  };
  return files.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

function frontmatter(source: string): { body: string; data: Record<string, string> } {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!match) return { body: source, data: {} };
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const pair = /^(\w+):\s*(.+)$/.exec(line);
    if (pair) data[pair[1]] = pair[2].trim();
  }
  return { body: source.slice(match[0].length), data };
}

function pageUrl(srcDir: string, file: string): string {
  const rel = relative(srcDir, file)
    .replace(/\\/g, '/')
    .replace(/index\.md$/, '')
    .replace(/\.md$/, '');
  return `${docsLink}/${rel}`;
}

function title(body: string, fallback: string): string {
  const heading = /^#\s+(.+)$/m.exec(body);
  return heading ? heading[1].trim() : fallback;
}

/**
 * Writes `llms.txt` (an index of every page with its description) and
 * `llms-full.txt` (every English page concatenated) into the built site, so
 * an AI coding agent can read the whole documentation from one URL.
 */
export async function writeLlmsFiles(config: SiteConfig): Promise<void> {
  const pages = await collectPages(config.srcDir);
  const index: string[] = [];
  const full: string[] = [];

  for (const file of pages) {
    const source = await readFile(file, 'utf8');
    const { body, data } = frontmatter(source);
    if (data.layout === 'home') continue;
    const url = pageUrl(config.srcDir, file);
    const name = title(body, relative(config.srcDir, file));
    index.push(`- [${name}](${url})${data.description ? `: ${data.description}` : ''}`);
    full.push(`<!-- source: ${url} -->\n\n${body.trim()}\n`);
  }

  const header = [
    '# ai-sparkwrite-editor',
    '',
    '> AI-first rich-text editor SDK on Tiptap for React and Vue: the model writes into the document as real nodes. `RichTextKit` is the whole editor as one extension; every feature is also importable on its own. AI goes through one backend URL (`endpoint`); uploads are app-provided callbacks returning durable URLs; real-time collaboration runs on Yjs over any transport (`YSyncProvider`, `collaborationKitOptions`).',
    '',
    `Docs: ${docsLink}/ · Repository: https://github.com/ludejun/ai-sparkwrite-editor · npm: ai-sparkwrite-editor ${version}`,
    '',
    'For coding agents: the repository ships a skill at `skills/ai-sparkwrite-editor/SKILL.md` (also inside the npm package) with integration rules, the AI backend contract and upload recipes. The complete documentation in one file: `llms-full.txt` next to this one.',
    '',
    '## Pages',
    '',
  ];

  await writeFile(join(config.outDir, 'llms.txt'), `${header.join('\n')}${index.join('\n')}\n`);
  await writeFile(
    join(config.outDir, 'llms-full.txt'),
    `${header.slice(0, 5).join('\n')}\n\n${full.join('\n---\n\n')}`
  );
}
