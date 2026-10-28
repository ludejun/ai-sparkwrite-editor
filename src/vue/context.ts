/* oxlint-disable react-hooks/rules-of-hooks -- Vue composables, not React hooks */
import {
  defineComponent,
  h,
  inject,
  onBeforeUnmount,
  provide,
  shallowRef,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
  type ShallowRef,
} from 'vue';

import { formatMessage, getLocaleState, subscribeLocale } from '@/locales/store';
import { watchEditable } from '@/utils/editable';

import type { Editor } from '@tiptap/core';

/** The editor the controls act on. Provided by `RichTextProvider`. */
export const EDITOR_KEY: InjectionKey<ShallowRef<Editor | null | undefined>> =
  Symbol('sparkwrite-editor');

/** The provided editor, or an empty ref outside a provider. */
export function useEditorInstance(): ShallowRef<Editor | null | undefined> {
  return inject(EDITOR_KEY, () => shallowRef<Editor | null | undefined>(null), true);
}

/**
 * Wraps the toolbar and `EditorContent`, hands the editor to every control
 * below it, and carries the root class the stylesheet keys off.
 */
export const RichTextProvider = defineComponent({
  name: 'RichTextProvider',
  props: {
    editor: { type: Object as PropType<Editor | null | undefined>, default: null },
    dark: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const editor = shallowRef<Editor | null | undefined>(props.editor);

    watch(
      () => props.editor,
      (next) => {
        editor.value = next;
      }
    );
    provide(EDITOR_KEY, editor);

    return () => h('div', { class: ['sparkwrite', props.dark ? 'dark' : null] }, slots.default?.());
  },
});

/**
 * A value derived from the editor that re-renders on every transaction —
 * `isActive('bold')`, `can().undo()`, the current heading level.
 */
export function useEditorState<T>(selector: (editor: Editor) => T, fallback: T): Ref<T> {
  const editor = useEditorInstance();
  const state = shallowRef<T>(fallback) as Ref<T>;
  let detach: (() => void) | null = null;

  watch(
    editor,
    (current) => {
      detach?.();
      detach = null;

      if (!current) {
        state.value = fallback;
        return;
      }

      const update = () => {
        state.value = current.isDestroyed ? fallback : selector(current);
      };

      update();
      current.on('transaction', update);
      current.on('focus', update);
      current.on('blur', update);
      // `setEditable(x, false)` runs no transaction.
      const stopEditable = watchEditable(current, update);
      detach = () => {
        current.off('transaction', update);
        current.off('focus', update);
        current.off('blur', update);
        stopEditable();
      };
    },
    { immediate: true }
  );

  onBeforeUnmount(() => detach?.());

  return state;
}

/** Reactive translations: `t()` re-renders when the language changes. */
export function useLocale() {
  const state = shallowRef(getLocaleState());
  const stop = subscribeLocale(() => {
    state.value = getLocaleState();
  });

  onBeforeUnmount(stop);

  const t = (key: string, params?: Record<string, string | number>) => {
    const { currentLang, message } = state.value;
    const table = message as Record<string, Record<string, string> | undefined>;
    const template = table[currentLang]?.[key] || table.en?.[key] || key;

    return formatMessage(template, params);
  };

  return { t, lang: () => state.value.currentLang };
}
