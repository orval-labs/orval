import sitemap from 'nextjs-sitemap-generator';
import process from 'node:process';

sitemap({
  baseUrl: 'https://orval.dev',
  pagesDirectory: process.cwd() + '/src/pages',
  targetDirectory: 'public/',
  ignoredExtensions: ['js', 'map'],
  ignoredPaths: ['/404'],
});
