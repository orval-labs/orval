import React from 'react';

/**
 * Sets up Table of Contents highlighting. It requires that
 */
export function useTocHighlight(
  linkClassName,
  linkActiveClassName,
  topOffset,
  getHeaderAnchors,
  getHeaderDataFromAnchor,
  getAnchorHeaderIdentifier,
) {
  const [lastActiveLink, setLastActiveLink] = React.useState(undefined);
  const [headings, setHeadings] = React.useState([]);

  React.useEffect(() => {
    const { anchors } = getHeaderAnchors().reduce(
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

  React.useEffect(() => {
    let headersAnchors = [];
    let links = [];

    function setActiveLink() {
      function getActiveHeaderAnchor() {
        let index = 0;
        let activeHeaderAnchor = null;
        headersAnchors = getHeaderAnchors();

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
        links = document.getElementsByClassName(linkClassName);

        while (index < links.length && !itemHighlighted) {
          const link = links[index];
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
