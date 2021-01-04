const sitemap = require('nextjs-sitemap-generator');

sitemap({
  baseUrl: 'https://orval.dev',
  pagesDirectory: process.cwd() + '/src/pages',
  targetDirectory: 'public/',
  ignoredExtensions: ['js', 'map'],
  ignoredPaths: ['/404'],
});
