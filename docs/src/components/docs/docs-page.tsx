import browserCollections from "fumadocs-mdx:collections/browser";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { SerializedPageTree } from "fumadocs-core/source/client";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { Suspense } from "react";

import { getDocsLocale, type Locale } from "@/lib/i18n";
import { baseOptions } from "@/lib/layout.shared";
import { source, toClientContentPath } from "@/lib/source";

export interface DocsRouteData {
  locale: Locale;
  path: string;
  pageTree: SerializedPageTree;
}

interface ServerLoaderInput {
  locale?: string;
  slugs: string[];
}

export async function loadDocsRoute(data: ServerLoaderInput) {
  const routeData = await serverLoader({ data });
  await clientLoader.preload(routeData.path);
  return routeData;
}

const serverLoader = createServerFn({
  method: "GET",
})
  .inputValidator((data: ServerLoaderInput) => data)
  .handler(async ({ data }) => {
    const locale = getDocsLocale(data.locale);
    if (!locale) throw notFound();

    const page = source.getPage(data.slugs, locale);
    if (!page) throw notFound();

    return {
      locale,
      path: toClientContentPath(page.path),
      pageTree: await source.serializePageTree(source.getPageTree(locale)),
    };
  });

const clientLoader = browserCollections.docs.createClientLoader({
  component(
    { toc, frontmatter, default: MDX },
    props: {
      className?: string;
      locale?: Locale;
    },
  ) {
    const { locale, ...pageProps } = props;
    const isTranslation = locale === "zh";

    return (
      <DocsPage toc={toc} {...pageProps}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        {isTranslation ? (
          <div className="rounded-lg border border-fd-border bg-fd-muted/50 px-4 py-3 text-sm text-fd-muted-foreground">
            此页面为社区翻译版本。如与英文文档存在差异，请以英文文档为准。
          </div>
        ) : null}
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              Tab,
              Tabs,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});

export function DocsRoutePage({ data }: { data: DocsRouteData }) {
  const loaded = useFumadocsLoader(data);

  return (
    <DocsLayout
      {...baseOptions(loaded.locale, { i18n: true })}
      tree={loaded.pageTree}
    >
      <Suspense>
        {clientLoader.useContent(loaded.path, {
          className: "",
          locale: loaded.locale,
        })}
      </Suspense>
    </DocsLayout>
  );
}
