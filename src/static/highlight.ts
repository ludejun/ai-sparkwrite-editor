import { tokenize } from 'rangi';

import { guessLanguage } from '@/extensions/CodeBlock/detect-language';
import { languageLabel } from '@/extensions/CodeBlock/languages';

import { escapeText } from './serialize';

export interface CodeToken {
  /** Rangi token type (`kwd`, `str`, `cmnt`…), or `undefined` for plain text. */
  type?: string;
  text: string;
}

export interface HighlightResult {
  /** The language the colours come from: the block's own, else the guessed one, else `plain`. */
  language: string;
  /** `true` when the block had no language and `language` was guessed (the editor shows `· Auto`). */
  detected: boolean;
  /** The label the editor's language picker shows for `language`. */
  label: string;
  tokens: CodeToken[];
}

/**
 * Tokenizes a code block exactly like the editor's highlighter (`RangiPlugin`):
 * the block's language, else the editor's `guessLanguage`, through Rangi.
 * Unknown languages fall back to unhighlighted text instead of throwing.
 */
export function highlightCode(code: string, language?: string | null): HighlightResult {
  const explicit = typeof language === 'string' && language.length > 0 ? language : null;
  const resolved = explicit ?? guessLanguage(code);
  let tokens: CodeToken[];
  try {
    tokens = tokenize(code, { lang: resolved }).map((t) => ({
      type: t.type || undefined,
      text: t.text,
    }));
  } catch {
    tokens = [{ text: code }];
  }
  return {
    language: resolved,
    detected: !explicit && resolved !== 'plain',
    label: languageLabel(resolved),
    tokens,
  };
}

/** Token spans with the editor's decoration classes (`shj-<type>`), as HTML. */
export function tokensToHTML(tokens: CodeToken[], classPrefix = 'shj-'): string {
  return tokens
    .map((t) =>
      t.type && t.text
        ? `<span class="${classPrefix}${t.type}">${escapeText(t.text)}</span>`
        : escapeText(t.text)
    )
    .join('');
}
