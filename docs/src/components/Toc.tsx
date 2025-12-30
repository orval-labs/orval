import cx from 'classnames';
import styles from './Toc.module.css';
import { HeaderData, useTocHighlight } from './useTocHighlight';
import { ComponentPropsWithoutRef } from 'react';

const TOP_OFFSET = 100;

function getHeaderAnchors() {
  return [
    ...document.getElementsByTagName('h1'),
    ...[...document.getElementsByClassName('anchor')].filter(
      (el) =>
        el.parentNode?.nodeName === 'H2' ||
        el.parentNode?.nodeName === 'H3' ||
        el.parentNode?.nodeName === 'H4' ||
        el.parentNode?.nodeName === 'H5',
    ),
  ].filter(Boolean);
}

function getHeaderDataFromAnchors(el: Element): HeaderData {
  return {
    url: el.getAttribute('href'),
    text: el.parentElement?.innerText,
    depth: Number(el.parentElement?.nodeName.replace('H', '')),
  };
}

interface Props extends ComponentPropsWithoutRef<'ul'> {
  title: string;
}

export function Toc({ title }: Props) {
  const { headings, active } = useTocHighlight(
    styles.contents__link,
    styles['contents__link--active'],
    TOP_OFFSET,
    getHeaderAnchors,
    getHeaderDataFromAnchors,
    (el?: Element) => el?.parentElement?.id,
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
          h.url
            ? (console.log(h),
              (
                <li
                  key={`heading-${h.url}-${i}`}
                  className={cx('text-sm ', {
                    'pl-1': h?.depth === 2,
                    'pl-2': h?.depth === 3,
                    'pl-4': h?.depth === 4,
                    'pl-6': h?.depth === 5,
                    hidden:
                      h.depth &&
                      h.depth > 2 &&
                      active?.parent?.url !== h.parent?.url &&
                      active?.url !== h.parent?.url,
                  })}
                >
                  <a className={styles.contents__link} href={h.url}>
                    {h.text}
                  </a>
                </li>
              ))
            : null,
        )}
    </ul>
  );
}
