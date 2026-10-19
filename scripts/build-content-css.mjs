/**
 * Builds `lib/content.css`: the editor's content styles for a read-only
 * document rendered outside the editor (`renderStaticHTML`), scoped to
 * `.sn-article`.
 *
 * Source: the compiled `lib/style.css` (so Tailwind `@apply`s are resolved and
 * every value is exactly what the editor ships). Rules about the document
 * (`.ProseMirror …`, the node-view classes, the highlighter tokens, the
 * Tailwind utilities the static node views reuse) are kept and re-scoped;
 * editing chrome (selection, placeholders, drag handles, menus, resize
 * handles, collaboration carets) is dropped. The theme variables the editor
 * injects at runtime (`ThemeColorReactive`) are written out for light, and
 * for dark under `[data-theme='dark']` / `.is-dark`. `src/styles/content-static.css` (the
 * static-only bits: copy button, native <details>, embeds) is appended.
 *
 *   node scripts/build-content-css.mjs      # after `vite build`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(root, 'lib');
const SCOPE = '.sn-article';
/** Dark mode of the page around the article: an explicit `data-theme="dark"` or an `is-dark` class on an ancestor. */
const DARK = ":is([data-theme='dark'], .is-dark)";

/** Editing-only selectors: never part of a read-only document. */
const EDITOR_ONLY =
  /ProseMirror-|::selection|\[contenteditable|:focus|is-empty|is-editor-empty|placeholder|search-result|collaboration|caret|drag|dragging|selectedCell|selected|column-resize|resize|has-focus|react-renderer|node-view|__toolbar\[data-open|data-state|__handle|tippy|bubble|slash|ai-|richtext-ai|menu|popover|data-richtext-portal|\.is-open|\.details>button|\.details > button|hover-|__gutter-active|uploading|loading|-error|ghost|suggest|mention|\.cursor/i;

/** Classes the static node views emit that the editor styles outside `.ProseMirror`. */
const NODE_VIEW_CLASSES =
  /^\.(shj|richtext-code-block|divider|sn-box|sn-quote|sn-h|notice|columns|column|image-view|tableWrapper|details)(?:[-_][\w-]*)?(?![\w-])/;

/** Tailwind utilities the static node views reuse (collected from their source). */
function staticUtilities() {
  const dir = path.join(root, 'src/static');
  const found = new Set();
  for (const file of fs.readdirSync(dir)) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    for (const m of source.matchAll(/richtext-[\w\-[\]#/.%]+/g))
      found.add(m[0].replace(/[.]$/, ''));
  }
  return found;
}

/** `.richtext-p-4` / `.richtext-bg-\[\#1f6feb1f\]` → the class name it selects. */
function utilityClass(selector) {
  const m = selector.match(/^\.((?:\\.|[\w-])+)$/);
  return m ? m[1].replace(/\\(.)/g, '$1') : null;
}

/** `.sn-article` repeated `n` times: the same specificity as the `n` classes it replaces. */
const scopeOf = (n) => SCOPE.repeat(Math.max(1, n));
/** The scope without specificity, for selectors that had no scope class in the editor. */
const LOOSE = `:where(${SCOPE})`;

/**
 * Re-scopes one selector so the cascade stays the editor's: `.sparkwrite .ProseMirror x` keeps its two classes
 * (`.sn-article.sn-article x`), `.ProseMirror x` its one, and unscoped rules (utilities, node-view classes) gain
 * no specificity (`:where(.sn-article) .x`). With the reset appended last, as the editor injects it, every
 * property resolves exactly as it does in the editor.
 */
function rescope(selector, utilities) {
  let s = selector.trim();
  if (EDITOR_ONLY.test(s)) return null;
  const utility = utilityClass(s);
  if (utility && utility.startsWith('richtext-'))
    return utilities.has(utility) ? `${LOOSE} ${s}` : null;
  if (s === ':root') return SCOPE;
  s = s
    .replace(/\.sparkwrite \.ProseMirror((?:\.ProseMirror)*)/g, (_, more) =>
      scopeOf(2 + more.length / '.ProseMirror'.length)
    )
    .replace(/\.ProseMirror((?:\.ProseMirror)*)/g, (_, more) =>
      scopeOf(1 + more.length / '.ProseMirror'.length)
    )
    .replace(/\[class~=dark\]/g, DARK)
    .replace(/(^|[\s(,])\.dark(?=[\s:.)]|$)/g, `$1${DARK}`);
  if (/\.sparkwrite|\.richtext-(?!code-block)/.test(s)) return null;
  if (s.includes(SCOPE)) return s;
  if (NODE_VIEW_CLASSES.test(s)) return `${LOOSE} ${s}`;
  return null;
}

function transform(css, utilities) {
  const ast = postcss.parse(css);
  ast.walkAtRules((at) => {
    if (at.name === 'font-face' || at.name === 'keyframes' || at.name === 'property') at.remove();
  });
  ast.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
    const isRootVars = rule.selector.trim() === ':root';
    if (isRootVars) {
      // the highlighter palette and the styled-block colours live on :root; Tailwind's resets stay out
      rule.walkDecls((decl) => {
        if (!/^--(shj|sn)-/.test(decl.prop)) decl.remove();
      });
      if (!rule.nodes.length) {
        rule.remove();
        return;
      }
    }
    const selectors = [
      ...new Set(rule.selectors.map((s) => rescope(s, utilities)).filter(Boolean)),
    ];
    if (!selectors.length) rule.remove();
    else rule.selectors = selectors;
  });
  // the editable root's own box (padding, min-height, focus outline, caret) is not the article's
  ast.walkRules((rule) => {
    if (!/^(\.sn-article)+$/.test(rule.selector)) return;
    rule.walkDecls((decl) => {
      if (/^(outline|min-height|padding|caret-color|z-index)$/.test(decl.prop)) decl.remove();
    });
    if (!rule.nodes.length) rule.remove();
  });
  ast.walkAtRules((at) => {
    if (at.nodes && !at.nodes.length) at.remove();
  });
  return ast.toString();
}

/**
 * The element reset the editor injects at runtime (`RESET_CSS`, nested under `.sparkwrite`):
 * images and embeds as blocks, `border-style: solid` under every utility border, table
 * defaults. Flattened and re-scoped; form controls other than the task checkbox are skipped.
 */
function resetRules() {
  const source = fs.readFileSync(path.join(root, 'src/constants/resetCSS.ts'), 'utf8');
  const css = source.slice(source.indexOf('`') + 1, source.lastIndexOf('`'));
  const outer = postcss.parse(css).first;
  const out = postcss.root();
  outer.each((child) => {
    if (child.type !== 'rule') return;
    const selectors = child.selectors.filter(
      (sel) => !/^(button|input|optgroup|select)\b/.test(sel.trim())
    );
    if (!selectors.length) return;
    const rule = child.clone();
    rule.selectors = selectors.map((sel) =>
      /^::/.test(sel.trim()) ? `${SCOPE} ${sel.trim()}` : `${SCOPE} ${sel.trim()}`
    );
    out.append(rule);
  });
  return out.toString();
}

function varsBlock(selector, vars) {
  const body = Object.entries(vars)
    .map(([k, v]) => `  --${k}: ${v};`)
    .join('\n');
  return `${selector} {\n${body}\n}\n`;
}

const { THEME } = await import(pathToFileURL(path.join(lib, 'theme.js')).href);
const { CODE_THEME } = await import(pathToFileURL(path.join(lib, 'static.js')).href);

const compiled = fs.readFileSync(path.join(lib, 'style.css'), 'utf8');
const content = transform(compiled, staticUtilities());
const extra = fs.readFileSync(path.join(root, 'src/styles/content-static.css'), 'utf8');

const header = `/*! ai-sparkwrite-editor content.css: the editor's document styles for read-only HTML
 * (renderStaticHTML), scoped to ${SCOPE}. Generated by scripts/build-content-css.mjs, do not edit. */\n`;
const vars =
  varsBlock(SCOPE, { ...THEME.light.default, ...CODE_THEME.light }) +
  varsBlock(`${DARK} ${SCOPE}`, { ...THEME.dark.default, ...CODE_THEME.dark });

const out = `${header}${vars}\n${content.trim()}\n\n/* the editor's injected element reset (RESET_CSS) */\n${resetRules().trim()}\n\n${extra.trim()}\n`;
fs.writeFileSync(path.join(lib, 'content.css'), out);
console.log(`lib/content.css: ${(out.length / 1024).toFixed(1)} kB`);
