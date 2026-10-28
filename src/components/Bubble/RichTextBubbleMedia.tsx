import { BubbleMenu } from '@tiptap/react/menus';
import { Fragment, useMemo } from 'react';

import { Separator } from '@/components';
import {
  getBubbleImage,
  getBubbleImageGif,
  getBubbleVideo,
} from '@/components/Bubble/formatBubble';
import { isNodeSelected } from '@/components/Bubble/nodeSelection';
import { Image, ImageBlock } from '@/extensions/Image';
import { ImageGif } from '@/extensions/ImageGif';
import { Video } from '@/extensions/Video';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';
import { useEditableEditor } from '@/store/store';

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
          disabled={disabled || item?.componentProps.disabled}
          editor={editor}
        />
      )}
    </Fragment>
  );
}

function RichTextBubbleImage() {
  const { lang, t } = useLocale();
  const editable = useEditableEditor();
  const editor = useEditorInstance();

  // Only for the node itself: with Select All the range contains every
  // media node, and this menu's actions would hit the whole range.
  const shouldShow = ({ editor }: { editor: Editor }) =>
    isNodeSelected(editor.state, [Image.name, ImageBlock.name]);

  const items = useMemo(() => {
    return getBubbleImage(editor, t);
  }, [editor, lang, t]);

  if (!editable) {
    return <></>;
  }

  return (
    <BubbleMenu
      className='richtext-z-20'
      editor={editor}
      options={{ placement: 'bottom', offset: 8, flip: true }}
      pluginKey={'RichTextBubbleImage'}
      shouldShow={shouldShow}
    >
      {items?.length ? (
        <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-1 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
          {items?.map((item, key) => {
            return <ItemA editor={editor} item={item} key={`bubbleMenu-image-${key}`} />;
          })}
        </div>
      ) : (
        <></>
      )}
    </BubbleMenu>
  );
}

function RichTextBubbleImageGif() {
  const { lang, t } = useLocale();
  const editable = useEditableEditor();
  const editor = useEditorInstance();

  // Only for the node itself: with Select All the range contains every
  // media node, and this menu's actions would hit the whole range.
  const shouldShow = ({ editor }: { editor: Editor }) =>
    isNodeSelected(editor.state, [ImageGif.name]);

  const items = useMemo(() => {
    return getBubbleImageGif(editor, t);
  }, [editor, t, lang]);

  if (!editable) {
    return <></>;
  }

  return (
    <BubbleMenu
      className='richtext-z-20'
      editor={editor}
      options={{ placement: 'bottom', offset: 8, flip: true }}
      pluginKey={'RichTextBubbleImageGif'}
      shouldShow={shouldShow}
    >
      {items?.length ? (
        <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-1 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
          {items?.map((item, key) => {
            return <ItemA editor={editor} item={item} key={`bubbleMenu-image-gif-${key}`} />;
          })}
        </div>
      ) : (
        <></>
      )}
    </BubbleMenu>
  );
}

function RichTextBubbleVideo() {
  const { t } = useLocale();
  const editable = useEditableEditor();
  const editor = useEditorInstance();

  // Only for the node itself: with Select All the range contains every
  // media node, and this menu's actions would hit the whole range.
  const shouldShow = ({ editor }: { editor: Editor }) => isNodeSelected(editor.state, [Video.name]);

  const items = useMemo(() => {
    return getBubbleVideo(editor, t);
  }, [editor, t]);

  if (!editable) {
    return <></>;
  }

  return (
    <BubbleMenu
      className='richtext-z-20'
      editor={editor}
      options={{ placement: 'bottom', offset: 8, flip: true }}
      pluginKey={'RichTextBubbleVideo'}
      shouldShow={shouldShow}
    >
      {items?.length ? (
        <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-1 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
          {items?.map((item, key) => {
            return <ItemA editor={editor} item={item} key={`bubbleMenu-video-${key}`} />;
          })}
        </div>
      ) : (
        <></>
      )}
    </BubbleMenu>
  );
}

export { RichTextBubbleImage, RichTextBubbleVideo, RichTextBubbleImageGif };
