import { useEffect, useState } from 'react';

export interface HeaderData {
  url: string | null;
  text: string | undefined;
  depth: number;
}

/**
 * Sets up Table of Contents highlighting. It requires that
 */
export function useTocHighlight(
  linkClassName: string,
  linkActiveClassName: string,
  topOffset: number,
  getHeaderAnchors: () => Element[],
  getHeaderDataFromAnchor: (el: Element) => HeaderData,
  getAnchorHeaderIdentifier: (el?: Element) => string | undefined,
) {
  const [lastActiveLink, setLastActiveLink] = useState<Element | undefined>(
    undefined,
  );
  const [headings, setHeadings] = useState<
    Array<HeaderData & { parent?: HeaderData | null }>
  >([]);

  useEffect(() => {
    const { anchors } = getHeaderAnchors().reduce<{
      lastParent: HeaderData | null;
      anchors: Array<HeaderData & { parent?: HeaderData | null }>;
    }>(
      (acc, el) => {
        const anchor = getHeaderDataFromAnchor(el);
        if (anchor.depth <= 2) {
          return {
            lastParent: anchor,
            anchors: [...acc.anchors, anchor],
          };
        }

        return {
          ...acc,
          anchors: [...acc.anchors, { ...anchor, parent: acc.lastParent }],
        };
      },
      { lastParent: null, anchors: [] },
    );
    setHeadings(anchors);
  }, [setHeadings]);

  useEffect(() => {
    function setActiveLink() {
      function getActiveHeaderAnchor() {
        let index = 0;
        let activeHeaderAnchor: Element | null = null;
        const headersAnchors = getHeaderAnchors();

        while (index < headersAnchors.length && !activeHeaderAnchor) {
          const headerAnchor = headersAnchors[index];
          const { top } = headerAnchor.getBoundingClientRect();

          if (top >= 0 && top <= topOffset) {
            activeHeaderAnchor = headerAnchor;
          }

          index += 1;
        }

        return activeHeaderAnchor;
      }

      const activeHeaderAnchor = getActiveHeaderAnchor();

      if (activeHeaderAnchor) {
        let index = 0;
        let itemHighlighted = false;
        const links = document.getElementsByClassName(linkClassName);

        while (index < links.length && !itemHighlighted) {
          const link = links[index];
          if (link instanceof HTMLAnchorElement) {
            const { href } = link;
            const anchorValue = decodeURIComponent(
              href.substring(href.indexOf('#') + 1),
            );

            if (getAnchorHeaderIdentifier(activeHeaderAnchor) === anchorValue) {
              if (lastActiveLink) {
                lastActiveLink.classList.remove(linkActiveClassName);
              }

              link.classList.add(linkActiveClassName);
              setLastActiveLink(link);
              itemHighlighted = true;
            }
          }

          index += 1;
        }
      }
    }

    document.addEventListener('scroll', setActiveLink);
    document.addEventListener('resize', setActiveLink);
    setActiveLink();

    return () => {
      document.removeEventListener('scroll', setActiveLink);
      document.removeEventListener('resize', setActiveLink);
    };
  });

  return {
    headings,
    active:
      lastActiveLink &&
      headings.find(
        (heading) =>
          heading.url === getHeaderDataFromAnchor(lastActiveLink).url,
      ),
  };
}
