/* oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks */
import { BubbleMenu } from '@tiptap/vue-3/menus';
import { AlignCenter, AlignLeft, AlignRight, Trash2 } from 'lucide-vue-next';
import { defineComponent, h } from 'vue';

import { deleteSelectedNode, isNodeSelected } from '@/components/Bubble/nodeSelection';
import { IMAGE_SIZE } from '@/constants';

import { useEditorState, useLocale } from '../context';
import { RichTextToolbarButton, RichTextToolbarDivider } from '../ui';

import { BUBBLE_CLASS, BUBBLE_OPTIONS, useBubbleEditor } from './shared';

import type { Editor } from '@tiptap/core';

const IMAGE_NODES = ['image', 'imageBlock'];

type ImageAlignment = 'left' | 'center' | 'right';
type ImageSize = 'size-small' | 'size-medium' | 'size-large';

const ALIGNMENTS: { value: ImageAlignment; icon: typeof AlignLeft; key: string }[] = [
  { value: 'left', icon: AlignLeft, key: 'editor.textalign.left.tooltip' },
  { value: 'center', icon: AlignCenter, key: 'editor.textalign.center.tooltip' },
  { value: 'right', icon: AlignRight, key: 'editor.textalign.right.tooltip' },
];

const SIZES: { value: ImageSize; label: string; key: string }[] = [
  { value: 'size-small', label: 'S', key: 'editor.size.small.tooltip' },
  { value: 'size-medium', label: 'M', key: 'editor.size.medium.tooltip' },
  { value: 'size-large', label: 'L', key: 'editor.size.large.tooltip' },
];

function activeImageName(editor: Editor): string {
  return editor.isActive('imageBlock') ? 'imageBlock' : 'image';
}

/** Shown when an image is selected: alignment, preset sizes, remove. */
export const RichTextBubbleImage = defineComponent({
  name: 'RichTextBubbleImage',
  setup() {
    const { t } = useLocale();
    const { editor, editable, key } = useBubbleEditor();
    const image = useEditorState(
      (current) => {
        const attrs = current.getAttributes(activeImageName(current));
        return {
          align: attrs.align as ImageAlignment | undefined,
          width: attrs.width as string | number | undefined,
        };
      },
      { align: undefined, width: undefined }
    );

    // Only for the image itself, not a range (Select All) that contains one.
    const shouldShow = ({ editor: current }: { editor: Editor }) =>
      isNodeSelected(current.state, IMAGE_NODES);

    return () => {
      const current = editor.value;
      if (!current || !editable.value) return null;

      return h(
        BubbleMenu,
        {
          key: key.value,
          editor: current,
          pluginKey: 'RichTextBubbleImage',
          shouldShow,
          options: { ...BUBBLE_OPTIONS },
        },
        () => [
          h('div', { class: BUBBLE_CLASS }, [
            ...ALIGNMENTS.map((alignment) =>
              h(RichTextToolbarButton, {
                key: alignment.value,
                icon: alignment.icon,
                tooltip: t(alignment.key),
                active: image.value.align === alignment.value,
                onClick: () => current.commands.setAlignImage(alignment.value),
              })
            ),
            h(RichTextToolbarDivider),
            ...SIZES.map((size) =>
              h(RichTextToolbarButton, {
                key: size.value,
                label: size.label,
                tooltip: t(size.key),
                active: String(image.value.width) === String(IMAGE_SIZE[size.value]),
                onClick: () => current.commands.updateImage({ width: IMAGE_SIZE[size.value] }),
              })
            ),
            h(RichTextToolbarDivider),
            h(RichTextToolbarButton, {
              icon: Trash2,
              tooltip: t('editor.remove'),
              onClick: () => deleteSelectedNode(current, IMAGE_NODES),
            }),
          ]),
        ]
      );
    };
  },
});
