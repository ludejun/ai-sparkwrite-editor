import { PluginKey } from '@tiptap/pm/state';

import type { Range } from '@tiptap/core';

/** An open Ask-AI panel: the range it will replace and a preset prompt. */
export interface AISession extends Range {
  prompt?: string;
  /**
   * Set when the session is opened; copies mapped through edits keep it, so
   * an `external` panel survives them.
   */
  id?: number;
}

/** A span the AI is currently writing into, kept mapped through other edits. */
export interface AIWriting extends Range {}

export interface AIState {
  session: AISession | null;
  writing: AIWriting | null;
  /** The composer dock under the editor is open. */
  composer: boolean;
}

export type AIAction =
  | { type: 'session'; session: AISession | null }
  | { type: 'writing'; writing: AIWriting | null }
  | { type: 'composer'; open: boolean };

export const aiPluginKey = new PluginKey<AIState>('richtextAI');
