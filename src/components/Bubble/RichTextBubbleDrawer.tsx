import { BubbleMenu } from '@tiptap/react/menus';
import { Fragment, useMemo } from 'react';

import { Separator } from '@/components';
import { getBubbleDrawer } from '@/components/Bubble/formatBubble';
import { Drawer } from '@/extensions/Drawer';
import { EditDrawerBlock } from '@/extensions/Drawer/components/EditDrawerBlock';
import { useAttributes } from '@/hooks/useAttributes';
import { useExtension } from '@/hooks/useExtension';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';
import { useEditableEditor } from '@/store/store';

import { isNodeSelected } from './nodeSelection';

import type { Editor } from '@tiptap/react';

function ItemA({
  item,
  disabled,
  editor,
}: {
  item: import('./formatBubble').BubbleMenuItem;
  disabled?: boolean;
  editor: Editor;
}) {
  const Comp = item.component;

  if (!Comp) {
    return <></>;
  }

  return (
    <Fragment>
      {item.type === 'divider' ? (
        <Separator
          className='!richtext-mx-1 !richtext-my-2 !richtext-h-[16px]'
          orientation='vertical'
        />
      ) : (
        <Comp
          {...item.componentProps}
          disabled={disabled || item?.componentProps?.disabled}
          editor={editor}
        />
      )}
    </Fragment>
  );
}

export function RichTextBubbleDrawer() {
  const { lang, t } = useLocale();
  const editable = useEditableEditor();
  const editor = useEditorInstance();

  const attrs = useAttributes<{ src: string; alt: string; align: 'left' | 'center' | 'right' }>(
    editor,
    Drawer.name
  );

  const extension = useExtension(Drawer.name);

  // Only for the node itself, not a range (Select All) that contains it.
  const shouldShow = ({ editor }: { editor: Editor }) =>
    isNodeSelected(editor.state, [Drawer.name]);

  const items = useMemo(() => {
    return getBubbleDrawer(editor, t);
  }, [editor, lang, t]);

  if (!editable) {
    return <></>;
  }

  return (
    <BubbleMenu
      className='richtext-z-20'
      editor={editor}
      options={{ placement: 'bottom', offset: 8, flip: true }}
      pluginKey={'RichTextBubbleDrawer'}
      shouldShow={shouldShow}
    >
      {items?.length ? (
        <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-1 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
          {items?.map((item, key) => {
            if (item.type === 'edit' && attrs?.src) {
              return (
                <EditDrawerBlock
                  attrs={attrs}
                  editor={editor}
                  extension={extension}
                  key={`bubbleMenu-drawer-${key}`}
                />
              );
            }

            return <ItemA editor={editor} item={item} key={`bubbleMenu-drawer-${key}`} />;
          })}
        </div>
      ) : (
        <></>
      )}
    </BubbleMenu>
  );
}
