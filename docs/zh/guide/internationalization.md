---
description: 国际化

next:
  text: 自定义主题
  link: /zh/guide/custom-theme.md
---

# 国际化

该库为其控件和对话框内置了翻译。英语（`en`）是默认语言。切换语言只会改变界面文本，不会翻译文档内容。

## 选择语言

轻量的 `/locale` 入口只包含英语。在选择某种语言之前，需要先引入并注册对应的语言包。可在应用初始化时或在事件处理函数中调用 `localeActions.setLang`：

```tsx
import { localeActions, useLocale } from 'ai-sparkwrite-editor/locale';
import vi from 'ai-sparkwrite-editor/locales/vi';
import ja from 'ai-sparkwrite-editor/locales/ja';

localeActions.setMessage('vi', vi);
localeActions.setMessage('ja', ja);

export function LanguagePicker() {
  const { lang } = useLocale();

  return (
    <select
      aria-label='Editor language'
      value={lang}
      onChange={(event) => localeActions.setLang(event.target.value)}
    >
      <option value='en'>English</option>
      <option value='vi'>Tiếng Việt</option>
      <option value='ja'>日本語</option>
    </select>
  );
}
```

`useLocale()` 返回 `lang`（语言代码）和 `t`（翻译函数）。请在 React 组件内部调用该 hook；`ai-sparkwrite-editor/vue` 导出了一个结构相同的 `useLocale()` 组合式函数。使用 `localeActions.setLang` 按代码切换语言。

语言状态在应用内的所有编辑器实例间共享。该库不会自动在页面刷新后保留语言选择；请在初始化客户端时恢复你应用自身保存的偏好设置。

## 已内置的语言

按全球使用人数排序。

| 语言         | 代码    | 语言包子路径     |
| ------------ | ------- | ---------------- |
| 英语         | `en`    | `/locales/en`    |
| 简体中文     | `zh_CN` | `/locales/zh-cn` |
| 繁體中文     | `zh_TW` | `/locales/zh-tw` |
| 印地语       | `hi`    | `/locales/hi`    |
| 西班牙语     | `es`    | `/locales/es`    |
| 法语         | `fr`    | `/locales/fr`    |
| 孟加拉语     | `bn`    | `/locales/bn`    |
| 巴西葡萄牙语 | `pt_BR` | `/locales/pt-br` |
| 俄语         | `ru`    | `/locales/ru`    |
| 印尼语       | `id`    | `/locales/id`    |
| 德语         | `de`    | `/locales/de`    |
| 日语         | `ja`    | `/locales/ja`    |
| 土耳其语     | `tr`    | `/locales/tr`    |
| 越南语       | `vi`    | `/locales/vi`    |
| 韩语         | `ko`    | `/locales/ko`    |
| 意大利语     | `it`    | `/locales/it`    |
| 匈牙利语     | `hu_HU` | `/locales/hu`    |
| 芬兰语       | `fi`    | `/locales/fi`    |

请使用准确的代码，包括下划线和大小写：其中四个代码与其文件名不同（`zh_CN` → `/locales/zh-cn`、`zh_TW` → `/locales/zh-tw`、`pt_BR` → `/locales/pt-br`、`hu_HU` → `/locales/hu`）。每个语言包都有一个默认导出。例如，将 `/locales/pt-br` 注册到语言代码 `pt_BR` 下。

目前还没有任何从右到左书写的语言：编辑器自身的外壳（工具栏、对话框、气泡菜单）是从左到右排列的，单靠一个 RTL 语言包并不能正确镜像整个界面。无论界面语言是什么，_文档内容_ 的从右到左书写都可以通过文字方向控件支持。

### 按需加载语言

引入全部十六个非英语语言包，gzip 后约为 61 KB。
只在读者选择某种语言时才加载它，可以让初始包体积保持在只含英语的水平；
每个语言包各自成一个 chunk，大小约为 3.5 到 4.5 KB。

加载器必须按语言逐个写出。打包工具无法解析动态的 specifier，
``import(`ai-sparkwrite-editor/locales/${code}`)`` 要么构建失败，
要么会悄悄地把所有语言包都打包进来——下面的映射表让每个 specifier 都保持为字面量：

