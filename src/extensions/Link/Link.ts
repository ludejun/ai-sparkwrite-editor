import { mergeAttributes } from '@tiptap/core';
import { Link as TiptapLink, isAllowedUri } from '@tiptap/extension-link';

import { isEditorEditable } from '@/utils/editable';

import type { GeneralOptions } from '@/types';
import type { Editor } from '@tiptap/core';
import type { LinkOptions as TiptapLinkOptions } from '@tiptap/extension-link';

export interface LinkOptions extends TiptapLinkOptions, GeneralOptions<LinkOptions> {}

export interface LinkStorage {
  /** True while a link bubble's edit form is open; the text bubble stays away meanwhile. */
  editing: boolean;
  /** Opens the in-document link card; set by the link bubble while it is mounted. */
  openEditor: (() => void) | null;
  /** Opens the toolbar's link form; used for Mod-K when there is no link bubble. */
  openToolbarEditor: (() => void) | null;
}

declare module '@tiptap/core' {
  interface Storage {
    link: LinkStorage;
  }
}

const SCHEME = /^[a-z][a-z\d+.-]*:/i;
const BARE_DOMAIN = /^(?:localhost|[\w-]+(?:\.[\w-]+)*\.[a-z]{2,})(?::\d+)?(?:[/?#]|$)/i;
const BARE_EMAIL = /^[^\s@/:]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}$/i;

/**
 * What the link form stores for what was typed. Only a bare domain
 * (`example.com/x`, `localhost:3000`) gets `https://`, and a bare address
 * `mailto:`; paths (`/notes/abc`, `./a`), anchors (`#x`), queries and
 * anything with a scheme (`mailto:`, `tel:`) are kept as typed. Whether a
 * scheme is allowed at all is `isAllowedLinkHref`'s call.
 */
export function normalizeLinkHref(input: string): string {
  const href = input.trim();

  if (!href) return href;
  if (BARE_DOMAIN.test(href)) return `https://${href}`;
  if (BARE_EMAIL.test(href)) return `mailto:${href}`;

  return href;
}

function linkOptions(editor: Editor): Partial<LinkOptions> {
  return (editor.extensionManager.extensions.find((ext) => ext.name === 'link')?.options ??
    {}) as Partial<LinkOptions>;
}

/** The extension's `isAllowedUri` check, which keeps `javascript:` and the like out. */
export function isAllowedLinkHref(editor: Editor, href: string): boolean {
  const options = linkOptions(editor);
  const defaultValidate = (url: string) => !!isAllowedUri(url, options.protocols);

  if (!SCHEME.test(href)) return true;

  return options.isAllowedUri
    ? !!options.isAllowedUri(href, {
        defaultValidate,
        protocols: options.protocols ?? [],
        defaultProtocol: options.defaultProtocol ?? 'http',
      })
    : defaultValidate(href);
}

export interface LinkEdit {
  link: string;
  text?: string;
  openInNewTab?: boolean;
}

/**
 * What the toolbar form and the link bubble both run on Apply: replaces the
 * link under the caret (or the selection) with `text` linked to `link`.
 * An empty `link` removes the link. Returns false when nothing was changed.
 */
export function applyLinkEdit(editor: Editor, { link, text, openInNewTab }: LinkEdit): boolean {
  if (!isEditorEditable(editor)) return false;

  const href = normalizeLinkHref(link);

  if (!href) {
    return editor.chain().focus().extendMarkRange('link').unsetLink().run();
  }

  if (!isAllowedLinkHref(editor, href)) return false;

  // Inside a link, replace the whole link rather than the part under the caret.
  if (editor.isActive('link')) {
    editor.commands.extendMarkRange('link');
  }

  const { from, to } = editor.state.selection;
  const label = text || editor.state.doc.textBetween(from, to, ' ') || href;

  const applied = editor
    .chain()
    .insertContentAt(
      { from, to },
      {
        type: 'text',
        text: label,
        marks: [{ type: 'link', attrs: { href, target: openInNewTab ? '_blank' : null } }],
      }
    )
    .setTextSelection({ from, to: from + label.length })
    .run();

  if (applied) editor.commands.focus();

  return applied;
}

export const Link = /* @__PURE__ */ TiptapLink.extend<LinkOptions, LinkStorage>({
  inclusive: false,
  addStorage() {
    return { editing: false, openEditor: null, openToolbarEditor: null };
  },
  parseHTML() {
    return [
      {
        tag: 'a[href]:not([data-type="button"]):not([href *= "javascript:" i])',
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const allowed = this.options.isAllowedUri(HTMLAttributes.href, {
      defaultValidate: (href) => !!isAllowedUri(href, this.options.protocols),
      protocols: this.options.protocols,
      defaultProtocol: this.options.defaultProtocol,
    });

    return [
      'a',
      mergeAttributes(
        this.options.HTMLAttributes,
        // A disallowed scheme (`javascript:`) renders no href at all.
        allowed ? HTMLAttributes : { ...HTMLAttributes, href: null },
        { class: 'link' }
      ),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-k': () => {
        if (!this.editor.isEditable) return false;

        const open = this.storage.openEditor ?? this.storage.openToolbarEditor;

        if (!open) return false;

        open();
        return true;
      },
    };
  },

  //@ts-expect-error
  addOptions() {
    const parentOptions = this.parent?.() || {};
    return {
      ...parentOptions,
      openOnClick: false,
      button: ({ editor, t, extension }) => {
        return {
          componentProps: {
            action: (value: LinkEdit) => applyLinkEdit(editor, value),
            isActive: () => editor.isActive('link'),
            disabled: !editor.can().setLink({ href: '' }),
            icon: 'Link',
            shortcutKeys: extension.options.shortcutKeys ?? ['mod', 'K'],
            tooltip: t('editor.link.tooltip'),
          },
        };
      },
    };
  },

  // addProseMirrorPlugins() {
  //   return [
  //     new Plugin({
  //       key: new PluginKey(`richtextCustomPlugin${this.name}`),
  //       props: {
  //         handleClick: (view: EditorView, pos: number) => {
  //           const { schema, doc, tr } = view.state;
  //           const range = getMarkRange(doc.resolve(pos), schema.marks.link);
  //           if (!range) {
  //             return false;
  //           }

  //           // honor openOnClick setting
  //           let mark: any = null;
  //           doc.nodesBetween(range.from, range.to, (node) => {
  //             mark = node.marks.find((m) => m.type === schema.marks.link);
  //             return !mark;
  //           });
  //           if (this.options.openOnClick && mark?.attrs.href && pos !== range.to) {
  //             window.open(mark.attrs.href, mark.attrs.target || '_self');
  //             return true;
  //           }

  //           const $start = doc.resolve(range.from);
  //           const $end = doc.resolve(range.to);
  //           const transaction = tr.setSelection(
  //             new TextSelection($start, $end)
  //           );
  //           view.dispatch(transaction);
  //         },
  //       },
  //     }),
  //   ];
  // },
});
