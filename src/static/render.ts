import { getSchema } from '@tiptap/core';
import { DOMParser as PMDOMParser } from '@tiptap/pm/model';

import { getFileTypeIconMarkup } from '@/extensions/Attachment/fileIcon';
import { getCalloutType } from '@/extensions/Callout/calloutTypes';
import { CAPTION_CLASS } from '@/extensions/Image/caption';

import { staticExtensions } from './extensions';
import { highlightCode, tokensToHTML } from './highlight';
import {
  attrsToHTML,
  escapeAttr,
  escapeText,
  isSafeUrl,
  specToHTML,
  specToWrapper,
} from './serialize';

import type { AnyExtension, JSONContent } from '@tiptap/core';
import type { Mark, Node as PMNode, Schema } from '@tiptap/pm/model';

/** What `renderStaticHTML` needs from KaTeX (`import katex from 'katex'` satisfies it). */
export interface StaticKatex {
  renderToString(tex: string, options?: Record<string, unknown>): string;
}

export interface StaticRenderOptions {
  /** Extensions that define the schema; defaults to `staticExtensions()` (the kit's schema). */
  extensions?: AnyExtension[];
  /**
   * The `id` each heading gets (anchors / table of contents). Receives the heading text, its
   * 0-based position among all headings and its level. Default: the id stored on the node.
   */
  headingId?: (text: string, index: number, level: number) => string | null | undefined;
  /** KaTeX, to render formulas to HTML. Without it a formula shows its TeX source. */
  katex?: StaticKatex | null;
  /** Labels of the read-only controls (code copy button). */
  labels?: Partial<StaticLabels>;
  /** `loading="lazy"` on images and embeds (default `true`). */
  lazy?: boolean;
}

export interface StaticLabels {
  /** Copy button of a code block. */
  copy: string;
  /** Shown on the button after a copy. */
  copied: string;
  /** Table-of-contents block heading. */
  toc: string;
}

const DEFAULT_LABELS: StaticLabels = { copy: 'Copy', copied: 'Copied', toc: 'Contents' };

interface Ctx {
  schema: Schema;
  opts: StaticRenderOptions;
  labels: StaticLabels;
  headingIndex: number;
  headings: { id: string; level: number; text: string }[];
}

const schemaCache = new WeakMap<AnyExtension[], Schema>();
let defaultSchema: Schema | null = null;

function schemaFor(extensions: AnyExtension[] | undefined): Schema {
  if (!extensions) {
    defaultSchema ??= getSchema(staticExtensions());
    return defaultSchema;
  }
  let schema = schemaCache.get(extensions);
  if (!schema) {
    schema = getSchema(extensions);
    schemaCache.set(extensions, schema);
  }
  return schema;
}

/** The ProseMirror schema `renderStaticHTML` renders with by default (the kit's document schema). */
export function staticSchema(): Schema {
  return schemaFor(undefined);
}

/**
 * Parses HTML (a DOM node: the browser's, or jsdom's in Node) into the kit's document JSON through the
 * editor's own parse rules, as a paste would. For re-rendering stored HTML whose source document is gone.
 */
export function parseStaticHTML(dom: globalThis.Node): JSONContent {
  const schema = schemaFor(undefined);
  return PMDOMParser.fromSchema(schema).parse(dom).toJSON() as JSONContent;
}

/** Drops node and mark types the schema does not know (their content is kept), so one stray type never empties the document. */
function sanitize(json: JSONContent, schema: Schema): JSONContent[] {
  if (!json || typeof json !== 'object') return [];
  const type = typeof json.type === 'string' ? json.type : '';
  const content = Array.isArray(json.content)
    ? json.content.flatMap((child) => sanitize(child, schema))
    : undefined;
  if (!schema.nodes[type]) return content ?? [];
  const out: JSONContent = { ...json };
  if (content) out.content = content;
  if (Array.isArray(json.marks)) out.marks = json.marks.filter((m) => m && schema.marks[m.type]);
  if (type === 'text' && !json.text) return [];
  return [out];
}

function cssSize(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  if (typeof value === 'string' && /^\d+(\.\d+)?(px|%|em|rem|vw)?$/.test(value.trim())) {
    const v = value.trim();
    return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v;
  }
  return undefined;
}

