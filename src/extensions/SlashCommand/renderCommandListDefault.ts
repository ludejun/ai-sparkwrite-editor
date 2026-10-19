import {
  CircleCheckIcon,
  CodeXmlIcon,
  Columns2Icon,
  FrameIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  Heading5Icon,
  Heading6Icon,
  ImageUpIcon,
  InfoIcon,
  ListCollapseIcon,
  MegaphoneIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  MinusIcon,
  PilcrowIcon,
  SeparatorHorizontalIcon,
  SquareDashedIcon,
  StarIcon,
  TableIcon,
  TableOfContentsIcon,
  TriangleAlertIcon,
  VideoIcon,
} from 'lucide-react';
import { createElement } from 'react';

import { BlockquoteLeft as BlockquoteLeftIcon } from '@/components/icons/Blockquote';
import { registerIcons } from '@/components/icons/icons';
import { emit } from '@/components/ReactBus';
import { HEADINGS } from '@/constants';
import { EmbedLogo } from '@/extensions/Iframe/components/EmbedLogo';
import { EMBED_SERVICES } from '@/extensions/Iframe/embeds';
import { NOTICE_TYPES, type NoticeType } from '@/extensions/Notice/Notice';
import { getLocaleState } from '@/locales/store';
import { EVENTS } from '@/utils/customEvents/events.constant';

import type { CommandList } from './types';
import type { Editor } from '@tiptap/core';

/** A service's brand mark as an icon component, for the embed row's preview. */
function brandIcon(key: string) {
  const service = EMBED_SERVICES.find((item) => item.key === key)!;
  return () => createElement(EmbedLogo, { service });
}

// Icons this module (and its extension's `button()` options) resolves by name.
registerIcons({
  Code2: CodeXmlIcon,
  Columns2: Columns2Icon,
  Details: ListCollapseIcon,
  Heading1: Heading1Icon,
  Heading2: Heading2Icon,
  Heading3: Heading3Icon,
  Heading4: Heading4Icon,
  Heading5: Heading5Icon,
  Heading6: Heading6Icon,
  HeadingParagraph: PilcrowIcon,
  Iframe: FrameIcon,
  BrandBilibili: brandIcon('bilibili'),
  BrandYoutube: brandIcon('youtube'),
  BrandFigma: brandIcon('figma'),
  BrandCodepen: brandIcon('codepen'),
  ImageUp: ImageUpIcon,
  List: ListIcon,
  ListOrdered: ListOrderedIcon,
  ListTodo: ListTodoIcon,
  Minus: MinusIcon,
  Notice: MegaphoneIcon,
  NoticeInfo: InfoIcon,
  NoticeSuccess: CircleCheckIcon,
  NoticeWarning: TriangleAlertIcon,
  NoticeTip: StarIcon,
  SeparatorHorizontal: SeparatorHorizontalIcon,
  SquareDashed: SquareDashedIcon,
  Table: TableIcon,
  TableOfContents: TableOfContentsIcon,
  TextQuote: BlockquoteLeftIcon,
  Video: VideoIcon,
});

/** Selects the last node of `type` that starts before the cursor (a block just inserted). */
function selectNodeBefore(editor: Editor, type: string) {
  const { from } = editor.state.selection;
  let found = -1;
  editor.state.doc.nodesBetween(0, from, (node, pos) => {
    if (node.type.name === type && pos < from) found = pos;
    return true;
  });
  if (found >= 0) editor.commands.setNodeSelection(found);
}

