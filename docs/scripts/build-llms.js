import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import siteConfig from '../site.config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOCS_ROOT = path.resolve(__dirname, '..');
const CONTENT_ROOT = path.join(DOCS_ROOT, 'content', 'docs');
const OUTPUT_PATH = path.join(DOCS_ROOT, 'public', 'llms.txt');
const BASE_URL = 'https://orval.dev';

const DOC_EXTENSIONS = new Set(['.mdx', '.md']);
const FRONTMATTER_REGEX = /^---\n([\s\S]*?)\n---\n/;
const SEPARATOR_REGEX = /^---(?:\[[^\]]+])?(?<name>.+)---|^---$/;

const stripQuotes = (value) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

const parseFrontmatter = (content) => {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    return {};
  }

  const data = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    if (key !== 'title' && key !== 'description') {
      continue;
    }

    const value = line.slice(separatorIndex + 1).trim();
    data[key] = stripQuotes(value);
  }

  return data;
};

const getSeparatorTitle = (value) => {
  const match = SEPARATOR_REGEX.exec(value);
  if (!match) {
    return null;
  }

  const name = match.groups?.name?.trim();
  return name && name.length > 0 ? name : null;
};

const toPosixPath = (value) => value.split(path.sep).join('/');

const toDocId = (filePath) => {
  const relativePath = toPosixPath(path.relative(CONTENT_ROOT, filePath));
  return relativePath.replace(/\.(mdx|md)$/, '');
};

const toRoutePath = (docId) => {
  const normalized = docId.replace(/\/index$/, '');
  const trimmed = normalized === 'index' ? '' : normalized;
  const segments = trimmed.length > 0 ? trimmed.split('/').map(encodeURI) : [];
  return `/docs${segments.length ? `/${segments.join('/')}` : ''}`;
};

const toAbsoluteUrl = (value) => new URL(value, BASE_URL).toString();

const collectDocFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectDocFiles(entryPath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (DOC_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
};

const buildDocsIndex = async () => {
  const files = await collectDocFiles(CONTENT_ROOT);
  const docs = new Map();

  await Promise.all(
    files.map(async (filePath) => {
      const docId = toDocId(filePath);
      const content = await readFile(filePath, 'utf8');
      const { title, description } = parseFrontmatter(content);
      docs.set(docId, {
        title: title?.trim() || docId,
        description: description?.trim() || '',
        url: toAbsoluteUrl(toRoutePath(docId)),
      });
    }),
  );

  return docs;
};

const readMeta = async (dir) => {
  try {
    const metaPath = path.join(dir, 'meta.json');
    const content = await readFile(metaPath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
};

const resolveDocId = (dir, name) => {
  const relativeDir = toPosixPath(path.relative(CONTENT_ROOT, dir));
  const cleanName = name.replace(/\.(mdx|md)$/, '');
  return relativeDir ? `${relativeDir}/${cleanName}` : cleanName;
};

const buildLinkLine = (entry) =>
  `- [${entry.title}](${entry.url}): ${entry.description ?? ''}`;

const pushHeading = (lines, title) => {
  if (!title) {
    return;
  }

  if (lines.length > 0 && lines[lines.length - 1] !== '') {
    lines.push('');
  }

  lines.push(`## ${title}`, '');
};

const pushDocLine = (lines, entry) => {
  lines.push(buildLinkLine(entry));
};

const getRootDocIds = (docsIndex) =>
  Array.from(docsIndex.keys()).filter((docId) => !docId.includes('/'));

const getOrderedRootDocIds = (rootPages, docsIndex) => {
  const rootDocIds = getRootDocIds(docsIndex);
  const rootDocSet = new Set(rootDocIds);
  const ordered = [];
  const seen = new Set();

  if (Array.isArray(rootPages)) {
    for (const item of rootPages) {
      if (typeof item !== 'string') {
        continue;
      }

      if (item.startsWith('!') || item.startsWith('...')) {
        continue;
      }

      if (getSeparatorTitle(item)) {
        continue;
      }

      const docId = resolveDocId(CONTENT_ROOT, item);
      if (!rootDocSet.has(docId) || seen.has(docId) || !docsIndex.has(docId)) {
        continue;
      }

      ordered.push(docId);
      seen.add(docId);
    }
  }

  const remaining = rootDocIds
    .filter((docId) => !seen.has(docId))
    .sort((a, b) => a.localeCompare(b));

  ordered.push(...remaining);
  return ordered;
};

const collectMetaLines = async (dir, items, docsIndex, seenDocIds, lines) => {
  if (!Array.isArray(items)) {
    return;
  }

  for (const item of items) {
    if (typeof item !== 'string') {
      continue;
    }

    if (item.startsWith('!')) {
      continue;
    }

    const separatorTitle = getSeparatorTitle(item);
    if (separatorTitle) {
      pushHeading(lines, separatorTitle);
      continue;
    }

    if (item.startsWith('...') && item.length > 3) {
      const target = item.slice(3);
      const targetDir = path.join(dir, target);
      const meta = await readMeta(targetDir);
      await collectMetaLines(
        targetDir,
        meta?.pages,
        docsIndex,
        seenDocIds,
        lines,
      );
      continue;
    }

    const docId = resolveDocId(dir, item);
    if (seenDocIds.has(docId)) {
      continue;
    }

    const entry = docsIndex.get(docId);
    if (!entry) {
      continue;
    }

    pushDocLine(lines, entry);
    seenDocIds.add(docId);
  }
};

const docsIndex = await buildDocsIndex();
const rootMeta = await readMeta(CONTENT_ROOT);
const rootTitle = rootMeta?.title ?? 'Documentation';

const lines = [
  `# ${rootTitle}`,
  '',
  `# Orval Documentation`,
  '',
  `[Orval Website](${BASE_URL})`,
  '',
];

const rootDocIds = getOrderedRootDocIds(rootMeta?.pages, docsIndex);
if (rootDocIds.length > 0) {
  pushHeading(lines, 'Overview');
  for (const docId of rootDocIds) {
    const entry = docsIndex.get(docId);
    if (!entry) {
      continue;
    }
    pushDocLine(lines, entry);
  }
}

const seenDocIds = new Set(rootDocIds);
await collectMetaLines(
  CONTENT_ROOT,
  rootMeta?.pages,
  docsIndex,
  seenDocIds,
  lines,
);

pushHeading(lines, 'Playground');
pushDocLine(lines, {
  title: siteConfig.playground.title,
  url: toAbsoluteUrl('/playground'),
  description: siteConfig.playground.description,
});

const repoUrl = siteConfig.repoUrl;
const discordUrl = siteConfig.discordUrl;
const sponsorUrl = siteConfig.openCollectiveUrl;

if (repoUrl || discordUrl || sponsorUrl) {
  pushHeading(lines, 'Optional');
  if (repoUrl) {
    lines.push(`- [GitHub Repository](${repoUrl})`);
  }
  if (discordUrl) {
    lines.push(`- [Discord](${discordUrl})`);
  }
  if (sponsorUrl) {
    lines.push(`- [Sponsor](${sponsorUrl})`);
  }
}

const content = lines.join('\n').trimEnd();
await writeFile(OUTPUT_PATH, `${content}\n`, 'utf8');
