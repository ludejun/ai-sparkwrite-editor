import { Extension, Node, mergeAttributes } from '@tiptap/core';

import type { ButtonViewParams, GeneralOptions } from '@/types';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';

/**
 * Styled blocks: magazine-style looks for headings, quotes and a `card`
 * container, the kind long-form articles (WeChat official accounts, blogs)
 * are laid out with. Each look is a named `variant` stored on the node, so
 * documents stay plain headings / quotes / cards that every exporter
 * understands; the look itself is CSS (`sn-h--*`, `sn-quote--*`,
 * `sn-box--*`) or, for inline-style targets, a serializer keyed by the same
 * names. Accent colour: `--sn-accent` (default purple).
 */

export const HEADING_STYLES = ['pill', 'bar', 'underline', 'ornament', 'step', 'tag'] as const;
export const QUOTE_STYLES = ['card', 'center', 'line', 'paper'] as const;
export const CARD_STYLES = [
  'soft',
  'outline',
  'shadow',
  'accent',
  'ticket',
  'tip',
  'warn',
  'ask',
  'answer',
  'end',
  'dark',
  'stat',
] as const;

export type HeadingStyle = (typeof HEADING_STYLES)[number];
export type QuoteStyle = (typeof QUOTE_STYLES)[number];
export type CardStyle = (typeof CARD_STYLES)[number];

/** The node types a block style applies to, with their class prefix. */
export const STYLED_TYPES = {
  heading: { prefix: 'sn-h', styles: HEADING_STYLES },
  blockquote: { prefix: 'sn-quote', styles: QUOTE_STYLES },
  card: { prefix: 'sn-box', styles: CARD_STYLES },
} as const;

export type StyledType = keyof typeof STYLED_TYPES;

const VARIANT_RE = /^[a-z0-9-]{1,24}$/;

/** A variant name safe to put in a class, or `null`. */
export function cleanVariant(value: unknown): string | null {
  return typeof value === 'string' && VARIANT_RE.test(value) ? value : null;
}

/** Reads a variant back from `data-variant` or a `prefix--name` class. */
function readVariant(element: HTMLElement, prefix: string): string | null {
  const data = cleanVariant(element.getAttribute('data-variant'));
  if (data) return data;
  const match = Array.from(element.classList).find((name) => name.startsWith(`${prefix}--`));
  return match ? cleanVariant(match.slice(prefix.length + 2)) : null;
}

/** The innermost node of `type` around the selection, with its position. */
export function findStyledAncestor(
  state: EditorState,
  type: StyledType
): { node: PMNode; pos: number } | null {
  const { $from } = state.selection;
  const selected = 'node' in state.selection ? (state.selection as { node: PMNode }).node : null;
  if (selected?.type.name === type) return { node: selected, pos: state.selection.from };
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === type) return { node, pos: $from.before(depth) };
  }
  return null;
}

/** Which styled block the selection is in, innermost first: card, quote or heading. */
export function activeStyledBlock(
  state: EditorState
): { type: StyledType; variant: string | null; label: string | null } | null {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    const name = node.type.name;
    if (name === 'heading' || name === 'blockquote' || name === 'card') {
      return {
        type: name,
        variant: (node.attrs.variant as string | null) ?? null,
        label: (node.attrs.label as string | null) ?? null,
      };
    }
  }
  return null;
}

export interface BlockStylesOptions {
  /** Node types that get a `variant` attribute. */
  types: string[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockStyles: {
      /**
       * Sets (or clears, with `null`) the look of the heading / quote / card
       * around the selection.
       */
      setBlockVariant: (type: StyledType, variant: string | null) => ReturnType;
    };
    card: {
      /** Wraps the selected blocks in a card. */
      setCard: (attrs?: { variant?: string; label?: string | null }) => ReturnType;
      /** Wraps in a card, or lifts the selection out of the card it is in. */
      toggleCard: (attrs?: { variant?: string; label?: string | null }) => ReturnType;
      /** Changes the card around the selection. */
      updateCard: (attrs: { variant?: string; label?: string | null }) => ReturnType;
      /** Removes the card around the selection, keeping its content. */
      unsetCard: () => ReturnType;
    };
  }
}

