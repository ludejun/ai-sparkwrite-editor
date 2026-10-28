import { isActive } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  BetweenHorizonalEndIcon,
  BetweenHorizonalStartIcon,
  BetweenVerticalEndIcon,
  BetweenVerticalStartIcon,
  CornerDownLeftIcon,
  PaintBucketIcon,
  TableCellsMergeIcon,
  TableCellsSplitIcon,
  Trash2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  IconComponent,
} from '@/components';
import { DeleteColumn as DeleteColumnIcon } from '@/components/icons/DeleteColumn';
import { DeleteRow as DeleteRowIcon } from '@/components/icons/DeleteRow';
import { registerIcons } from '@/components/icons/icons';
import { NoFill } from '@/components/icons/NoFill';
import { COLORS_LIST } from '@/constants';
import { Table } from '@/extensions/Table';
import { useLocale } from '@/locales';
import { useEditorInstance } from '@/store/editor';
import { useEditableEditor } from '@/store/store';
import { isEditorEditable } from '@/utils/editable';
import { getShortcutKeys } from '@/utils/plateform';

// Icons this module (and its extension's `button()` options) resolves by name.
registerIcons({
  BetweenHorizonalEnd: BetweenHorizonalEndIcon,
  BetweenHorizonalStart: BetweenHorizonalStartIcon,
  BetweenVerticalEnd: BetweenVerticalEndIcon,
  BetweenVerticalStart: BetweenVerticalStartIcon,
  CornerDownLeft: CornerDownLeftIcon,
  PaintBucket: PaintBucketIcon,
  DeleteColumn: DeleteColumnIcon,
  DeleteRow: DeleteRowIcon,
  TableCellsMerge: TableCellsMergeIcon,
  TableCellsSplit: TableCellsSplitIcon,
  Trash2: Trash2Icon,
});

interface RichTextBubbleTableProps {
  hiddenActions?: string[];
}

interface MenuPosition {
  x: number;
  y: number;
}

/**
 * Table actions, opened with a right click inside the table.
 *
 * A caret-triggered bubble menu sat on top of the document the whole time the
 * cursor was in a cell; every other editor puts these behind a context menu.
 */
