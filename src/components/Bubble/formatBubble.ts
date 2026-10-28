import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  PencilIcon,
  RotateCwSquareIcon,
  Trash2Icon,
} from 'lucide-react';

import { ActionButton } from '@/components';
import { ImageCaptionButton } from '@/components/Bubble/ImageCaptionButton';
import { deleteSelectedNode } from '@/components/Bubble/nodeSelection';
import { registerIcons } from '@/components/icons/icons';
import { SizeL as SizeLIcon } from '@/components/icons/SizeL';
import { SizeM as SizeMIcon } from '@/components/icons/SizeM';
import { SizeS as SizeSIcon } from '@/components/icons/SizeS';
import { BUBBLE_TEXT_LIST, IMAGE_SIZE, VIDEO_SIZE } from '@/constants';
import { Image, ImageBlock } from '@/extensions/Image';

import type {
  ButtonViewParams,
  ButtonViewReturn,
  ExtensionNameKeys,
  VideoAlignment,
} from '@/types';
import type { Editor } from '@tiptap/react';

// Icons this module (and its extension's `button()` options) resolves by name.
registerIcons({
  AlignCenter: AlignCenterIcon,
  AlignLeft: AlignLeftIcon,
  AlignRight: AlignRightIcon,
  Pencil: PencilIcon,
  RotateCwSquare: RotateCwSquareIcon,
  SizeL: SizeLIcon,
  SizeM: SizeMIcon,
  SizeS: SizeSIcon,
  Trash2: Trash2Icon,
});

/** Represents the size types for bubble images or videos */
type BubbleImageOrVideoSizeType = 'size-small' | 'size-medium' | 'size-large';
type ImageAlignments = 'left' | 'center' | 'right';

/** Represents the various types for bubble images */
type BubbleImageType =
  | `image-${BubbleImageOrVideoSizeType}`
  | `video-${BubbleImageOrVideoSizeType}`
  | 'image'
  | 'image-aspect-ratio'
  | 'remove';

/** Represents the types for bubble videos */
type BubbleVideoType = 'video' | 'remove';

/** Represents the overall types for bubbles */
type BubbleAllType =
  | BubbleImageType
  | BubbleVideoType
  | ExtensionNameKeys
  | 'divider'
  | (string & {});

/** Represents the key types for node types */
export type NodeTypeKey = 'image' | 'text' | 'video';

/** Represents the menu of bubble types for each node type */
export type BubbleTypeMenu = Partial<Record<NodeTypeKey, BubbleMenuItem[]>>;

/** Represents the menu of overall bubble types for each node type */
export type NodeTypeMenu = Partial<Record<NodeTypeKey, BubbleAllType[]>>;

/**
 * Represents the structure of a bubble menu item.
 */
export interface BubbleMenuItem extends ButtonViewReturn {
  /** The type of the bubble item */
  type: BubbleAllType;
}

/**
 * Represents a function to generate a bubble menu
 */
/**
 * Generates a bubble menu based on the provided options.
 * @param {ButtonViewParams<T>} options - The options for generating the bubble menu.
 * @returns {BubbleTypeMenu} The generated bubble menu.
 */
type BubbleView<T = unknown> = (options: ButtonViewParams<T>) => BubbleTypeMenu;

/**
 * Represents the options for configuring bubbles.
 * @interface BubbleOptions
 * @template T
 */
export interface BubbleOptions<T> {
  /** The menu of bubble types for each node type. */
  list: NodeTypeMenu;
  /** The default list of bubble types. */
  defaultBubbleList: NodeTypeMenu;
  /** The function to generate a bubble menu. */
  button: BubbleView<T>;
}

function getActiveImageNodeName(editor: Editor) {
  return editor.isActive(ImageBlock.name) ? ImageBlock.name : Image.name;
}

function getActiveImageAttributes(editor: Editor) {
  return editor.getAttributes(getActiveImageNodeName(editor));
}

function isActiveImage(editor: Editor, attrs?: Record<string, unknown>) {
  return editor.isActive(Image.name, attrs) || editor.isActive(ImageBlock.name, attrs);
}

function imageSizeMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: BubbleImageOrVideoSizeType[] = ['size-small', 'size-medium', 'size-large'];
  const icons: NonNullable<ButtonViewReturn['componentProps']['icon']>[] = [
    'SizeS',
    'SizeM',
    'SizeL',
  ];

  return types.map((size, i) => ({
    type: `image-${size}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.${size.replace('-', '.')}.tooltip`),
      icon: icons[i],
      action: () => editor.commands.updateImage({ width: IMAGE_SIZE[size] }),
      isActive: () => isActiveImage(editor, { width: IMAGE_SIZE[size] }),
    },
  }));
}

function imageGifSizeMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: BubbleImageOrVideoSizeType[] = ['size-small', 'size-medium', 'size-large'];
  const icons: NonNullable<ButtonViewReturn['componentProps']['icon']>[] = [
    'SizeS',
    'SizeM',
    'SizeL',
  ];

  return types.map((size, i) => ({
    type: `image-${size}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.${size.replace('-', '.')}.tooltip`),
      icon: icons[i],
      action: () => editor.commands.updateImageGif({ width: IMAGE_SIZE[size] }),
      isActive: () => editor.isActive('image', { width: IMAGE_SIZE[size] }),
    },
  }));
}

function imageAlignMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: ImageAlignments[] = ['left', 'center', 'right'];
  const iconMap: Record<ImageAlignments, string> = {
    left: 'AlignLeft',
    center: 'AlignCenter',
    right: 'AlignRight',
  };
  return types.map((k) => ({
    type: `image-${k}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.textalign.${k}.tooltip`),
      icon: iconMap[k],
      action: () => editor.commands?.setAlignImage?.(k),
      isActive: () => isActiveImage(editor, { align: k }) || false,
      disabled: false,
    },
  }));
}

function imageGifAlignMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: ImageAlignments[] = ['left', 'center', 'right'];
  const iconMap: Record<ImageAlignments, string> = {
    left: 'AlignLeft',
    center: 'AlignCenter',
    right: 'AlignRight',
  };
  return types.map((k) => ({
    type: `image-${k}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.textalign.${k}.tooltip`),
      icon: iconMap[k],
      action: () => editor.commands?.setAlignImageGif?.(k),
      isActive: () => editor.isActive({ align: k }) || false,
      disabled: false,
    },
  }));
}

function imageMermaidAlignMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: ImageAlignments[] = ['left', 'center', 'right'];
  const iconMap: Record<ImageAlignments, string> = {
    left: 'AlignLeft',
    center: 'AlignCenter',
    right: 'AlignRight',
  };
  return types.map((k) => ({
    type: `image-${k}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.textalign.${k}.tooltip`),
      icon: iconMap[k],
      action: () => editor.commands?.setAlignImageMermaid?.(k),
      isActive: () => editor.isActive({ align: k }) || false,
      disabled: false,
    },
  }));
}

function imageDrawerAlignMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: ImageAlignments[] = ['left', 'center', 'right'];
  const iconMap: Record<ImageAlignments, string> = {
    left: 'AlignLeft',
    center: 'AlignCenter',
    right: 'AlignRight',
  };
  return types.map((k) => ({
    type: `image-${k}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.textalign.${k}.tooltip`),
      icon: iconMap[k],
      action: () => editor.commands?.setAlignImageDrawer?.(k),
      isActive: () => editor.isActive({ align: k }) || false,
      disabled: false,
    },
  }));
}
function videoAlignMenus(editor: Editor): BubbleMenuItem[] {
  const alignments: {
    type: VideoAlignment;
    icon: string;
    tooltip: string;
  }[] = [
    { type: 'flex-start', icon: 'AlignLeft', tooltip: 'Align left' },
    { type: 'center', icon: 'AlignCenter', tooltip: 'Align center' },
    { type: 'flex-end', icon: 'AlignRight', tooltip: 'Align right' },
  ];

  return alignments.map((align) => ({
    type: `video-align-${align.type}`,
    component: ActionButton,
    componentProps: {
      tooltip: align.tooltip,
      icon: align.icon,
      action: () => editor.commands.updateVideo({ align: align.type }),
      isActive: () => editor.getAttributes('video').align === align.type,
    },
  }));
}

