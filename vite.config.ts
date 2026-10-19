import * as fs from 'node:fs';
import * as path from 'node:path';

import react from '@vitejs/plugin-react';
import autoprefixer from 'autoprefixer';
import { globbySync } from 'globby';
import postcssReplace from 'postcss-replace';
import { esmExternalRequirePlugin } from 'rolldown/plugins';
import tailwind from 'tailwindcss';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';

const rootDir = import.meta.dirname;

// React is externalized through esmExternalRequirePlugin (see rolldownOptions.plugins) so that
// bundled CommonJS deps (e.g. use-sync-external-store) get `import` instead of a runtime `require`.
const reactExternal = /^react(-dom)?(\/|$)/;

const externalPackages = [
  'vue',
  '@tiptap/vue-3',
  'lucide-vue-next',
  'katex',
  'docx',
  '@radix-ui/react-dropdown-menu',
  '@radix-ui/react-icons',
  '@radix-ui/react-label',
  '@radix-ui/react-popover',
  '@radix-ui/react-separator',
  '@radix-ui/react-slot',
  '@radix-ui/react-switch',
  '@radix-ui/react-tabs',
  '@radix-ui/react-toast',
  '@radix-ui/react-toggle',
  '@radix-ui/react-tooltip',
  '@radix-ui/react-select',
  '@radix-ui/react-checkbox',
  'react-colorful',
  'scroll-into-view-if-needed',
  'lucide-react',
  'prosemirror-docx',
  're-resizable',
  '@excalidraw/excalidraw',
  '@radix-ui/react-dialog',
  'react-image-crop',
  'mermaid',
  'easydrawer',
  'frimousse',
  'mammoth',
  // Yjs must be one copy shared with the host app (Y.Doc instanceof checks, the "Yjs was already imported" trap)
  'yjs',
  'y-protocols',
];

const normalizePath = (id: string) => id.replaceAll('\\', '/');

// Kept apart: `useAttributes` is a React hook, `json` is framework-free and
// reached from the core and Vue entries, which must not pick up React.
const editorHookModules = new Set(
  ['src/hooks/useAttributes.tsx'].map((file) => normalizePath(path.resolve(rootDir, file)))
);
const editorUtilsModules = new Set(
  ['src/utils/json.ts', 'src/utils/utils.ts'].map((file) =>
    normalizePath(path.resolve(rootDir, file))
  )
);

export default defineConfig(({ mode }) => {
  const isDev = mode !== 'production';

  const entryFiles = [
    'src/index.ts',
    'src/core.ts',
    'src/static.ts',
    'src/vue/index.ts',
    'src/locale-bundle.ts',
    'src/locale.ts',
    ...globbySync('src/locales/*.ts', { cwd: rootDir, ignore: ['**/index.ts'] }).sort(),
    'src/bubble.ts',
    'src/theme/theme.ts',
    ...globbySync('src/components/Bubble/RichText*.tsx', { cwd: rootDir }).sort(),
  ];

  const entry: Record<string, string> = Object.fromEntries(
    entryFiles.map((file) => [
      // `src/vue/index.ts` would otherwise collide with `src/index.ts`.
      file === 'src/vue/index.ts' ? 'vue' : path.basename(file, path.extname(file)),
      path.resolve(rootDir, file),
    ])
  );

  // One entry per extension folder, built from its index.ts (extension +
  // React controls) and named after the folder. The extension module itself
  // (`<Name>/<Name>.ts`) stays free of component re-exports so `core.ts` can
  // share it without dragging React in.
  for (const file of globbySync('src/extensions/*/index.ts', { cwd: rootDir }).sort()) {
    const dir = path.basename(path.dirname(file));

    if (fs.existsSync(path.resolve(rootDir, `src/extensions/${dir}/${dir}.ts`))) {
      entry[dir] = path.resolve(rootDir, file);
    }
  }

  return {
    plugins: [react(), dts()],
    resolve: {
      alias: [{ find: '@', replacement: path.resolve(rootDir, 'src') }],
    },
    css: {
      postcss: {
        plugins: [
          tailwind(),
          autoprefixer(),
          postcssReplace({
            pattern: /(--tw|\*, ::before, ::after)/g,
            data: {
              '--tw': '--richtext', // Prefixing
              '*, ::before, ::after': ':root', // So variables does not pollute every element
            },
          }),
        ],
      },
      preprocessorOptions: {
        scss: {
          charset: false,
          api: 'modern-compiler', // or 'modern'
        },
      },
    },
    build: {
      cssMinify: isDev ? false : 'lightningcss',
      minify: isDev ? false : 'oxc',
      outDir: 'lib',
      sourcemap: isDev,
      lib: {
        entry,
        cssFileName: 'style',
        formats: ['es', 'cjs'],
        fileName: (format, entryName) => {
          if (format === 'es') return `${entryName}.js`;

          return `${entryName}.cjs`;
        },
      },
      rolldownOptions: {
        plugins: [esmExternalRequirePlugin({ external: [reactExternal] })],
        // A dynamic import anywhere made rolldown emit two entries (Notice,
        // RichTextBubbleNotice) as hashed chunks instead of the named files the
        // package exports point at; keeping entry signatures strict stops that.
        preserveEntrySignatures: 'strict',
        output: {
          // Keep generic helpers out of feature chunks with heavy external imports.
          codeSplitting: {
            groups: [
              {
                name: 'editor-hooks',
                test: (id) => editorHookModules.has(normalizePath(id)),
              },
              {
                name: 'editor-utils',
                test: (id) => editorUtilsModules.has(normalizePath(id)),
              },
            ],
          },
        },
        // Keep Tiptap and React shared with the consuming application.
        external: (id) =>
          id.startsWith('@tiptap/') ||
          externalPackages.some((pkg) => id === pkg || id.startsWith(`${pkg}/`)),
      },
    },
  };
});