```tsx
import { useState } from 'react';
import { localeActions, useLocale } from 'ai-sparkwrite-editor/locale';

type Loader = () => Promise<{ default: Record<string, string> }>;

/** English needs no loader: the `/locale` entry already registers it. */
const LANGUAGES: { code: string; label: string; load?: Loader }[] = [
  { code: 'en', label: 'English' },
  { code: 'zh_CN', label: '简体中文', load: () => import('ai-sparkwrite-editor/locales/zh-cn') },
  { code: 'zh_TW', label: '繁體中文', load: () => import('ai-sparkwrite-editor/locales/zh-tw') },
  { code: 'hi', label: 'हिन्दी', load: () => import('ai-sparkwrite-editor/locales/hi') },
  { code: 'es', label: 'Español', load: () => import('ai-sparkwrite-editor/locales/es') },
  { code: 'fr', label: 'Français', load: () => import('ai-sparkwrite-editor/locales/fr') },
  { code: 'bn', label: 'বাংলা', load: () => import('ai-sparkwrite-editor/locales/bn') },
  { code: 'pt_BR', label: 'Português', load: () => import('ai-sparkwrite-editor/locales/pt-br') },
  { code: 'ru', label: 'Русский', load: () => import('ai-sparkwrite-editor/locales/ru') },
  { code: 'id', label: 'Bahasa Indonesia', load: () => import('ai-sparkwrite-editor/locales/id') },
  { code: 'de', label: 'Deutsch', load: () => import('ai-sparkwrite-editor/locales/de') },
  { code: 'ja', label: '日本語', load: () => import('ai-sparkwrite-editor/locales/ja') },
  { code: 'tr', label: 'Türkçe', load: () => import('ai-sparkwrite-editor/locales/tr') },
  { code: 'vi', label: 'Tiếng Việt', load: () => import('ai-sparkwrite-editor/locales/vi') },
  { code: 'ko', label: '한국어', load: () => import('ai-sparkwrite-editor/locales/ko') },
  { code: 'it', label: 'Italiano', load: () => import('ai-sparkwrite-editor/locales/it') },
  { code: 'hu_HU', label: 'Magyar', load: () => import('ai-sparkwrite-editor/locales/hu') },
  { code: 'fi', label: 'Suomi', load: () => import('ai-sparkwrite-editor/locales/fi') },
];

/** Locale state is global, so the cache of loaded dictionaries can be too. */
const registered = new Set(['en']);

export async function selectLanguage(code: string) {
  const entry = LANGUAGES.find((language) => language.code === code);

  if (entry?.load && !registered.has(code)) {
    const { default: messages } = await entry.load();

    localeActions.setMessage(code, messages);
    registered.add(code);
  }

  // Register before selecting, or the interface flashes English first.
  localeActions.setLang(code);
}

export function LanguagePicker() {
  const { lang } = useLocale();
  const [pending, setPending] = useState<string | null>(null);

  async function onSelect(code: string) {
    setPending(code);

    try {
      await selectLanguage(code);
    } catch {
      // A failed chunk leaves the current language in place rather than
      // dropping the reader back to English.
    } finally {
      setPending(null);
    }
  }

  return (
    <select
      aria-label='Editor language'
      disabled={pending !== null}
      value={lang}
      onChange={(event) => onSelect(event.target.value)}
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>
          {label}
        </option>
      ))}
    </select>
  );
}
```

### 匹配浏览器语言

`navigator.language` 是一个 BCP 47 标签（`pt-BR`、`de-AT`、`ja`），
与上面的代码并不完全一致：其中三个使用了下划线。先精确匹配完整标签，
再回退到基础语言：

```ts
/** Reuses LANGUAGES and selectLanguage from the previous example. */
function matchBrowserLanguage(tag: string) {
  const wanted = tag.toLowerCase().replace('_', '-');
  const base = wanted.split('-')[0];
  const normalize = (code: string) => code.toLowerCase().replace('_', '-');

  return (
    LANGUAGES.find((language) => normalize(language.code) === wanted) ??
    LANGUAGES.find((language) => normalize(language.code).split('-')[0] === base)
  );
}

// In a client-only effect, or wherever you initialize the editor:
const match = matchBrowserLanguage(navigator.language);

if (match) {
  await selectLanguage(match.code);
}
```

当某个基础语言有多个变体时，基础语言匹配只是近似处理：
`zh-TW` 会精确匹配到 `zh_TW`，但 `zh-HK`、`zh-MO`、`zh-Hant` 只能按基础语言匹配，
得到 `LANGUAGES` 里排在前面的那种中文。如果这对你的用户很重要，请把它们显式映射到 `zh_TW`。

### 兼容入口

从 `ai-sparkwrite-editor/locale-bundle` 引入的现有代码仍可正常工作，并会自动注册所有内置语言。当你需要用到全部语言时使用该入口；如果想避免加载未使用的翻译，则使用 `/locale` 搭配各个语言包。两个入口共享同一份语言状态。

## 覆盖已有文案

`setMessage` 会将传入的键合并到该语言当前的文案中。你可以只覆盖单条文案，而无需复制整个语言包：

```ts
import { localeActions } from 'ai-sparkwrite-editor/locale';

localeActions.setMessage('en', {
  'editor.remove': 'Delete',
});
```

## 添加一种语言

从导出的英语语言包开始，覆盖你已翻译的键，然后选择新语言：

```ts
import { en, localeActions } from 'ai-sparkwrite-editor/locale';

localeActions.setMessage('fr', {
  ...en,
  'editor.remove': 'Supprimer',
});
localeActions.setLang('fr');
```

展开 `en` 是可选的：缺失的翻译会回退到当前的英语文案，如果英语中也没有对应的值，则回退到消息键本身。请在选择新的语言代码之前先注册文案，以避免在语言包加载期间短暂显示英语。

## 在自定义控件中使用翻译

```tsx
import { useLocale } from 'ai-sparkwrite-editor/locale';

export function RemoveLabel() {
  const { t } = useLocale();
  return <span>{t('editor.remove')}</span>;
}
```

对于包含占位符（如 `{count}`）的文案，将一个值对象作为 `t` 的第二个参数传入。翻译时请保留占位符名称不变。导出的 `en` 对象以及 TypeScript 的自动补全提供了可用的消息键列表。