function videoSizeMenus(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  const types: BubbleImageOrVideoSizeType[] = ['size-small', 'size-medium', 'size-large'];
  const icons: NonNullable<ButtonViewReturn['componentProps']['icon']>[] = [
    'SizeS',
    'SizeM',
    'SizeL',
  ];

  return types.map((size, i) => ({
    type: `video-${size}`,
    component: ActionButton,
    componentProps: {
      tooltip: t(`editor.${size.replace('-', '.')}.tooltip`),
      icon: icons[i],
      action: () => editor.commands.updateVideo({ width: VIDEO_SIZE[size] }),
      isActive: () => editor.isActive('video', { width: VIDEO_SIZE[size] }),
    },
  }));
}
export function getBubbleImage(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  return [
    {
      // One control cycling through quarter turns, in place of the separate
      // horizontal and vertical flip buttons.
      type: 'rotate',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.tooltip.rotate'),
        icon: 'RotateCwSquare',
        action: () => {
          const { rotate } = getActiveImageAttributes(editor);
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .updateImage({
              rotate: ((((Number(rotate) || 0) + 90) % 360) + 360) % 360,
            })
            .run();
        },
      },
    },
    {
      type: 'caption',
      component: ImageCaptionButton,
      componentProps: { editor },
    },
    ...imageSizeMenus(editor, t),
    ...imageAlignMenus(editor, t),
    {
      type: 'remove',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.remove'),
        icon: 'Trash2',
        action: () => deleteSelectedNode(editor, [Image.name, ImageBlock.name]),
      },
    },
  ];
}

export function getBubbleImageGif(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  return [
    ...imageGifSizeMenus(editor, t),
    ...imageGifAlignMenus(editor, t),
    {
      type: 'remove',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.remove'),
        icon: 'Trash2',
        action: () => deleteSelectedNode(editor, ['imageGif']),
      },
    },
  ];
}

export function getBubbleMermaid(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  return [
    ...imageMermaidAlignMenus(editor, t),
    {
      type: 'edit',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.edit'),
        icon: 'Pencil',
        action: () => {
          return true;
        },
      },
    },
    {
      type: 'remove',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.remove'),
        icon: 'Trash2',
        action: () => deleteSelectedNode(editor, ['mermaid']),
      },
    },
  ];
}

export function getBubbleDrawer(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  return [
    ...imageDrawerAlignMenus(editor, t),
    {
      type: 'edit',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.edit'),
        icon: 'Pencil',
        action: () => {
          return true;
        },
      },
    },
    {
      type: 'remove',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.remove'),
        icon: 'Trash2',
        action: () => deleteSelectedNode(editor, ['richTextDrawer']),
      },
    },
  ];
}

export function getBubbleVideo(editor: Editor, t: (path: string) => string): BubbleMenuItem[] {
  return [
    ...videoSizeMenus(editor, t),
    ...videoAlignMenus(editor),
    {
      type: 'remove',
      component: ActionButton,
      componentProps: {
        editor,
        tooltip: t('editor.remove'),
        icon: 'Trash2',
        action: () => deleteSelectedNode(editor, ['video']),
      },
    },
  ];
}

/**
 * Bubble menu text list
 */
export function getBubbleText(editor: Editor, t: (path: string) => string) {
  return BUBBLE_TEXT_LIST.reduce((acc, type) => {
    if (type === 'divider' && acc.length > 0) {
      return [
        ...acc,
        {
          type: 'divider',
          component: undefined,
          componentProps: {},
        },
      ];
    }

    const ext = editor.extensionManager.extensions.find((ext) => ext.name === type);
    if (ext) {
      if (!ext.configure().options.button) {
        return acc;
      }

      return [...acc, ext.configure().options.button({ editor, t, extension: ext })];
    }

    return acc;
  }, [] as BubbleMenuItem[]);
}
