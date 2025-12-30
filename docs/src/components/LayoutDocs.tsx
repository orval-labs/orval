import { findRouteByPath } from '@/lib/docs/findRouteByPath';
import { removeFromLast } from '@/lib/docs/utils';
import { getRouteContext } from '@/lib/get-route-context';
import { getManifest } from '@/manifests/getManifest';
import { useRouter } from 'next/router';
import { type ComponentPropsWithoutRef } from 'react';
import { Sticky } from './Sticky';
import { Nav } from './Nav';
import { Footer } from './Footer';
import { Toc } from './Toc';
import { DocsPageFooter } from './DocsPageFooter';
import { Seo } from './Seo';
import { SidebarMobile } from './SidebarMobile';
import { useIsMobile } from './useIsMobile';
import { SidebarHeading } from './SidebarHeading';
import { SidebarCategory } from './SidebarCategory';
import { SidebarPost } from './SidebarPost';
import { Sidebar } from './Sidebar';
import s from './markdown.module.css';

function getSlugAndTag(path: string) {
  const parts = path.split('/');

  if (parts[2] === '1.5.8' || parts[2] === '2.1.4') {
    return {
      tag: parts[2],
      slug: `/docs/${parts.slice(2).join('/')}`,
    };
  }

  return {
    slug: path,
  };
}

const addTagToSlug = (slug, tag) => {
  return tag ? `/docs/${tag}/${slug.replace('/docs/', '')}` : slug;
};

interface Metadata {
  id: string;
  title: string;
  description?: string;
  toc?: boolean;
}

interface Props extends ComponentPropsWithoutRef<'div'> {
  meta: Metadata;
}

export default function LayoutDocs({ meta, children }: Props) {
  const router = useRouter();
  const { slug, tag } = getSlugAndTag(router.asPath);
  const { routes } = getManifest(tag);
  const _route = findRouteByPath(removeFromLast(slug, '#'), routes);
  const isMobile = useIsMobile();
  const { route, prevRoute, nextRoute } = getRouteContext(_route, routes);
  const title = route && `${route.title}`;

  return (
    <>
      <div>
        {isMobile ? (
          <>
            <Nav />
            <Sticky shadow>
              <SidebarMobile>
                <SidebarRoutes isMobile={true} routes={routes} />
              </SidebarMobile>
            </Sticky>
          </>
        ) : (
          <Sticky>
            <Nav />
          </Sticky>
        )}
        <Seo title={title || meta.title} description={meta.description} />
        <div className="block">
          <>
            <div className="container mx-auto pb-12 pt-6 content">
              <div className="flex relative">
                {!isMobile && (
                  <Sidebar fixed>
                    <SidebarRoutes routes={routes} />
                  </Sidebar>
                )}

                <main
                  id="main-landmark"
                  className={s['markdown'] + ' w-full docs scroll-mt-24'}
                >
                  <h1 id="_top">{meta.title}</h1>
                  {children}
                  <DocsPageFooter
                    href={route?.path || ''}
                    route={route}
                    prevRoute={prevRoute}
                    nextRoute={nextRoute}
                  />
                </main>
                {meta.toc === false ? null : (
                  <div
                    className="hidden xl:block ml-10 shrink-0"
                    style={{
                      width: 200,
                    }}
                  >
                    <div className="sticky top-24 overflow-y-auto">
                      <h4 className="font-semibold uppercase text-sm mb-2 mt-2 text-gray-500">
                        On this page
                      </h4>
                      <Toc title={meta.title} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        </div>
      </div>
      <Footer />
      <style jsx>{`
        .docs {
          min-width: calc(100% - 300px - 1rem - 200px);
        }
      `}</style>
    </>
  );
}

function getCategoryPath(routes) {
  const route = routes.find((r) => r.path);
  return route && removeFromLast(route.path, '/');
}

type SidebarRoutesProps = {
  isMobile?: boolean;
  routes: any[];
  level?: number;
};
function SidebarRoutes({
  isMobile,
  routes: currentRoutes,
  level = 1,
}: SidebarRoutesProps) {
  const { asPath } = useRouter();
  let { slug, tag } = getSlugAndTag(asPath);
  return currentRoutes.map(({ path, href, title, routes, heading, open }) => {
    if (routes) {
      const pathname = getCategoryPath(routes);
      const selected = slug.startsWith(pathname);
      const opened = selected || isMobile ? false : open;

      if (heading) {
        return (
          <SidebarHeading key={'parent' + pathname} title={title}>
            <SidebarRoutes
              isMobile={isMobile}
              routes={routes}
              level={level + 1}
            />
          </SidebarHeading>
        );
      }

      return (
        <SidebarCategory
          key={pathname}
          isMobile={isMobile}
          level={level}
          title={title}
          selected={selected}
          opened={opened}
        >
          <SidebarRoutes
            isMobile={isMobile}
            routes={routes}
            level={level + 1}
          />
        </SidebarCategory>
      );
    }

    const pagePath = path ? removeFromLast(path, '.') : href;
    const pathname = addTagToSlug(pagePath, tag);
    const selected = slug === pagePath;
    const route = {
      href: pagePath,
      path,
      title,
      pathname,
      selected,
    };
    return (
      <SidebarPost
        key={title}
        isMobile={isMobile}
        level={level}
        route={route}
      />
    );
  });
}
