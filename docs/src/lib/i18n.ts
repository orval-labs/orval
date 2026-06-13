import { defineI18n } from 'fumadocs-core/i18n';
import { defineI18nUI } from 'fumadocs-ui/i18n';

export const i18n = defineI18n({
  languages: ['en', 'zh'],
  defaultLanguage: 'en',
  hideLocale: 'default-locale',
  parser: 'dir',
  fallbackLanguage: 'en',
});

export type Locale = (typeof i18n.languages)[number];

const LOCALE_SET = new Set<string>(i18n.languages);

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && LOCALE_SET.has(value);
}

export function getDocsLocale(locale: string | undefined): Locale | undefined {
  if (!locale) return i18n.defaultLanguage;
  if (isLocale(locale)) return locale;
}

export function getLocaleFromPathname(pathname: string): Locale {
  const [first] = pathname.split('/').filter(Boolean);
  return isLocale(first) ? first : i18n.defaultLanguage;
}

export function getLocalizedPath(pathname: string, locale: Locale): string {
  const segments = pathname.split('/').filter(Boolean);
  const currentLocale = isLocale(segments[0])
    ? segments.shift()
    : i18n.defaultLanguage;

  if (currentLocale === locale && locale !== i18n.defaultLanguage) {
    return `/${[locale, ...segments].join('/')}`;
  }

  if (locale === i18n.defaultLanguage) {
    return `/${segments.join('/')}`;
  }

  return `/${[locale, ...segments].join('/')}`;
}

export const i18nUI = defineI18nUI(i18n, {
  translations: {
    en: {
      displayName: 'English',
    },
    zh: {
      displayName: '简体中文',
      search: '搜索',
      searchNoResult: '未找到结果',
      toc: '本页目录',
      tocNoHeadings: '暂无标题',
      lastUpdate: '最后更新于',
      chooseLanguage: '选择语言',
      nextPage: '下一页',
      previousPage: '上一页',
      chooseTheme: '主题',
      editOnGithub: '在 GitHub 上编辑',
    },
  },
});
