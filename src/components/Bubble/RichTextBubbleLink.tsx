import { BubbleMenu } from '@tiptap/react/menus';
import { useCallback, useEffect, useRef, useState } from 'react';

import { BUBBLE_TEXT_KEY } from '@/components/Bubble/bubbleKeys';
import LinkEditBlock from '@/extensions/Link/components/LinkEditBlock';
import LinkViewBlock from '@/extensions/Link/components/LinkViewBlock';
import { Link, applyLinkEdit } from '@/extensions/Link/Link';
import { useEditorInstance } from '@/store/editor';
import { useEditableEditor } from '@/store/store';
import { isEditorEditable } from '@/utils/editable';

import type { Editor } from '@tiptap/react';

export interface BubbleMenuLinkProps {
  editor: Editor;
  disabled?: boolean;
}

/** Grace period that lets the pointer travel from the link into the menu. */
const HIDE_DELAY_MS = 300;

const PLUGIN_KEY = 'RichTextBubbleLink';

export function RichTextBubbleLink() {
  const editable = useEditableEditor();
  const editor = useEditorInstance();

  const [showEdit, setShowEdit] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<HTMLAnchorElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const menu = useRef<HTMLDivElement>(null);

  const link = hoveredLink?.getAttribute('href') ?? '';

  const cancelHide = useCallback(() => clearTimeout(hideTimer.current), []);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setHoveredLink(null), HIDE_DELAY_MS);
  }, []);

  // Hover, not the caret, drives this menu: typing through a link no longer pops
  // it open, and it stays anchored to the link element instead of the selection.
  useEffect(() => {
    if (!editable) {
      // Turned read-only mid-hover or mid-edit: nothing stays open for later.
      if (editor.storage.link) editor.storage.link.editing = false;
      setShowEdit(false);
      setHoveredLink(null);
      return;
    }

    const dom = editor.view.dom;

    const onMouseOver = (event: MouseEvent) => {
      // The edit card stays put on the link it was opened for.
      if (showEdit) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a');

      if (anchor instanceof HTMLAnchorElement && dom.contains(anchor)) {
        clearTimeout(hideTimer.current);
        setHoveredLink((current) => (current === anchor ? current : anchor));
        return;
      }

      if (!showEdit) {
        scheduleHide();
      }
    };

    // Leaving the editor for the menu itself must not start the hide timer:
    // the browser fires this `mouseleave` after React has already delivered
    // the menu's `onMouseEnter` (which cancels the timer), so without this
    // check the menu vanished the moment the pointer reached its buttons.
    const onMouseLeave = (event: MouseEvent) => {
      if (showEdit) return;
      const next = event.relatedTarget as Node | null;
      if (next && menu.current?.contains(next)) return;
      scheduleHide();
    };

    // Typing or moving the caret means the reader moved on from the hovered
    // link. The storage flag, not `showEdit`, is read: opening the card selects
    // the link synchronously, before this closure sees the new state.
    const hideNow = () => {
      if (editor.storage.link?.editing) return;
      clearTimeout(hideTimer.current);
      setHoveredLink(null);
    };

    dom.addEventListener('mouseover', onMouseOver);
    dom.addEventListener('mouseleave', onMouseLeave);
    dom.addEventListener('keydown', hideNow);
    editor.on('selectionUpdate', hideNow);

    return () => {
      dom.removeEventListener('mouseover', onMouseOver);
      dom.removeEventListener('mouseleave', onMouseLeave);
      dom.removeEventListener('keydown', hideNow);
      editor.off('selectionUpdate', hideNow);
      clearTimeout(hideTimer.current);
    };
  }, [editor, editable, showEdit, scheduleHide]);

  /** Put the selection on the hovered link so the link commands act on it. */
  const selectHoveredLink = useCallback(() => {
    if (!hoveredLink) {
      return false;
    }

    const pos = editor.view.posAtDOM(hoveredLink, 0);

    if (pos < 0) {
      return false;
    }

    editor
      .chain()
      .setTextSelection(pos + 1)
      .extendMarkRange(Link.name)
      .run();

    return true;
  }, [editor, hoveredLink]);

  /** The text bubble reads this flag, so both never show at once. */
  const setEditing = useCallback(
    (editing: boolean) => {
      if (editor.storage.link) editor.storage.link.editing = editing;
      setShowEdit(editing);
    },
    [editor]
  );

  // Mod-K: edit the link under the caret, or link the selection, in this card.
  useEffect(() => {
    const storage = editor.storage.link;

    if (!editable || !storage) return;

    const open = () => {
      const { node } = editor.view.domAtPos(editor.state.selection.from);
      const element = node instanceof Element ? node : node.parentElement;
      const anchor = element?.closest('a');
      const inLink = anchor instanceof HTMLAnchorElement && editor.view.dom.contains(anchor);

      setEditing(true);
      setHoveredLink(inLink ? anchor : null);
      // The selection may not move, so the text bubble would not re-check `editing`.
      editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_TEXT_KEY, 'hide'));

      if (inLink) editor.commands.extendMarkRange(Link.name);
    };

    storage.openEditor = open;

    return () => {
      if (storage.openEditor === open) storage.openEditor = null;
    };
  }, [editor, editable, setEditing]);

  // The card is anchored to the hovered link; while it is open the anchor must
  // survive the pointer wandering off, or the card would fall back to following
  // the caret. A click anywhere outside the card closes it instead.
  useEffect(() => {
    if (!showEdit) return;

    clearTimeout(hideTimer.current);

    const onMouseDown = (event: MouseEvent) => {
      if (menu.current?.contains(event.target as Node)) return;
      setEditing(false);
      setHoveredLink(null);
    };

    document.addEventListener('mousedown', onMouseDown, true);

    return () => document.removeEventListener('mousedown', onMouseDown, true);
  }, [showEdit, setEditing]);

  const visible = !!hoveredLink || showEdit;
  const wasVisible = useRef(false);

  const shouldShow = useCallback(() => visible, [visible]);

  // The bubble menu plugin only re-runs `shouldShow` when the selection or the
  // document changes, and hovering does neither. Drive it by hand instead.
  // `show` has to land before `updatePosition`, which bails out while hidden.
  useEffect(() => {
    if (visible) {
      editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'show'));
      editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'updatePosition'));
    } else if (wasVisible.current) {
      editor.view.dispatch(editor.state.tr.setMeta(PLUGIN_KEY, 'hide'));
    }

    wasVisible.current = visible;
  }, [editor, visible, hoveredLink]);

  const getReferencedVirtualElement = useCallback(() => {
    if (!hoveredLink) {
      return null;
    }

    return {
      getBoundingClientRect: () => hoveredLink.getBoundingClientRect(),
    };
  }, [hoveredLink]);

  // The same path as the toolbar form, so both store links alike.
  const onSetLink = (link: string, text?: string, openInNewTab?: boolean) => {
    applyLinkEdit(editor, { link, text, openInNewTab });
    setEditing(false);
    setHoveredLink(null);
  };

  const unSetLink = useCallback(() => {
    if (isEditorEditable(editor)) {
      selectHoveredLink();
      editor.chain().extendMarkRange('link').unsetLink().focus().run();
    }

    setEditing(false);
    setHoveredLink(null);
  }, [editor, selectHoveredLink, setEditing]);

  const onClose = () => {
    setEditing(false);
    scheduleHide();
  };

  if (!editable) {
    return <></>;
  }

  return (
    <BubbleMenu
      className='richtext-z-20'
      editor={editor}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{ placement: 'bottom', offset: 8, flip: true }}
      pluginKey={PLUGIN_KEY}
      shouldShow={shouldShow}
    >
      <div ref={menu} onMouseEnter={cancelHide} onMouseLeave={() => !showEdit && scheduleHide()}>
        {showEdit ? (
          <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-4 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
            <LinkEditBlock editor={editor} onClose={onClose} onSetLink={onSetLink} />
          </div>
        ) : (
          <div className='richtext-flex richtext-items-center richtext-gap-2 richtext-rounded-md !richtext-border !richtext-border-solid !richtext-border-border richtext-bg-popover richtext-p-1 richtext-text-popover-foreground richtext-shadow-md richtext-outline-none'>
            <LinkViewBlock
              editor={editor}
              link={link}
              onClear={unSetLink}
              onEdit={() => {
                if (!isEditorEditable(editor)) return;
                // Flag first: selecting the link re-runs the text bubble's `shouldShow`.
                setEditing(true);
                selectHoveredLink();
              }}
            />
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