export function renderCommandListDefault({ t }: { t: (path: string) => string }) {
  // Insert comes first: someone who opens the menu usually wants a table, a
  // code block or an image, not a heading they could type with `#`. Anything
  // used less often is `hiddenUntilSearched`, so the default list stays short
  // and the search still finds everything.
  const groups: CommandList[] = [
    {
      name: 'insert',
      title: t('editor.slash.insert'),
      commands: [],
    },
    {
      name: 'format',
      title: t('editor.slash.format'),
      commands: [],
    },
  ];
  const [insert, format] = groups;

  // heading
  HEADINGS.forEach((level) => {
    format.commands.push({
      name: `heading${level}`,
      // H1-H3 cover almost every document; Paragraph and H4-H6 only appear
      // once searched.
      hiddenUntilSearched: level === 'Paragraph' || level > 3,
      shortcut: level === 'Paragraph' ? undefined : '#'.repeat(level),
      label:
        level === 'Paragraph'
          ? t('editor.paragraph.tooltip')
          : t(`editor.heading.h${level}.tooltip`),
      aliases: [`h${level}`, 'bt', `bt${level}`],
      iconName: `Heading${level}`,
      isActive: (editor) => {
        if (level === 'Paragraph') {
          return false;
        }

        return editor.isActive('heading', { level }) || false;
      },
      action: ({ editor, range }) => {
        const currentActiveLevel = HEADINGS.find((lvl) =>
          editor.isActive('heading', { level: lvl })
        );

        if (level === 'Paragraph') {
          if (currentActiveLevel !== undefined && currentActiveLevel !== 'Paragraph') {
            editor.commands.toggleHeading({ level: currentActiveLevel });
            editor.chain().focus().deleteRange(range).run();
          } else {
            editor.chain().focus().deleteRange(range).run();
          }

          return;
        }

        if (level) {
          editor.chain().focus().deleteRange(range).setHeading({ level }).run();
          return;
        }

        editor.chain().focus().deleteRange(range).run();
      },
    });
  });

  //bulletlist
  format.commands.push({
    name: 'bulletList',
    shortcut: '-',
    label: t('editor.bulletlist.tooltip'),
    aliases: ['ul', 'yxlb'],
    iconName: 'List',
    isActive: (editor) => editor.isActive('bulletList'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  });

  //orderedlist
  format.commands.push({
    name: 'orderedlist',
    shortcut: '1.',
    label: t('editor.orderedlist.tooltip'),
    aliases: ['ol', 'yxlb'],
    iconName: 'ListOrdered',
    isActive: (editor) => editor.isActive('orderedList'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  });

  // tasklist
  format.commands.push({
    name: 'taskList',
    shortcut: '[ ]',
    label: t('editor.tasklist.tooltip'),
    iconName: 'ListTodo',
    description: 'Task list with todo items',
    aliases: ['todo'],
    isActive: (editor) => editor.isActive('taskList'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  });

  // blockquote
  format.commands.push({
    name: 'blockquote',
    shortcut: '>',
    label: t('editor.blockquote.tooltip'),
    description: '插入引入格式',
    aliases: ['yr'],
    iconName: 'TextQuote',
    isActive: (editor) => editor.isActive('blockquote'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setBlockquote().run();
    },
  });

  /* Insert */
  // table
  insert.commands.push({
    name: 'table',
    label: t('editor.table.tooltip'),
    iconName: 'Table',
    description: 'Insert a table',
    aliases: ['table', 'bg', 'biaoge', 'biao'],
    shouldBeHidden: (editor) => editor.isActive('columns'),
    action: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
        .run();
    },
  });

  // codeblock
  insert.commands.push({
    name: 'codeBlock',
    shortcut: '```',
    label: t('editor.codeblock.tooltip'),
    iconName: 'Code2',
    description: 'Code block with syntax highlighting',
    shouldBeHidden: (editor) => editor.isActive('columns'),
    isActive: (editor) => editor.isActive('codeBlock'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  });

  // name
  insert.commands.push({
    name: 'image',
    label: t('editor.image.tooltip'),
    iconName: 'ImageUp',
    description: 'Insert a image',
    aliases: ['image', 'tp', 'tupian'],
    shouldBeHidden: (editor) => editor.isActive('columns'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const EVENT_ID = EVENTS.UPLOAD_IMAGE(editor.id);
      emit(EVENT_ID, true);
    },
  });

  // notice: one row, the four types as coloured icons at its right (←/→ or click picks one)
  const NOTICE_ALIASES: Record<string, string[]> = {
    info: ['info', 'note', 'xx'],
    success: ['success', 'done', 'cg'],
    warning: ['warning', 'warn', 'jg'],
    tip: ['tip', 'hint', 'jq'],
  };

  insert.commands.push({
    name: 'notice',
    label: t('editor.notice.tooltip'),
    iconName: 'Notice',
    description: 'A coloured box with an icon',
    aliases: ['notice', 'tsk', ...Object.values(NOTICE_ALIASES).flat()],
    variants: NOTICE_TYPES.map(({ value, color }) => ({
      value,
      label: t(`editor.notice.${value}`),
      iconName: `Notice${value[0].toUpperCase()}${value.slice(1)}`,
      iconColor: color,
      aliases: NOTICE_ALIASES[value],
    })),
    shouldBeHidden: (editor) => !editor.schema.nodes.notice || editor.isActive('columns'),
    isActive: (editor) => editor.isActive('notice'),
    action: ({ editor, range, variant }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setNotice((variant as NoticeType | undefined) ?? 'info')
        .run();
    },
  });

  // embed: a YouTube video, a Figma file, a Google Sheet… `/figma` finds it too
  insert.commands.push({
    name: 'embed',
    label: t('editor.iframe.tooltip'),
    iconName: 'Iframe',
    description: 'Embed a video, a design file, a document or any web page',
    aliases: [
      'embed',
      'iframe',
      'qr',
      'qianru',
      ...EMBED_SERVICES.map((s) => s.name.toLowerCase()),
    ],
    // Three well-known marks in their own colours and a count; Bilibili leads under a Chinese interface.
    preview: {
      icons: [
        /^zh/i.test(String(getLocaleState().currentLang))
          ? { iconName: 'BrandBilibili' }
          : { iconName: 'BrandYoutube' },
        { iconName: 'BrandFigma' },
        { iconName: 'BrandCodepen' },
      ],
      text: `+${EMBED_SERVICES.length - 3}`,
    },
    shouldBeHidden: (editor) => !editor.schema.nodes.iframe || editor.isActive('columns'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setIframe({ src: '' }).run();
    },
  });

  // divider (replaces horizontalRule when registered)
  insert.commands.push({
    name: 'divider',
    shortcut: '---',
    label: t('editor.divider.tooltip'),
    iconName: 'SeparatorHorizontal',
    description: 'Insert a divider',
    aliases: ['divider', 'hr', 'fgx', 'fg', 'line'],
    shouldBeHidden: (editor) => !editor.schema.nodes.divider,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setDivider().run();
      // Select the new divider so its style picker opens right away.
      selectNodeBefore(editor, 'divider');
    },
  });

  // card: a tinted box (more looks from its style handle)
  insert.commands.push({
    name: 'card',
    label: t('editor.card.tooltip'),
    iconName: 'SquareDashed',
    description: 'Put the block in a styled card',
    aliases: ['card', 'box', 'kp', 'kapian', 'callout'],
    shouldBeHidden: (editor) => !editor.schema.nodes.card,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCard().run();
    },
  });

  // pull quote: a centred quote with large quotation marks
  insert.commands.push({
    name: 'pullQuote',
    label: t('editor.quote.golden'),
    iconName: 'TextQuote',
    description: 'A centred pull quote',
    aliases: ['quote', 'pull', 'jinju', 'jj'],
    hiddenUntilSearched: true,
    shouldBeHidden: (editor) =>
      !editor.schema.nodes.blockquote ||
      !editor.extensionManager.extensions.some((ext) => ext.name === 'blockStyles'),
    action: ({ editor, range }) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setBlockquote()
        .setBlockVariant('blockquote', 'center')
        .run();
    },
  });

  //horizontalrule
  insert.commands.push({
    name: 'horizontalRule',
    shortcut: '---',
    label: t('editor.horizontalrule.tooltip'),
    iconName: 'Minus',
    description: 'Insert a horizontal divider',
    aliases: ['hr', 'fgx', 'fg'],
    shouldBeHidden: (editor) =>
      !!editor.schema.nodes.divider || !editor.schema.nodes.horizontalRule,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  });

  // columns
  insert.commands.push({
    name: 'columns',
    hiddenUntilSearched: true,
    label: t('editor.columns.tooltip'),
    iconName: 'Columns2',
    description: 'Add two column content',
    action: ({ editor }) => {
      editor.chain().focus().insertColumns({ cols: 2 }).run();
    },
  });

  // details (toggle)
  insert.commands.push({
    name: 'details',
    hiddenUntilSearched: true,
    label: t('editor.details.tooltip'),
    iconName: 'Details',
    description: 'Insert a collapsible toggle block',
    aliases: ['toggle', 'collapse', 'details', 'accordion'],
    shouldBeHidden: (editor) => !editor.schema.nodes.details,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setDetails().run();
    },
  });

  // video
  insert.commands.push({
    name: 'video',
    hiddenUntilSearched: true,
    label: t('editor.video.tooltip'),
    iconName: 'Video',
    description: 'Insert a video',
    aliases: ['video', 'sp', 'shipin'],
    shouldBeHidden: (editor) => editor.isActive('columns'),
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      const EVENT_ID = EVENTS.UPLOAD_VIDEO(editor.id);
      emit(EVENT_ID, true);
    },
  });

  // table of contents
  insert.commands.push({
    name: 'tableOfContents',
    hiddenUntilSearched: true,
    label: t('editor.tableofcontents.tooltip'),
    iconName: 'TableOfContents',
    description: 'Insert a live table of contents',
    aliases: ['toc', 'outline', 'contents'],
    shouldBeHidden: (editor) => !editor.schema.nodes.tableOfContentsNode,
    action: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertTableOfContents().run();
    },
  });

  return groups;
}

export function useFilterCommandList(
  commandList: CommandList[],
  query: string,
  editor?: Editor,
  showHidden = false
) {
  const withFilteredCommands = commandList.map((group) => ({
    ...group,
    commands: group.commands.filter((item) => {
      if (editor && item.shouldBeHidden?.(editor)) {
        return false;
      }

      const labelNormalized = item.label.toLowerCase().trim();
      const queryNormalized = query.toLowerCase().trim();

      if (item.hiddenUntilSearched && !queryNormalized && !showHidden) {
        return false;
      }

      if (item.aliases) {
        const aliases = item.aliases.map((alias) => alias.toLowerCase().trim());
        const labelMatch = labelNormalized.includes(queryNormalized);
        const aliasMatch = aliases.some((alias) => alias.includes(queryNormalized));

        return labelMatch || aliasMatch;
      }

      return labelNormalized.includes(queryNormalized);
    }),
  }));
  // Remove empty groups
  const withoutEmptyGroups = withFilteredCommands.filter((group) => {
    if (group.commands.length > 0) {
      return true;
    }

    return false;
  });

  return withoutEmptyGroups;
}