function style(rules: Record<string, string | number | null | undefined>): string | undefined {
  const text = Object.entries(rules)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}: ${v}`)
    .join('; ');
  return text ? `${text};` : undefined;
}

function align(value: unknown): 'left' | 'center' | 'right' | undefined {
  return value === 'left' || value === 'center' || value === 'right' ? value : undefined;
}

/* ------------------------------------------------------------------------ */
/* inline content with marks                                                 */
/* ------------------------------------------------------------------------ */

function renderInline(node: PMNode, ctx: Ctx): string {
  let out = '';
  const active: { mark: Mark; close: string }[] = [];
  node.forEach((child) => {
    const marks = child.marks;
    let keep = 0;
    while (keep < Math.min(active.length, marks.length) && marks[keep]!.eq(active[keep]!.mark))
      keep++;
    while (active.length > keep) out += active.pop()!.close;
    for (let i = keep; i < marks.length; i++) {
      const mark = marks[i]!;
      const toDOM = mark.type.spec.toDOM;
      const wrap = toDOM ? specToWrapper(toDOM(mark, true)) : { open: '', close: '' };
      out += wrap.open;
      active.push({ mark, close: wrap.close });
    }
    out += child.isText ? escapeText(child.text ?? '') : renderNode(child, ctx);
  });
  while (active.length) out += active.pop()!.close;
  return out;
}

function renderChildren(node: PMNode, ctx: Ctx): string {
  if (node.inlineContent) return renderInline(node, ctx);
  let out = '';
  node.forEach((child) => {
    out += renderNode(child, ctx);
  });
  return out;
}

function defaultNode(node: PMNode, ctx: Ctx): string {
  const toDOM = node.type.spec.toDOM;
  if (!toDOM) return renderChildren(node, ctx);
  return specToHTML(toDOM(node), node.isLeaf ? '' : renderChildren(node, ctx));
}

/* ------------------------------------------------------------------------ */
/* static node views: the DOM the editor's read-only node views produce      */
/* ------------------------------------------------------------------------ */

const ICON_ATTRS =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const COPY_ICON = `<svg ${ICON_ATTRS} width="14" height="14"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
const CHECK_ICON = `<svg ${ICON_ATTRS} width="14" height="14"><path d="M20 6 9 17l-5-5"/></svg>`;

/** Lucide icons of the callout kinds (same as the node views). */
const CALLOUT_ICONS: Record<string, string> = {
  note: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  important:
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  caution:
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
};
const CALLOUT_BOX: Record<string, string> = {
  note: 'richtext-border-[#1f6feb] richtext-bg-[#1f6feb1f]',
  tip: 'richtext-border-[#238636] richtext-bg-[#2386361f]',
  important: 'richtext-border-[#ab7df8] richtext-bg-[#ab7df81f]',
  warning: 'richtext-border-[#d29922] richtext-bg-[#d299221f]',
  caution: 'richtext-border-[#f85149] richtext-bg-[#f851491f]',
};
const CALLOUT_HEADER: Record<string, string> = {
  note: 'richtext-text-[#1f6feb]',
  tip: 'richtext-text-[#238636]',
  important: 'richtext-text-[#ab7df8]',
  warning: 'richtext-text-[#d29922]',
  caution: 'richtext-text-[#f85149]',
};

function codeBlock(node: PMNode, ctx: Ctx): string {
  const code = node.textContent;
  const hl = highlightCode(code, node.attrs.language);
  const lines = code.split('\n').length;
  const gutter = Array.from({ length: lines }, (_, i) => `<span>${i + 1}</span>`).join('');
  const { copy, copied } = ctx.labels;
  return (
    `<div class="richtext-code-block" data-language="${escapeAttr(hl.language)}">` +
    `<pre class="shj"><code class="language-${escapeAttr(hl.language)}">${tokensToHTML(hl.tokens)}</code></pre>` +
    `<div aria-hidden="true" class="richtext-code-block__gutter">${gutter}</div>` +
    `<div class="richtext-code-block__toolbar">` +
    `<span class="richtext-code-block__lang">${escapeText(hl.label)}</span>` +
    // Hidden until a script can copy (`enhanceArticle`); the static page never shows a dead button.
    `<button type="button" class="richtext-code-block__copy" data-sn-copy data-copied-label="${escapeAttr(copied)}" aria-label="${escapeAttr(copy)}" title="${escapeAttr(copy)}" hidden>${COPY_ICON}${CHECK_ICON}</button>` +
    `</div></div>`
  );
}

