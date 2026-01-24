import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.LLMS_BASE_URL ?? 'https://orval.dev';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  DOCS_ROOT,
  'src',
  'manifests',
  'manifest.json',
);
const SITE_CONFIG_PATH = path.join(DOCS_ROOT, 'src', 'siteConfig.ts');
const OUTPUT_PATH = path.join(DOCS_ROOT, 'public', 'llms.txt');

const INTRO = [
  '# Orval',
  '',
  '> Orval generates type-safe TypeScript clients, types, and mocks from OpenAPI v3 or Swagger v2 specs.',
  '',
  'Orval provides a CLI and programmatic API to generate clients and schemas. It supports multiple HTTP clients and integrations (fetch, axios, React Query, SWR, MSW, Zod, and more). Use the docs below for usage, configuration, and integrations.',
  '',
].join('\n');

const extractSiteLinks = async () => {
  try {
    const content = await readFile(SITE_CONFIG_PATH, 'utf8');
    const repoMatch = content.match(/repoUrl:\s*'([^']+)'/);
    const discordMatch = content.match(/discordUrl:\s*'([^']+)'/);
    return {
      repoUrl: repoMatch?.[1],
      discordUrl: discordMatch?.[1],
    };
  } catch {
    return {};
  }
};

const collectRoutes = (routes, prefix = '') => {
  const items = [];

  for (const route of routes ?? []) {
    if (route?.routes?.length) {
      const nextPrefix = prefix ? `${prefix}: ${route.title}` : route.title;
      items.push(...collectRoutes(route.routes, nextPrefix));
      continue;
    }

    if (!route?.path) {
      continue;
    }

    const title = prefix ? `${prefix}: ${route.title}` : route.title;
    const url = new URL(route.path, BASE_URL).toString();
    items.push({ title, url });
  }

  return items;
};

const formatSection = (title, items) => {
  if (!items.length) {
    return '';
  }

  const lines = [`## ${title}`, ''];
  for (const item of items) {
    lines.push(`- [${item.title}](${item.url})`);
  }

  return `${lines.join('\n')}\n`;
};

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const sections = (manifest.routes ?? [])
  .map((group) => formatSection(group.title, collectRoutes(group.routes)))
  .filter(Boolean);

const { repoUrl, discordUrl } = await extractSiteLinks();
const optionalItems = [];

if (repoUrl) {
  optionalItems.push(`- [GitHub Repository](${repoUrl})`);
}

if (discordUrl) {
  optionalItems.push(`- [Discord](${discordUrl})`);
}

const optionalSection = optionalItems.length
  ? `## Optional\n\n${optionalItems.join('\n')}\n`
  : '';

const content = [INTRO, ...sections, optionalSection]
  .filter(Boolean)
  .join('\n')
  .trimEnd();

await writeFile(OUTPUT_PATH, `${content}\n`, 'utf8');

console.log(`Wrote ${OUTPUT_PATH}`);
