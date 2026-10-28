import { version } from '../../package.json';

import { createTranslate } from './i18n/utils';

import type { DefaultTheme, HeadConfig, LocaleConfig } from 'vitepress';

const docsLink = 'https://ludejun.github.io/ai-sparkwrite-editor';
// Head links are not base-aware, unlike `themeConfig.logo`.
const base = (process.env.DOCS_BASE ?? '/').replace(/\/?$/, '/');
const githubRepo = 'ludejun/ai-sparkwrite-editor';
const githubLink: 'https://github.com/ludejun/ai-sparkwrite-editor' = `https://github.com/${githubRepo}`;

export function getLocaleConfig(lang: string) {
  const t = createTranslate(lang);

  const zh = lang === 'zh';
  const urlPrefix = zh ? '/zh' : '';

  const versions: (DefaultTheme.NavItemWithLink | DefaultTheme.NavItemChildren)[] = [
    { text: `v${version} ${t('(current)')}`, link: `${urlPrefix}/` },
    {
      text: t('Release Notes'),
      link: 'https://github.com/ludejun/ai-sparkwrite-editor/releases',
    },
    {
      text: t('Contributing'),
      link: 'https://github.com/ludejun/ai-sparkwrite-editor/blob/main/CONTRIBUTING.md',
    },
  ];
  // `text` lets a folder keep its name while the sidebar shows what people look for
  // (the Iframe extension is listed as "Embed").
  const ext = (name: string, text = name): DefaultTheme.SidebarItem => ({
    text,
    link: `${urlPrefix}/extensions/${name}/index.md`,
  });
  const title = 'ai-sparkwrite-editor';
  const description = t(
    'AI-first rich-text editor SDK on Tiptap: streaming AI writing as real document nodes, formulas and diagrams from a sentence, real-time collaboration (Yjs), 16 languages, session replay. React and Vue UIs, framework-agnostic core.'
  );

  const head: HeadConfig[] = [
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: docsLink }],
    ['meta', { property: 'og:image', content: `${docsLink}/og.png` }],
    ['meta', { property: 'twitter:image', content: `${docsLink}/og.png` }],
    ['meta', { property: 'twitter:card', content: 'summary_large_image' }],
    ['link', { rel: 'icon', href: `${base}favicon.ico`, type: 'image/x-icon' }],
    ['link', { rel: 'icon', href: `${base}favicon-32x32.png`, type: 'image/png', sizes: '32x32' }],
    ['meta', { name: 'theme-color', content: '#7c3aed' }],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        href: `${base}apple-touch-icon.png`,
        sizes: '180x180',
      },
    ],
  ];

  const nav: DefaultTheme.NavItem[] = [
    {
      text: t('Guide'),
      link: `${urlPrefix}/guide/getting-started`,
      activeMatch: 'guide',
    },
    {
      text: t('Extensions'),
      link: `${urlPrefix}/extensions/AI/index.md`,
      activeMatch: 'extensions',
    },
    {
      text: t('Playground'),
      link: 'https://ludejun.github.io/ai-sparkwrite-editor/playground/',
    },
    {
      text: `v${version}`,
      items: versions,
    },
  ];

  const sidebar: DefaultTheme.SidebarItem[] = [
    {
      text: t('Guide'),
      items: [
        {
          text: t('Getting Started'),
          link: `${urlPrefix}/guide/getting-started`,
        },
        {
          text: 'RichTextKit',
          link: `${urlPrefix}/guide/kit`,
        },
        {
          text: t('Toolbar'),
          link: `${urlPrefix}/guide/toolbar`,
        },
        {
          text: t('Features'),
          link: `${urlPrefix}/guide/features`,
        },
        {
          text: t('Frameworks'),
          link: `${urlPrefix}/guide/frameworks`,
        },
        {
          text: t('Collaboration'),
          link: `${urlPrefix}/guide/collaboration`,
        },
        {
          text: t('Customization'),
          link: `${urlPrefix}/guide/customization`,
        },
        {
          text: t('Bundle size'),
          link: `${urlPrefix}/guide/bundle-size`,
        },
        {
          text: t('Bubble Menu'),
          link: `${urlPrefix}/guide/bubble-menu`,
        },
        {
          text: t('Internationalization'),
          link: `${urlPrefix}/guide/internationalization`,
        },
        {
          text: t('Custom Theme'),
          link: `${urlPrefix}/guide/custom-theme`,
        },
        {
          text: t('How to Migrate'),
          link: `${urlPrefix}/guide/how-to-migrate`,
        },
        {
          text: t('AI Coding Agents'),
          link: `${urlPrefix}/guide/ai-agents`,
        },
      ],
    },
    {
      text: t('Extensions'),
      items: [
        ext('AI'),
        ext('Attachment'),
        ext('Blockquote'),
        ext('Bold'),
        ext('BulletList'),
        ext('Callout'),
        ext('Clear'),
        ext('Code'),
        ext('CodeBlock'),
        ext('CodeView'),
        ext('Color'),
        ext('Column'),
        ext('Details'),
        ext('Drawer'),
        ext('Iframe', 'Embed'),
        ext('Emoji'),
        ext('Excalidraw'),
        ext('ExportPdf'),
        ext('ExportWord'),
        ext('ExportMarkdown'),
        ext('FontFamily'),
        ext('FontSize'),
        ext('FormatPainter'),
        ext('Heading'),
        ext('Highlight'),
        ext('History'),
        ext('HorizontalRule'),
        ext('Image'),
        ext('ImageGif'),
        ext('ImportWord'),
        ext('Indent'),
        ext('Italic'),
        ext('Katex'),
        ext('LineHeight'),
        ext('Link'),
        ext('Mention'),
        ext('Mermaid'),
        ext('MoreMark'),
        ext('Notice'),
        ext('OrderedList'),
        ext('Recorder'),
        ext('RichPaste'),
        ext('SearchAndReplace'),
        ext('ShortMessage'),
        ext('SlashCommand'),
        ext('Strike'),
        ext('Table'),
        ext('TableOfContents'),
        ext('TaskList'),
        ext('TextAlign'),
        ext('TextDirection'),
        ext('TextUnderline'),
        ext('Twitter'),
        ext('Video'),
      ],
    },
  ];

  const themeConfig: DefaultTheme.Config = {
    logo: '/logo.svg',
    nav,
    sidebar,
    socialLinks: [
      { icon: 'github', link: githubLink },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/ai-sparkwrite-editor',
      },
    ],
    footer: {
      message: t('Made with ❤️'),
      copyright: 'MIT License © 2026-PRESENT <a href="https://github.com/ludejun">ludejun</a>',
    },
    editLink: {
      pattern: `${githubLink}/edit/main/docs/:path`,
      text: t('Edit this page on GitHub'),
    },
    outline: { label: t('On this page'), level: [2, 3] },
    docFooter: { prev: t('Previous page'), next: t('Next page') },
    lastUpdated: { text: t('Last updated') },
    returnToTopLabel: t('Return to top'),
    sidebarMenuLabel: t('Menu'),
    darkModeSwitchLabel: t('Appearance'),
    lightModeSwitchTitle: t('Switch to light theme'),
    darkModeSwitchTitle: t('Switch to dark theme'),
    langMenuLabel: t('Change language'),
    notFound: {
      title: t('Page not found'),
      quote: t('The page you are looking for does not exist or has moved.'),
      linkLabel: t('go to home'),
      linkText: t('Take me home'),
    },
  };

  const localeConfig: LocaleConfig<DefaultTheme.Config>[string] = {
    label: zh ? '简体中文' : 'English',
    lang: zh ? 'zh-CN' : 'en-US',
    ...(zh ? { link: '/zh/' } : {}),
    title,
    description,
    head,
    themeConfig,
  };

  return localeConfig;
}
