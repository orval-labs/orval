import cx from 'classnames';
import * as React from 'react';
import styles from './Toc.module.css';
import { useTocHighlight } from './useTocHighlight';
const TOP_OFFSET = 100;

function getHeaderAnchors() {
  return [
    ...document.getElementsByTagName('H1'),
    ...[...document.getElementsByClassName('anchor')].filter(
      (el) =>
        el.parentNode.nodeName === 'H2' ||
        el.parentNode.nodeName === 'H3' ||
        el.parentNode.nodeName === 'H4' ||
        el.parentNode.nodeName === 'H5',
    ),
  ].filter(Boolean);
}

function getHeaderDataFromAnchors(el) {
  return {
    url: el.getAttribute('href'),
    text: el.parentElement?.innerText,
    depth: Number(el.parentElement?.nodeName.replace('H', '')),
  };
}

export const Toc = ({ title }) => {
  const { headings, active } = useTocHighlight(
    styles.contents__link,
    styles['contents__link--active'],
    TOP_OFFSET,
    getHeaderAnchors,
    getHeaderDataFromAnchors,
    (el) => el?.parentElement?.id,
  );

  return (
    <ul className={cx('space-y-3', styles.contents__list)}>
      <li className="text-sm">
        <a className={styles.contents__link} href="#_top">
          {title}
        </a>
      </li>
      {headings &&
        headings.length > 0 &&
        headings.map((h, i) =>
          h.url ? (
            <li
              key={`heading-${h.url}-${i}`}
              className={cx('text-sm ', {
                'pl-2': h?.depth === 3,
                'pl-4': h?.depth === 4,
                'pl-6': h?.depth === 5,
                hidden:
                  h.depth &&
                  h.depth > 3 &&
                  active?.parent?.url !== h.parent?.url &&
                  active?.url !== h.parent?.url,
              })}
            >
              <a className={styles.contents__link} href={h.url}>
                {h.text}
              </a>
            </li>
          ) : null,
        )}
    </ul>
  );
};