/** `image` / `imageBlock` / `imageGif`: the ImageView DOM (no handles, the caption as text). */
function image(node: PMNode, ctx: Ctx): string {
  const a = node.attrs;
  const src = typeof a.src === 'string' ? a.src : '';
  if (!src) return '';
  const block = node.type.name !== 'image';
  const isInline = !block && (a.inline === true || a.inline === 'true');
  const al = align(a.align);
  const inlineFloat = isInline && (al === 'left' || al === 'right');
  const width = cssSize(a.width);
  const height = cssSize(a.height);
  const rotate = Number(a.rotate) || 0;
  const transforms = [
    a.flipX ? 'rotateX(180deg)' : '',
    a.flipY ? 'rotateY(180deg)' : '',
    rotate ? `rotate(${rotate}deg)` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const full = width === '100%';
  const wrapperTag = block ? 'figure' : 'span';
  const wrapper = style({
    float: inlineFloat ? al : undefined,
    margin: inlineFloat ? (al === 'left' ? '1em 1em 1em 0' : '1em 0 1em 1em') : undefined,
    display: isInline ? 'inline' : 'block',
    textAlign: inlineFloat ? undefined : al,
    width: full ? '100%' : undefined,
  });
  const caption = block && typeof a.caption === 'string' && a.caption.trim() ? a.caption : null;
  const img = `<img${attrsToHTML({
    class: 'image-view__body__image block',
    src,
    alt: a.alt || caption || '',
    title: a.title || undefined,
    loading: ctx.opts.lazy === false ? undefined : 'lazy',
    decoding: 'async',
    style: style({ width, height: height ?? undefined, transform: transforms || 'none' }),
  })}>`;
  const body = `<span class="image-view__body"${full ? ' style="width: 100%;"' : ''}>${img}</span>`;
  const cap = caption
    ? `<${block ? 'figcaption' : 'span'} class="${CAPTION_CLASS}"${al ? ` style="text-align: ${al};"` : ''}>${escapeText(caption)}</${block ? 'figcaption' : 'span'}>`
    : '';
  return `<${wrapperTag} class="image-view" data-type="${node.type.name}"${wrapper ? ` style="${wrapper}"` : ''}>${body}${cap}</${wrapperTag}>`;
}

/** Mermaid diagrams are stored as an image (`src`) with the source in `alt`. */
function mermaid(node: PMNode, ctx: Ctx): string {
  const a = node.attrs;
  const src = typeof a.src === 'string' ? a.src : '';
  if (!src) return '';
  const al = align(a.align) ?? 'center';
  return (
    `<div class="image-view" data-type="mermaid" style="width: 100%; text-align: ${al};">` +
    `<div class="image-view__body" style="background: rgb(255, 255, 255);">` +
    `<img${attrsToHTML({
      class: 'image-view__body__image block',
      src,
      alt: a.alt || '',
      loading: ctx.opts.lazy === false ? undefined : 'lazy',
      decoding: 'async',
      style: style({ width: cssSize(a.width), height: cssSize(a.height) }),
    })}>` +
    `</div></div>`
  );
}

/** Tables: Tiptap's `TableView` wrapper and column group, so resized widths survive. */
function table(node: PMNode, ctx: Ctx): string {
  const cellMinWidth = 25;
  const first = node.firstChild;
  let total = 0;
  let fixed = true;
  const cols: string[] = [];
  first?.forEach((cell) => {
    const span = Number(cell.attrs.colspan) || 1;
    const widths = Array.isArray(cell.attrs.colwidth) ? (cell.attrs.colwidth as number[]) : [];
    for (let i = 0; i < span; i++) {
      const w = widths[i];
      if (typeof w === 'number' && w > 0) {
        total += w;
        cols.push(`<col style="width: ${w}px;">`);
      } else {
        fixed = false;
        total += cellMinWidth;
        cols.push(`<col style="min-width: ${cellMinWidth}px;">`);
      }
    }
  });
  const width = fixed && total ? `width: ${total}px;` : `min-width: ${total}px;`;
  return `<div class="tableWrapper"><table style="${width}"><colgroup>${cols.join('')}</colgroup><tbody>${renderChildren(node, ctx)}</tbody></table></div>`;
}

function taskItem(node: PMNode, ctx: Ctx): string {
  const checked = node.attrs.checked === true;
  return (
    `<li class="task-list-item" data-checked="${checked}" data-type="taskItem">` +
    // not `disabled`: that greys the box out, while the editor shows it in its normal checked colours
    `<label><input type="checkbox" tabindex="-1" aria-readonly="true"${checked ? ' checked' : ''}><span></span></label>` +
    `<div>${renderChildren(node, ctx)}</div></li>`
  );
}

function decode(value: unknown): string {
  const text = typeof value === 'string' ? value : '';
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function katex(node: PMNode, ctx: Ctx): string {
  const tex = decode(node.attrs.text);
  if (!tex.trim()) return '';
  let html: string | null = null;
  if (ctx.opts.katex) {
    try {
      const macros = decode(node.attrs.macros);
      html = ctx.opts.katex.renderToString(tex, {
        throwOnError: false,
        ...(macros ? { macros: JSON.parse(macros) as Record<string, string> } : {}),
      });
    } catch {
      html = null;
    }
  }
  return html === null
    ? `<span class="katex-node katex-node--source" style="display: inline-block;">${escapeText(tex)}</span>`
    : `<span class="katex-node" style="display: inline-block;">${html}</span>`;
}

/** Callout `body` is HTML the editor shows as is; published pages keep simple inline formatting only. */
function safeInlineHTML(html: string): string {
  return escapeText(html.replace(/&nbsp;/g, ' ')).replace(
    /&lt;(\/?)(b|strong|i|em|u|s|code|br)\s*\/?&gt;/gi,
    (_, slash: string, tag: string) => `<${slash}${tag.toLowerCase()}>`
  );
}

function callout(node: PMNode): string {
  const type = String(node.attrs.type || 'note');
  const known = getCalloutType(type).value;
  const title = String(node.attrs.title ?? '');
  const body = String(node.attrs.body ?? '');
  const box = [
    'richtext-relative richtext-my-4 richtext-rounded-lg richtext-border richtext-p-4',
    CALLOUT_BOX[type],
  ]
    .filter(Boolean)
    .join(' ');
  const header = [
    'richtext-mb-2 richtext-flex richtext-items-center richtext-gap-2',
    CALLOUT_HEADER[type],
  ]
    .filter(Boolean)
    .join(' ');
  return (
    `<div class="callout" data-type="callout" data-callout="${escapeAttr(type)}"><div class="${box}">` +
    `<div class="${header}"><svg ${ICON_ATTRS} width="24" height="24" class="richtext-size-5">${CALLOUT_ICONS[known]}</svg>` +
    `<span class="richtext-font-semibold">${escapeText(title)}</span></div>` +
    (body
      ? `<p class="richtext-whitespace-pre-wrap richtext-pl-[28px]">${safeInlineHTML(body)}</p>`
      : '') +
    `</div></div>`
  );
}

/** Native `<details>`: opens and closes without a script (static export, feeds). */
function details(node: PMNode, ctx: Ctx): string {
  let summary = '';
  let content = '';
  node.forEach((child) => {
    if (child.type.name === 'detailsSummary') summary = renderInline(child, ctx);
    else if (child.type.name === 'detailsContent') content = renderChildren(child, ctx);
  });
  return (
    `<details class="details" data-type="details"${node.attrs.open ? ' open' : ''}>` +
    `<summary class="details-summary">${summary}</summary>` +
    `<div class="details-content" data-type="detailsContent">${content}</div></details>`
  );
}

function iframe(node: PMNode, ctx: Ctx): string {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  if (!/^https:\/\//i.test(src)) return '';
  const w = Number(node.attrs.width) || 600;
  const h = Number(node.attrs.height) || 300;
  return (
    `<div class="sn-embed" data-type="iframe"${node.attrs.service ? ` data-service="${escapeAttr(String(node.attrs.service))}"` : ''} style="width: ${w}px; max-width: 100%; aspect-ratio: ${w} / ${h};">` +
    `<div class="render-wrapper"><iframe${attrsToHTML({
      src,
      loading: ctx.opts.lazy === false ? undefined : 'lazy',
      allowfullscreen: node.attrs.allowfullscreen !== false,
      referrerpolicy: 'strict-origin-when-cross-origin',
      sandbox: 'allow-scripts allow-same-origin allow-popups allow-presentation',
      frameborder: '0',
    })}></iframe></div></div>`
  );
}

function video(node: PMNode): string {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  if (!src || !isSafeUrl(src)) return '';
  const al = align(node.attrs.align) ?? 'center';
  const width = cssSize(node.attrs.width);
  return `<div class="sn-video" data-type="video" style="text-align: ${al};"><video controls preload="metadata" src="${escapeAttr(src)}" style="${style({ width, maxWidth: '100%' })}"></video></div>`;
}

function formatSize(bytes: unknown): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

function attachment(node: PMNode): string {
  const url = typeof node.attrs.url === 'string' ? node.attrs.url : '';
  if (!url || !isSafeUrl(url)) return '';
  const name = String(node.attrs.fileName ?? 'file');
  const size = formatSize(node.attrs.fileSize);
  return (
    `<a class="sn-attachment" data-type="attachment" href="${escapeAttr(url)}" download target="_blank" rel="noopener">` +
    `<span class="sn-attachment__icon">${getFileTypeIconMarkup(node.attrs.fileType)}</span>` +
    `<span class="sn-attachment__name">${escapeText(name)}</span>` +
    (size ? `<span class="sn-attachment__size">${escapeText(size)}</span>` : '') +
    `</a>`
  );
}

function tocNode(ctx: Ctx): string {
  if (!ctx.headings.length) return '';
  const items = ctx.headings
    .map(
      (h) =>
        `<li class="toc-level-${h.level}"><a href="#${escapeAttr(h.id)}">${escapeText(h.text)}</a></li>`
    )
    .join('');
  return `<nav class="sn-toc" data-type="tableOfContents" aria-label="${escapeAttr(ctx.labels.toc)}"><ul>${items}</ul></nav>`;
}

function headingId(node: PMNode, ctx: Ctx): string | null {
  const index = ctx.headingIndex++;
  const custom = ctx.opts.headingId?.(
    node.textContent.trim(),
    index,
    Number(node.attrs.level) || 1
  );
  if (custom) return custom;
  const stored = node.attrs.id ?? node.attrs['data-toc-id'];
  return typeof stored === 'string' && stored ? stored : null;
}

function heading(node: PMNode, ctx: Ctx): string {
  const toDOM = node.type.spec.toDOM!;
  const spec = toDOM(node) as unknown as [string, Record<string, unknown>, ...unknown[]];
  const id = headingId(node, ctx);
  const attrs = { ...(spec[1] ?? {}), id, 'data-toc-id': null };
  return specToHTML([spec[0], attrs, 0] as never, renderInline(node, ctx));
}

function renderNode(node: PMNode, ctx: Ctx): string {
  switch (node.type.name) {
    case 'codeBlock':
      return codeBlock(node, ctx);
    case 'image':
    case 'imageBlock':
    case 'imageGif':
      return image(node, ctx);
    case 'mermaid':
      return mermaid(node, ctx);
    case 'table':
      return table(node, ctx);
    case 'taskItem':
      return taskItem(node, ctx);
    case 'katex':
      return katex(node, ctx);
    case 'callout':
      return callout(node);
    case 'details':
      return details(node, ctx);
    case 'iframe':
      return iframe(node, ctx);
    case 'video':
      return video(node);
    case 'attachment':
      return attachment(node);
    case 'tableOfContentsNode':
      return tocNode(ctx);
    case 'heading':
      return heading(node, ctx);
    default:
      return defaultNode(node, ctx);
  }
}

/** Headings in document order with the ids `renderStaticHTML` gives them. */
function collectHeadings(doc: PMNode, ctx: Ctx): Ctx['headings'] {
  const probe: Ctx = { ...ctx, headingIndex: 0 };
  const out: Ctx['headings'] = [];
  doc.descendants((node) => {
    if (node.type.name !== 'heading') return true;
    const id = headingId(node, probe);
    if (id) out.push({ id, level: Number(node.attrs.level) || 1, text: node.textContent.trim() });
    return false;
  });
  return out;
}

/**
 * Renders a Tiptap document to the HTML the editor shows in read-only mode:
 * the editor's own schema and `renderHTML`, the DOM of its node views (code
 * blocks with the highlighter's token classes and line numbers, image views
 * with size / alignment / caption, tables with their column widths, task
 * items, callouts, formulas…) and no editing controls. Style it with
 * `ai-sparkwrite-editor/content.css` inside a `.sn-article` element.
 *
 * Pure and DOM-free (works in Node). Unknown node and mark types are dropped,
 * their content kept.
 */
export function renderStaticHTML(
  json: JSONContent | null | undefined,
  options: StaticRenderOptions = {}
): string {
  const schema = schemaFor(options.extensions);
  const [clean] = sanitize(json ?? { type: 'doc', content: [] }, schema);
  if (!clean) return '';
  const root = clean.type === 'doc' ? clean : { type: 'doc', content: [clean] };
  let doc: PMNode;
  try {
    doc = schema.nodeFromJSON(root);
  } catch {
    return '';
  }
  const ctx: Ctx = {
    schema,
    opts: options,
    labels: { ...DEFAULT_LABELS, ...options.labels },
    headingIndex: 0,
    headings: [],
  };
  ctx.headings = collectHeadings(doc, ctx);
  const parts: string[] = [];
  doc.forEach((child) => {
    parts.push(renderNode(child, ctx));
  });
  return parts.filter(Boolean).join('\n');
}
