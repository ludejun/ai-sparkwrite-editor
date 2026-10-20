/**
 * Overflow planning for the kit toolbar's `overflow='collapse'` mode: given
 * the natural width of every group and the width of the row, decide which
 * groups stay on the single line and which move into the "More tools" panel.
 *
 * `planToolbar` is pure so it runs in Node for tests; `measureToolbar` reads
 * the numbers it needs from a rendered toolbar. Both are shared by the React
 * and Vue kit toolbars.
 */

export interface ToolbarGroupSpec {
  /** Stable id (`colors`, `align`, `pin:fontSize`…), reported in `data-collapsed`. */
  id: string;
  /**
   * Collapse order: the lowest priority collapses first; `null` never
   * collapses. Equal priorities collapse from the right.
   */
  priority: number | null;
  /**
   * Divider slot the group sits in; consecutive groups with the same segment
   * get no divider between them. Default: the group's own id.
   */
  segment?: string;
}

export interface ToolbarPlanInput {
  /** Groups in display order; only groups that render something. */
  groups: ToolbarGroupSpec[];
  /** Natural width of each group by id, in px. A group without a width counts as 0. */
  widths: Record<string, number | undefined>;
  /** Content width of the row, in px. */
  available: number;
  /** Space between two adjacent items of the row (the flex `gap`). Default 0. */
  gap?: number;
  /** Cost of one divider: its width, margins and the extra gap it adds. Default 0. */
  dividerWidth?: number;
  /** Width taken whatever the groups are — the "More" trigger and its gap. Default 0. */
  reserved?: number;
}

export interface ToolbarPlan {
  /** Ids of the groups on the row, in display order. */
  inline: string[];
  /** Ids of the groups moved into the panel, in the order they were collapsed. */
  collapsed: string[];
  /** Width the inline groups take, dividers and reserved space included. */
  width: number;
}

/** Divider slot of a group. */
export const segmentOf = (group: ToolbarGroupSpec): string => group.segment ?? group.id;

/** Number of divider slots the inline groups form: runs of groups sharing a segment. */
function countSegments(groups: ToolbarGroupSpec[]): number {
  let segments = 0;
  groups.forEach((group, index) => {
    if (index === 0 || segmentOf(group) !== segmentOf(groups[index - 1])) segments += 1;
  });
  return segments;
}

function rowWidth(groups: ToolbarGroupSpec[], input: ToolbarPlanInput): number {
  const { widths, gap = 0, dividerWidth = 0, reserved = 0 } = input;
  if (!groups.length) return reserved;
  const content = groups.reduce((sum, group) => sum + (widths[group.id] ?? 0), 0);
  const dividers = countSegments(groups) - 1;
  return content + (groups.length - 1) * gap + dividers * dividerWidth + reserved;
}

/**
 * Removes groups from the row, lowest priority first (ties from the right),
 * until it fits or only groups that never collapse are left. The result is
 * a function of the inputs alone, so a wider row brings groups straight back.
 */
export function planToolbar(input: ToolbarPlanInput): ToolbarPlan {
  const inline = [...input.groups];
  const collapsed: string[] = [];
  let width = rowWidth(inline, input);

  while (width > input.available) {
    let pick = -1;
    inline.forEach((group, index) => {
      if (group.priority === null) return;
      if (pick === -1 || group.priority <= (inline[pick].priority as number)) pick = index;
    });
    if (pick === -1) break;
    collapsed.push(inline[pick].id);
    inline.splice(pick, 1);
    width = rowWidth(inline, input);
  }

  return { inline: inline.map((group) => group.id), collapsed, width };
}

export interface ToolbarMetrics {
  available: number;
  gap: number;
  dividerWidth: number;
  reserved: number;
  /** Width of every group currently on the row, by `data-toolbar-group`. */
  widths: Record<string, number>;
}

/** Selectors the kit toolbars mark their parts with, so measuring needs no refs per group. */
export const TOOLBAR_GROUP_ATTR = 'data-toolbar-group';
export const TOOLBAR_DIVIDER_CLASS = 'richtext-kit-toolbar__divider';
export const TOOLBAR_MORE_CLASS = 'richtext-kit-toolbar-more';

const px = (value: string) => Number.parseFloat(value) || 0;

/** Reads the row's content width, its gap, and the natural width of each group on it. */
export function measureToolbar(root: HTMLElement): ToolbarMetrics {
  const style = getComputedStyle(root);
  const gap = px(style.columnGap);
  const rect = root.getBoundingClientRect();
  const available =
    rect.width -
    px(style.paddingLeft) -
    px(style.paddingRight) -
    px(style.borderLeftWidth) -
    px(style.borderRightWidth);

  const widths: Record<string, number> = {};
  root.querySelectorAll<HTMLElement>(`:scope > [${TOOLBAR_GROUP_ATTR}]`).forEach((element) => {
    widths[element.getAttribute(TOOLBAR_GROUP_ATTR) as string] =
      element.getBoundingClientRect().width;
  });

  const divider = root.querySelector<HTMLElement>(`:scope > .${TOOLBAR_DIVIDER_CLASS}`);
  let dividerWidth = 5 + gap; // 1px line with 2px margins, the kit toolbar's default
  if (divider) {
    const dividerStyle = getComputedStyle(divider);
    dividerWidth =
      divider.getBoundingClientRect().width +
      px(dividerStyle.marginLeft) +
      px(dividerStyle.marginRight) +
      gap;
  }

  const more = root.querySelector<HTMLElement>(`:scope > .${TOOLBAR_MORE_CLASS}`);
  const reserved = more ? more.getBoundingClientRect().width + gap : 0;

  return { available, gap, dividerWidth, reserved, widths };
}
