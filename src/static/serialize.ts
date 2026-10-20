import type { DOMOutputSpec } from '@tiptap/pm/model';

const TEXT_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };
const ATTR_ESCAPES: Record<string, string> = { ...TEXT_ESCAPES, '"': '&quot;' };

/** Escapes text for an HTML text node. */
export function escapeText(text: string): string {
  return text.replace(/[&<>]/g, (ch) => TEXT_ESCAPES[ch] ?? ch);
}

/** Escapes text for a double-quoted HTML attribute value. */
export function escapeAttr(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ATTR_ESCAPES[ch] ?? ch);
}

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

/** Attribute names that could run script or load from an unchecked URL scheme. */
const UNSAFE_ATTR = /^on/i;
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'poster', 'xlink:href']);
const SAFE_URL =
  /^(?:https?:|mailto:|tel:|data:image\/(?:png|gif|jpe?g|webp|avif|svg\+xml);|\/|\.\/|\.\.\/|#|\?)/i;

/** `true` for a URL that is safe to put in `href` / `src` of published HTML. */
export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  // relative URLs without a scheme are fine; anything with a scheme must be on the list
  return SAFE_URL.test(trimmed) || !/^[a-z][a-z0-9+.-]*:/i.test(trimmed);
}

/** CSS properties document attributes may set (text style, alignment, sizes, image transforms). */
const STYLE_PROPS = new Set([
  'color',
  'background',
  'background-color',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-indent',
  'text-decoration',
  'direction',
  'vertical-align',
  'white-space',
  'width',
  'height',
  'min-width',
  'max-width',
  'max-height',
  'margin',
  'margin-left',
  'margin-right',
  'padding-left',
  'display',
  'float',
  'transform',
  'aspect-ratio',
  'border',
  'border-collapse',
  'border-spacing',
]);
const STYLE_VALUE = /^[\w\s#.,%()+\-/'"!]*$/;

/**
 * Keeps the declarations of a `style` attribute that a document may carry: known properties with
 * plain values (no `url()`, no expressions). A value smuggled into an attribute
 * (`textAlign: "center; position: fixed"`) cannot restyle the page around the article.
 */
export function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .map((decl) => {
      const at = decl.indexOf(':');
      if (at < 0) return '';
      const prop = decl.slice(0, at).trim().toLowerCase();
      const value = decl.slice(at + 1).trim();
      if (
        !STYLE_PROPS.has(prop) ||
        !value ||
        !STYLE_VALUE.test(value) ||
        /url\s*\(|expression|javascript:/i.test(value)
      )
        return '';
      return `${prop}: ${value}`;
    })
    .filter(Boolean)
    .join('; ');
}

/** Renders an attribute object (the second slot of a DOMOutputSpec) as ` a="b"` pairs. */
export function attrsToHTML(attrs: Record<string, unknown> | null | undefined): string {
  if (!attrs) return '';
  let out = '';
  for (const [rawName, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    // `ns attr` (namespaced attributes) keep the local part only
    const name = rawName.includes(' ') ? rawName.slice(rawName.indexOf(' ') + 1) : rawName;
    if (!/^[a-zA-Z_:][-a-zA-Z0-9_:.]*$/.test(name) || UNSAFE_ATTR.test(name)) continue;
    let text = Array.isArray(value) ? value.join(',') : String(value);
    if (URL_ATTRS.has(name.toLowerCase()) && !isSafeUrl(text)) continue;
    if (name.toLowerCase() === 'style') {
      text = sanitizeStyle(text);
      if (!text) continue;
    }
    out += value === true ? ` ${name}` : ` ${name}="${escapeAttr(text)}"`;
  }
  return out;
}

export interface Element {
  /** Opening tag, e.g. `<div class="x">`. */
  open: string;
  /** Closing tag (empty for void elements). */
  close: string;
}

/**
 * Serializes a ProseMirror `DOMOutputSpec` to an HTML string without a DOM.
 * `hole` replaces the content hole (`0`); a spec with no hole ignores it.
 */
export function specToHTML(spec: DOMOutputSpec, hole = ''): string {
  if (typeof spec === 'string') return escapeText(spec);
  if (!Array.isArray(spec)) {
    // A live DOM node (only possible in a browser): take its markup as is.
    const node = spec as unknown as { outerHTML?: string; dom?: { outerHTML?: string } };
    return node.outerHTML ?? node.dom?.outerHTML ?? '';
  }
  const [rawTag, ...rest] = spec as unknown as [string, ...unknown[]];
  const tag = rawTag.includes(' ') ? rawTag.slice(rawTag.indexOf(' ') + 1) : rawTag;
  let attrs: Record<string, unknown> | undefined;
  let children = rest;
  const first = rest[0];
  if (
    first &&
    typeof first === 'object' &&
    !Array.isArray(first) &&
    !(first as { nodeType?: number }).nodeType
  ) {
    attrs = first as Record<string, unknown>;
    children = rest.slice(1);
  }
  const open = `<${tag}${attrsToHTML(attrs)}>`;
  if (VOID.has(tag)) return open;
  const inner = children
    .map((child) => (child === 0 ? hole : specToHTML(child as DOMOutputSpec, hole)))
    .join('');
  return `${open}${inner}</${tag}>`;
}

/** Splits a mark's spec into an opening and closing tag pair around its hole. */
export function specToWrapper(spec: DOMOutputSpec): Element {
  const marker = '\u0000HOLE\u0000';
  const html = specToHTML(spec, marker);
  const at = html.indexOf(marker);
  if (at < 0) return { open: html, close: '' };
  return { open: html.slice(0, at), close: html.slice(at + marker.length) };
}
