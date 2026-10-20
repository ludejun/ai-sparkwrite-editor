import { ReactRenderer } from '@tiptap/react';

import { AICore } from './AICore';
import { AIPanel } from './AIPanel';

import type { AIOptions, AIPanelComponentProps, AIResultContext } from './types';
import type { ComponentType, ReactNode } from 'react';

export type {
  AIOptions,
  AIProtocol,
  AIMessage,
  AIRequest,
  AIResultContext,
  AIPanelComponentProps,
  AIWriteTarget,
} from './types';
export {
  markdownToFragment,
  markdownToHTML,
  markdownToPreviewHTML,
  markdownToSlice,
} from './markdown';
export { aiPluginKey } from './state';
export type { AIPlacement } from './session';
export type { AIState, AISession, AIWriting } from './state';
export { AICore, DEFAULT_AI_SYSTEM_PROMPT } from './AICore';
export {
  writeWithAI,
  aiOptionsOf,
  resolveWriteTarget,
  documentContext,
  rangeMarkdown,
} from './writer';
export type { WriteWithAIOptions, WriteWithAIResult } from './writer';
export { AI_COMPOSER_ACTIONS, composerPrompt, browserLanguage } from './composer';
export type { AIComposerAction } from './composer';
export { AIAutocomplete, aiAutocompleteKey } from './Autocomplete';
export type { AIAutocompleteOptions, AIAutocompleteState, AISuggestion } from './Autocomplete';
export { generateAIText } from './client';

/** Options of the React `AI` extension: the core options plus React rendering hooks. */
export interface AIReactOptions extends AIOptions {
  /**
   * Replace how the answer is shown in the panel. Receives the markdown so
   * far, the HTML the editor would produce from it, and whether more is
   * coming. The default renders `html` with the document's own styles.
   */
  renderResult?: (context: AIResultContext) => ReactNode;
  /** Replace UI pieces wholesale. `Panel` takes over the entire AI dialog. */
  components?: {
    Panel?: ComponentType<AIPanelComponentProps>;
  };
}

function mountReactPanel(mount: HTMLElement, props: AIPanelComponentProps): () => void {
  const Panel = (props.options as AIReactOptions).components?.Panel ?? AIPanel;
  const renderer = new ReactRenderer(Panel, { editor: props.editor, props });
  mount.appendChild(renderer.element);
  return () => {
    renderer.destroy();
    renderer.element.remove();
  };
}

/**
 * The AI extension for React: `AICore` with the React panel. Register it
 * once; `RichTextAIImprove` (selection menu), `RichTextAIComposer` (the dock
 * under the editor) and the slash command all find it by name.
 */
export const AI = /* @__PURE__ */ AICore.extend<AIReactOptions>({
  addOptions() {
    const parent = this.parent?.() as AIReactOptions;
    return {
      ...parent,
      mountPanel: mountReactPanel,
    };
  },
});
