import { Document } from '@tiptap/extension-document';
import { HardBreak } from '@tiptap/extension-hard-break';
import { ListItem } from '@tiptap/extension-list';
import { Paragraph } from '@tiptap/extension-paragraph';
import { Text } from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';

import { AttachmentCore } from '@/extensions/Attachment/Attachment';
import { Blockquote } from '@/extensions/Blockquote/Blockquote';
import { Bold } from '@/extensions/Bold/Bold';
import { BulletList } from '@/extensions/BulletList/BulletList';
import { CalloutCore } from '@/extensions/Callout/Callout';
import { Code } from '@/extensions/Code/Code';
import { CodeBlockCore } from '@/extensions/CodeBlock/CodeBlock';
import { Color } from '@/extensions/Color/Color';
import { Column, ColumnNode, MultipleColumnNode } from '@/extensions/Column/Column';
import { Details } from '@/extensions/Details/Details';
import { DividerCore } from '@/extensions/Divider/Divider';
import { FontFamily } from '@/extensions/FontFamily/FontFamily';
import { FontSize } from '@/extensions/FontSize/FontSize';
import { Heading } from '@/extensions/Heading/Heading';
import { Highlight } from '@/extensions/Highlight/Highlight';
import { IframeCore } from '@/extensions/Iframe/Iframe';
import { ImageCore } from '@/extensions/Image/Image';
import { ImageGifCore } from '@/extensions/ImageGif/ImageGif';
import { Indent } from '@/extensions/Indent/Indent';
import { Italic } from '@/extensions/Italic/Italic';
import { KatexCore } from '@/extensions/Katex/Katex';
import { LineHeight } from '@/extensions/LineHeight/LineHeight';
import { Link } from '@/extensions/Link/Link';
import { MermaidCore } from '@/extensions/Mermaid/Mermaid';
import { MoreMark } from '@/extensions/MoreMark/MoreMark';
import { Notice } from '@/extensions/Notice/Notice';
import { OrderedList } from '@/extensions/OrderedList/OrderedList';
import { Strike } from '@/extensions/Strike/Strike';
import { StyledBlocksCore } from '@/extensions/StyledBlocks/StyledBlocks';
import { Table } from '@/extensions/Table/Table';
import { TableOfContentsCore } from '@/extensions/TableOfContents/TableOfContents';
import { TaskList } from '@/extensions/TaskList/TaskList';
import { TextAlign } from '@/extensions/TextAlign/TextAlign';
import { TextDirection } from '@/extensions/TextDirection/TextDirection';
import { TextUnderline } from '@/extensions/TextUnderline/TextUnderline';
import { Video } from '@/extensions/Video/Video';

import type { AnyExtension } from '@tiptap/core';

/** The kit's document node: blocks plus column layouts at the top level. */
const DocumentWithColumns = /* @__PURE__ */ Document.extend({ content: '(block|columns)+' });

/**
 * The document schema of `RichTextKit` with every content feature on (GIF
 * blocks included), built from the framework-agnostic extensions: the same
 * node and mark types, attributes and `renderHTML` as the editor, without
 * node views, menus or editing behaviour. Used by `renderStaticHTML`.
 */
export function staticExtensions(): AnyExtension[] {
  return [
    DocumentWithColumns,
    Paragraph,
    Text,
    HardBreak,
    TextStyle,
    Bold,
    Italic,
    TextUnderline,
    Strike,
    Code,
    MoreMark,
    Color,
    Highlight,
    FontFamily,
    FontSize,
    LineHeight,
    TextAlign,
    TextDirection,
    Indent,
    Link,
    Heading,
    BulletList,
    ListItem,
    OrderedList,
    TaskList,
    Blockquote,
    Notice,
    Table,
    DividerCore,
    Details,
    CodeBlockCore,
    CalloutCore,
    StyledBlocksCore,
    Column,
    ColumnNode,
    MultipleColumnNode,
    TableOfContentsCore,
    ImageCore,
    Video,
    IframeCore,
    AttachmentCore,
    KatexCore,
    MermaidCore,
    ImageGifCore,
  ];
}
