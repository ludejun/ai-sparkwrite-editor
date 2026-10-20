import type { DividerVariantOption } from '@/extensions/Divider/Divider';

/**
 * Ornamental divider looks for long-form articles, on top of the divider's
 * built-in ones. Styled by `styles/blocks.scss` (`.divider--<name>`); pass
 * them (or a selection) as the divider's `variants` option to offer them:
 *
 * ```ts
 * RichTextKit.configure({ divider: { variants: ARTICLE_DIVIDER_VARIANTS } })
 * ```
 */
export const ORNAMENT_DIVIDER_VARIANTS = [
  'gradient',
  'diamond',
  'trio',
  'wave',
  'starsea',
  'leaf',
  'end',
  'bar',
  'pen',
  'ribbon',
  'ink',
  'fade',
] as const;

export type OrnamentDividerVariant = (typeof ORNAMENT_DIVIDER_VARIANTS)[number];

/** A ready-made picker: three of the built-in looks plus every ornament, in menu order. */
export const ARTICLE_DIVIDER_VARIANTS: DividerVariantOption[] = [
  'fade',
  'gradient',
  'dotted',
  'double',
  'bar',
  'diamond',
  'trio',
  'dots',
  'wave',
  'starsea',
  'leaf',
  'pen',
  'ribbon',
  'ink',
  'end',
].map((value) => ({ value }));
