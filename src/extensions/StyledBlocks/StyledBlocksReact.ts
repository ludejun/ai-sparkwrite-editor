import { ReactNodeViewRenderer } from '@tiptap/react';

import { NodeViewCard } from '@/extensions/StyledBlocks/components/NodeViewCard';
import { BlockStyles, CardCore, StyledBlocksCore } from '@/extensions/StyledBlocks/StyledBlocks';

export * from '@/extensions/StyledBlocks/StyledBlocks';
export * from '@/extensions/StyledBlocks/ornaments';

/** `CardCore` with the React node view: the box plus its style handle. */
export const Card = /* @__PURE__ */ CardCore.extend({
  addNodeView() {
    return ReactNodeViewRenderer(NodeViewCard);
  },
});

/** Styled headings, quotes and cards (with the card's React node view). */
export const StyledBlocks = /* @__PURE__ */ StyledBlocksCore.extend({
  addExtensions() {
    const list = [];
    if (this.options.blockStyles !== false)
      list.push(BlockStyles.configure(this.options.blockStyles));
    if (this.options.card !== false) list.push(Card.configure(this.options.card));
    return list;
  },
});
