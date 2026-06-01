import { docs } from 'fumadocs-mdx:collections/server';
import { loader, update } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';

import { i18n, isLocale } from '@/lib/i18n';

const defaultLocalePrefix = `${i18n.defaultLanguage}/`;

const docsSource = update(docs.toFumadocsSource())
  .files((files) =>
    files.map((file) => {
      const [first] = file.path.split('/');
      if (isLocale(first)) return file;

      return {
        ...file,
        path: `${defaultLocalePrefix}${file.path}`,
      };
    }),
  )
  .build();

export function toClientContentPath(path: string) {
  if (path.startsWith(defaultLocalePrefix)) {
    return path.slice(defaultLocalePrefix.length);
  }

  return path;
}

export const source = loader({
  source: docsSource,
  baseUrl: '/docs',
  i18n,
  plugins: [lucideIconsPlugin()],
});