/** `variant` on headings and blockquotes, rendered as `sn-h--*` / `sn-quote--*`. */
export const BlockStyles = /* @__PURE__ */ Extension.create<BlockStylesOptions>({
  name: 'blockStyles',

  addOptions() {
    return { types: ['heading', 'blockquote'] };
  },

  addGlobalAttributes() {
    return this.options.types.map((type) => {
      const prefix = STYLED_TYPES[type as StyledType]?.prefix ?? `sn-${type}`;
      return {
        types: [type],
        attributes: {
          variant: {
            default: null,
            keepOnSplit: true,
            parseHTML: (element: HTMLElement) => readVariant(element, prefix),
            renderHTML: (attrs: Record<string, unknown>) => {
              const variant = cleanVariant(attrs.variant);
              return variant
                ? { 'data-variant': variant, class: `${prefix} ${prefix}--${variant}` }
                : {};
            },
          },
        },
      };
    });
  },

  addCommands() {
    return {
      setBlockVariant:
        (type, variant) =>
        ({ state, tr, dispatch }) => {
          const found = findStyledAncestor(state, type);
          if (!found) return false;
          if (dispatch) {
            tr.setNodeMarkup(found.pos, undefined, {
              ...found.node.attrs,
              variant: variant === null ? (type === 'card' ? 'soft' : null) : cleanVariant(variant),
            });
          }
          return true;
        },
    };
  },
});

export interface CardOptions extends GeneralOptions<CardOptions> {
  HTMLAttributes: Record<string, unknown>;
  /** Looks offered in the card's style menu; order is menu order. */
  variants: string[];
  /** Look of a new card. */
  defaultVariant: string;
}

/**
 * A container block with a look (`variant`) and an optional badge (`label`):
 * a tinted box, a feature card, a time-and-place ticket, a Q&A bubble…
 * Without a node view: the React package adds the style handle.
 */
export const CardCore = /* @__PURE__ */ Node.create<CardOptions>({
  name: 'card',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,

  //@ts-expect-error
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {},
      variants: [...CARD_STYLES],
      defaultVariant: 'soft',
      button: ({ editor, t }: ButtonViewParams<CardOptions>) => ({
        componentProps: {
          action: () => editor.chain().focus().toggleCard().run(),
          isActive: () => editor.isActive('card'),
          disabled: !editor.can().toggleCard(),
          icon: 'SquareDashed',
          tooltip: t('editor.card.tooltip'),
        },
      }),
    };
  },

  addAttributes() {
    return {
      variant: {
        default: this.options.defaultVariant,
        parseHTML: (element) => readVariant(element, 'sn-box') ?? this.options.defaultVariant,
        renderHTML: () => ({}),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label') || null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="card"]' }, { tag: 'div.sn-box' }, { tag: 'section.sn-box' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const variant = cleanVariant(node.attrs.variant) ?? this.options.defaultVariant;
    const label =
      typeof node.attrs.label === 'string' && node.attrs.label ? node.attrs.label : null;
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-variant': variant,
        ...(label ? { 'data-label': label } : {}),
        class: `sn-box sn-box--${variant}`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCard:
        (attrs = {}) =>
        ({ commands }) =>
          commands.wrapIn(this.name, {
            variant: cleanVariant(attrs.variant) ?? this.options.defaultVariant,
            label: attrs.label ?? null,
          }),
      toggleCard:
        (attrs = {}) =>
        ({ editor, commands }) =>
          editor.isActive(this.name) ? commands.lift(this.name) : commands.setCard(attrs),
      updateCard:
        (attrs) =>
        ({ state, tr, dispatch }) => {
          const found = findStyledAncestor(state, 'card');
          if (!found) return false;
          if (dispatch) {
            const next = { ...found.node.attrs };
            if (attrs.variant !== undefined)
              next.variant = cleanVariant(attrs.variant) ?? this.options.defaultVariant;
            if (attrs.label !== undefined) next.label = attrs.label || null;
            tr.setNodeMarkup(found.pos, undefined, next);
          }
          return true;
        },
      unsetCard:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

export interface StyledBlocksOptions extends GeneralOptions<StyledBlocksOptions> {
  /** Options of the `card` node; `false` leaves cards out. */
  card: Partial<CardOptions> | false;
  /** Options of the heading / quote `variant` attribute; `false` leaves it out. */
  blockStyles: Partial<BlockStylesOptions> | false;
}

/**
 * Styled headings and quotes plus the `card` block, as one extension, without
 * node views (any Tiptap binding). The React package registers `StyledBlocks`.
 */
export const StyledBlocksCore = /* @__PURE__ */ Extension.create<StyledBlocksOptions>({
  name: 'styledBlocks',

  //@ts-expect-error
  addOptions() {
    return {
      ...this.parent?.(),
      card: {},
      blockStyles: {},
      button: ({ editor, t }: ButtonViewParams<StyledBlocksOptions>) => ({
        componentProps: {
          action: () => editor.chain().focus().toggleCard().run(),
          isActive: () => editor.isActive('card'),
          disabled: false,
          icon: 'BlockStyle',
          tooltip: t('editor.blockStyle.tooltip'),
        },
      }),
    };
  },

  addExtensions() {
    const list = [];
    if (this.options.blockStyles !== false)
      list.push(BlockStyles.configure(this.options.blockStyles));
    if (this.options.card !== false) list.push(CardCore.configure(this.options.card));
    return list;
  },
});
