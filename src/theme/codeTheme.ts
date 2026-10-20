/**
 * Code block palette (GitHub Light / GitHub Dark).
 *
 * Kept apart from THEME because syntax colours should not change with the
 * accent, and injected alongside it because the editor's dark mode is a set of
 * custom properties rather than a `.dark` class.
 */
export const CODE_THEME = {
  light: {
    'shj-bg': '#f6f8fa',
    'shj-fg': '#1f2328',
    'shj-border': 'rgb(31 35 40 / 12%)',
    'shj-numbers': '#8c959f',
    'shj-selection': 'rgb(84 140 210 / 25%)',
    'shj-inline-bg': 'rgb(175 184 193 / 22%)',
    'shj-kwd': '#cf222e',
    'shj-deleted': '#82071e',
    'shj-err': '#82071e',
    'shj-class': '#953800',
    'shj-cmnt': '#6e7781',
    'shj-num': '#0550ae',
    'shj-bool': '#0550ae',
    'shj-type': '#0550ae',
    'shj-oper': '#0550ae',
    'shj-section': '#0550ae',
    'shj-var': '#953800',
    'shj-str': '#0a3069',
    'shj-esc': '#0a3069',
    'shj-func': '#8250df',
    'shj-insert': '#116329',
  },
  dark: {
    'shj-bg': '#0d1117',
    'shj-fg': '#e6edf3',
    'shj-border': 'rgb(240 246 252 / 10%)',
    'shj-numbers': '#6e7681',
    'shj-selection': 'rgb(120 170 255 / 28%)',
    'shj-inline-bg': 'rgb(110 118 129 / 40%)',
    'shj-kwd': '#ff7b72',
    'shj-deleted': '#ffa198',
    'shj-err': '#ffa198',
    'shj-class': '#ffa657',
    'shj-cmnt': '#8b949e',
    'shj-num': '#79c0ff',
    'shj-bool': '#79c0ff',
    'shj-type': '#79c0ff',
    'shj-oper': '#79c0ff',
    'shj-section': '#79c0ff',
    'shj-var': '#ffa657',
    'shj-str': '#a5d6ff',
    'shj-esc': '#a5d6ff',
    'shj-func': '#d2a8ff',
    'shj-insert': '#7ee787',
  },
} as const;
