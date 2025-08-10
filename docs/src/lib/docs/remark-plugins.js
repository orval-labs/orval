export default [
  import('remark-slug'),
  import('./remark-paragraph-alerts.js').default,
  [
    import('remark-autolink-headings'),
    {
      behavior: 'append',
      linkProperties: {
        class: ['anchor'],
        title: 'Direct link to heading',
      },
    },
  ],

  import('remark-emoji'),
  import('remark-footnotes'),
  import('remark-images'),
  import('remark-unwrap-images'),
  [
    import('remark-toc'),
    {
      skip: 'Reference',
      maxDepth: 6,
    },
  ],
];