function RichTextBubbleTable({ hiddenActions = [] }: RichTextBubbleTableProps) {
  const { t } = useLocale();

  const editable = useEditableEditor();
  const editor = useEditorInstance();

  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  const can = useEditorState({
    editor,
    selector: ({ editor }) => {
      const commands = editor.can();
      return {
        addColumnBefore: !!commands.addColumnBefore?.(),
        addColumnAfter: !!commands.addColumnAfter?.(),
        deleteColumn: !!commands.deleteColumn?.(),
        addRowBefore: !!commands.addRowBefore?.(),
        addRowAfter: !!commands.addRowAfter?.(),
        deleteRow: !!commands.deleteRow?.(),
        mergeCells: !!commands.mergeCells?.(),
        splitCell: !!commands.splitCell?.(),
        deleteTable: !!commands.deleteTable?.(),
        cellBackground: !!commands.setTableCellBackground?.('#000000'),
      };
    },
  });

  useEffect(() => {
    if (!editable) {
      // A menu left open must not come back when the editor turns editable again.
      setMenuPosition(null);
      return;
    }

    const dom = editor.view.dom;

    const onContextMenu = (event: MouseEvent) => {
      if (!isEditorEditable(editor)) return;

      const cell = (event.target as HTMLElement | null)?.closest?.('td, th');

      if (!cell || !dom.contains(cell)) {
        return;
      }

      // Move the caret into the cell that was right-clicked, otherwise the
      // commands below would act on wherever the caret happened to be. A
      // multi-cell selection is kept as is.
      const posAtPointer = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });

      if (posAtPointer && !isActive(editor.view.state, Table.name)) {
        editor.commands.setTextSelection(posAtPointer.pos);
      } else if (posAtPointer && editor.state.selection.empty) {
        editor.commands.setTextSelection(posAtPointer.pos);
      }

      event.preventDefault();
      setMenuPosition({ x: event.clientX, y: event.clientY });
    };

    dom.addEventListener('contextmenu', onContextMenu);

    return () => dom.removeEventListener('contextmenu', onContextMenu);
  }, [editor, editable]);

  const isHidden = (key: string) => hiddenActions.includes(key);

  const run = useCallback(
    (command: () => void) => () => {
      if (isEditorEditable(editor)) command();
      setMenuPosition(null);
    },
    [editor]
  );

  const onOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setMenuPosition(null);
    }
  }, []);

  if (!editable) {
    return <></>;
  }

  const items = [
    {
      key: 'addColumnBefore',
      icon: 'BetweenHorizonalEnd',
      label: t('editor.table.menu.insertColumnBefore'),
      disabled: !can.addColumnBefore,
      action: () => editor.chain().focus().addColumnBefore().run(),
    },
    {
      key: 'addColumnAfter',
      icon: 'BetweenHorizonalStart',
      label: t('editor.table.menu.insertColumnAfter'),
      disabled: !can.addColumnAfter,
      action: () => editor.chain().focus().addColumnAfter().run(),
    },
    {
      key: 'deleteColumn',
      icon: 'DeleteColumn',
      label: t('editor.table.menu.deleteColumn'),
      disabled: !can.deleteColumn,
      action: () => editor.chain().focus().deleteColumn().run(),
    },
    { key: 'separator-rows', separator: true },
    {
      key: 'addRowAbove',
      icon: 'BetweenVerticalEnd',
      label: t('editor.table.menu.insertRowAbove'),
      disabled: !can.addRowBefore,
      action: () => editor.chain().focus().addRowBefore().run(),
    },
    {
      key: 'addRowBelow',
      icon: 'BetweenVerticalStart',
      label: t('editor.table.menu.insertRowBelow'),
      disabled: !can.addRowAfter,
      action: () => editor.chain().focus().addRowAfter().run(),
    },
    {
      key: 'deleteRow',
      icon: 'DeleteRow',
      label: t('editor.table.menu.deleteRow'),
      disabled: !can.deleteRow,
      action: () => editor.chain().focus().deleteRow().run(),
    },
    { key: 'separator-cells', separator: true },
    {
      key: 'mergeCells',
      icon: 'TableCellsMerge',
      label: t('editor.table.menu.mergeCells'),
      disabled: !can.mergeCells,
      action: () => editor.chain().focus().mergeCells().run(),
    },
    {
      key: 'splitCells',
      icon: 'TableCellsSplit',
      label: t('editor.table.menu.splitCells'),
      disabled: !can.splitCell,
      action: () => editor.chain().focus().splitCell().run(),
    },
    { key: 'cellBackground', submenu: true },
    { key: 'separator-table', separator: true },
    {
      key: 'insertParagraphAfterTable',
      icon: 'CornerDownLeft',
      label: t('editor.table.menu.insertParagraphAfterTable'),
      disabled: false,
      // Shown so the shortcut is discoverable; the label reads ⌘ on a Mac
      // and Ctrl elsewhere.
      shortcut: getShortcutKeys(['mod', 'Enter']),
      action: () => editor.chain().focus().insertParagraphAfterTable().run(),
    },
    {
      key: 'deleteTable',
      icon: 'Trash2',
      label: t('editor.table.menu.deleteTable'),
      disabled: !can.deleteTable,
      destructive: true,
      action: () => editor.chain().focus().deleteTable().run(),
    },
  ] as const;

  return (
    <DropdownMenu onOpenChange={onOpenChange} open={!!menuPosition}>
      {/* In the body: inside the editor a transformed or contained ancestor
          would make `fixed` relative to it and misplace the menu. */}
      {createPortal(
        <DropdownMenuTrigger asChild>
          <span
            aria-hidden
            style={{
              position: 'fixed',
              width: 0,
              height: 0,
              pointerEvents: 'none',
              left: menuPosition?.x ?? 0,
              top: menuPosition?.y ?? 0,
            }}
          />
        </DropdownMenuTrigger>,
        editor.view.dom.ownerDocument.body
      )}

      <DropdownMenuContent align='start' className='richtext-w-64' side='bottom' sideOffset={0}>
        {items.map((item) => {
          if ('separator' in item) {
            return <DropdownMenuSeparator key={item.key} />;
          }

          if (isHidden(item.key)) {
            return null;
          }

          if ('submenu' in item) {
            return (
              <DropdownMenuSub key={item.key}>
                <DropdownMenuSubTrigger
                  className='richtext-flex richtext-gap-3'
                  disabled={!can.cellBackground}
                >
                  <IconComponent name='PaintBucket' />
                  <span className='richtext-whitespace-nowrap'>
                    {t('editor.table.menu.setCellsBgColor')}
                  </span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className='!richtext-w-auto !richtext-p-1.5' sideOffset={4}>
                  <button
                    className='richtext-flex richtext-w-full richtext-items-center richtext-gap-2 richtext-rounded-sm !richtext-border-none !richtext-bg-transparent richtext-px-1.5 richtext-py-1.5 richtext-text-left richtext-text-sm richtext-text-foreground !richtext-outline-none hover:!richtext-bg-accent'
                    onClick={run(() => editor.chain().focus().unsetTableCellBackground().run())}
                    type='button'
                  >
                    <NoFill />
                    {t('editor.nofill')}
                  </button>
                  <div className='richtext-mt-1 richtext-grid richtext-grid-cols-10 richtext-gap-1 richtext-px-1'>
                    {COLORS_LIST.map((color) => (
                      <button
                        aria-label={color}
                        className='richtext-size-5 richtext-rounded-sm !richtext-border !richtext-border-solid !richtext-border-border !richtext-p-0 hover:richtext-scale-110'
                        key={color}
                        onClick={run(() =>
                          editor.chain().focus().setTableCellBackground(color).run()
                        )}
                        style={{ backgroundColor: color }}
                        title={color}
                        type='button'
                      />
                    ))}
                  </div>
                  <label className='richtext-mt-1.5 richtext-flex richtext-cursor-pointer richtext-items-center richtext-justify-between richtext-gap-2 richtext-rounded-sm richtext-px-1.5 richtext-py-1 richtext-text-sm richtext-text-foreground hover:richtext-bg-accent'>
                    {t('editor.color.more')}
                    <input
                      className='richtext-h-5 richtext-w-7 richtext-cursor-pointer richtext-border-0 richtext-bg-transparent richtext-p-0'
                      onChange={(event) =>
                        isEditorEditable(editor) &&
                        editor.chain().focus().setTableCellBackground(event.target.value).run()
                      }
                      type='color'
                    />
                  </label>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          return (
            <DropdownMenuItem
              className={
                'destructive' in item && item.destructive
                  ? 'richtext-flex richtext-gap-3 focus:richtext-bg-red-400/30 focus:richtext-text-red-500'
                  : 'richtext-flex richtext-gap-3'
              }
              disabled={item.disabled}
              key={item.key}
              onClick={run(item.action)}
            >
              <IconComponent name={item.icon} />

              <span className='richtext-whitespace-nowrap'>{item.label}</span>

              {'shortcut' in item && (
                <DropdownMenuShortcut className='richtext-whitespace-nowrap'>
                  {item.shortcut}
                </DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { RichTextBubbleTable };
