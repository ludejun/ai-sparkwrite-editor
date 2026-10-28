import {
  Details as TiptapDetails,
  DetailsContent as TiptapDetailsContent,
  DetailsSummary as TiptapDetailsSummary,
} from '@tiptap/extension-details';

import { translate } from '@/locales/store';
import { watchEditable } from '@/utils/editable';

import type { GeneralOptions } from '@/types';
import type {
  DetailsContentOptions,
  DetailsOptions as TiptapDetailsOptions,
  DetailsSummaryOptions,
} from '@tiptap/extension-details';

export interface DetailsOptions extends TiptapDetailsOptions, GeneralOptions<DetailsOptions> {
  /**
   * Options forwarded to the nested `detailsSummary` node.
   */
  summary: Partial<DetailsSummaryOptions>;
  /**
   * Options forwarded to the nested `detailsContent` node.
   */
  content: Partial<DetailsContentOptions>;
}

export const DetailsSummary = /* @__PURE__ */ TiptapDetailsSummary.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class: 'details-summary',
      },
    };
  },
});

export const DetailsContent = /* @__PURE__ */ TiptapDetailsContent.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: {
        class: 'details-content',
      },
    };
  },
});

/**
 * Collapsible (toggle) block. Registers the `details`, `detailsSummary` and
 * `detailsContent` nodes, so only `Details` needs to be added to the editor.
 */
export const Details = /* @__PURE__ */ TiptapDetails.extend<DetailsOptions>({
  // @ts-expect-error
  addOptions() {
    return {
      ...this.parent?.(),
      persist: true,
      HTMLAttributes: {
        class: 'details',
      },
      renderToggleButton: ({
        element,
        isOpen,
      }: {
        element: HTMLButtonElement;
        isOpen: boolean;
      }) => {
        element.setAttribute(
          'aria-label',
          translate(isOpen ? 'editor.details.collapse' : 'editor.details.expand')
        );
      },
      summary: {},
      content: {},
      button: ({ editor, t, extension }) => ({
        componentProps: {
          action: () => {
            if (editor.isActive('details')) {
              editor.chain().focus().unsetDetails().run();
              return;
            }

            editor.chain().focus().setDetails().run();
          },
          isActive: () => editor.isActive('details') || false,
          disabled: false,
          icon: 'Details',
          shortcutKeys: extension.options.shortcutKeys ?? ['mod', 'alt', 'D'],
          tooltip: t('editor.details.tooltip'),
        },
      }),
    };
  },

  // While read-only a click opens or closes the block in the DOM only (the
  // document must not change). Once editable again, show the stored `open`
  // again: the upstream toggle flips the stored value, so a DOM that had
  // drifted would end up the opposite of what it shows.
  addNodeView() {
    const parent = this.parent?.();

    if (!parent) return null;

    const { openClassName } = this.options;

    return (props) => {
      const view = parent(props);
      const dom = view.dom as HTMLElement;
      let node = props.node;

      const showStoredState = () => {
        if (!this.options.persist) return;

        const open = !!node.attrs.open;

        if (dom.classList.contains(openClassName) === open) return;

        dom.classList.toggle(openClassName, open);
        dom
          .querySelector('[data-type="detailsContent"]')
          ?.dispatchEvent(new Event('toggleDetailsContent'));

        const toggle = dom.querySelector(':scope > button');

        if (toggle instanceof HTMLButtonElement) {
          this.options.renderToggleButton({ element: toggle, isOpen: open, node });
        }
      };

      const stop = watchEditable(props.editor, (editable) => editable && showStoredState());
      const update = view.update?.bind(view);
      const destroy = view.destroy?.bind(view);

      return {
        ...view,
        update: (...args: Parameters<NonNullable<typeof view.update>>) => {
          const handled = update ? update(...args) : false;
          if (handled) node = args[0];
          return handled;
        },
        destroy: () => {
          stop();
          destroy?.();
        },
      };
    };
  },

  addExtensions() {
    return [
      DetailsSummary.configure(this.options.summary),
      DetailsContent.configure(this.options.content),
    ];
  },

  addKeyboardShortcuts() {
    return {
      ...this.parent?.(),
      'Mod-Alt-d': () => {
        if (this.editor.isActive('details')) {
          return this.editor.commands.unsetDetails();
        }

        return this.editor.commands.setDetails();
      },
    };
  },
});
