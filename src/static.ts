/**
 * Read-only rendering without an editor: a Tiptap document → the HTML the
 * editor shows (same schema, same node-view DOM, same highlighter token
 * classes), for published pages, feeds and server-side rendering. Pure and
 * DOM-free, so it runs in Node as well as in the browser. Style the output
 * with `ai-sparkwrite-editor/content.css` inside a `.sn-article` element.
 *
 * Like `core`, nothing reachable from here imports React.
 */
export { parseStaticHTML, renderStaticHTML, staticSchema } from '@/static/render';
export type { StaticKatex, StaticLabels, StaticRenderOptions } from '@/static/render';
export { staticExtensions } from '@/static/extensions';
export { highlightCode, tokensToHTML } from '@/static/highlight';
export type { CodeToken, HighlightResult } from '@/static/highlight';
export { escapeAttr, escapeText, isSafeUrl, sanitizeStyle, specToHTML } from '@/static/serialize';
export { CODE_THEME } from '@/theme/codeTheme';
export { loadKatex, loadKatexStyles } from '@/extensions/Katex/katex-loader';
export type { KatexRenderer } from '@/extensions/Katex/katex-loader';
// GitHub-flavoured Markdown → HTML (marked), e.g. to preview what a Markdown platform will show
export { markdownToHTML } from '@/extensions/AI/markdown';
