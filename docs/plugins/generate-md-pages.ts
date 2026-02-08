import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, basename } from 'node:path';
import type { Plugin } from 'vite';

const BASE_URL = 'https://orval.dev';

const SEPARATOR_REGEX = /^---(?:\[[^\]]+])?(?<name>.+)---$/;

const LLMS_HEADER = `# Orval

> Orval generates type-safe TypeScript clients from OpenAPI v3 and Swagger v2 specifications. It produces HTTP request functions, React Query/Vue Query/SWR hooks, Angular services, Zod schemas, and MSW mock handlers — all fully typed.

Orval takes any valid OpenAPI/Swagger specification (YAML or JSON) and generates production-ready code for your frontend. The default HTTP client uses the Fetch API, but you can configure any client including Axios. Orval supports multiple data-fetching libraries (React Query, Vue Query, Svelte Query, Solid Query, Angular Query, SWR) and frameworks (Angular, SolidStart, Hono).`;

const LLMS_FOOTER = `## Optional

- [GitHub Repository](https://github.com/orval-labs/orval): Source code, issues, and contributions
- [Discord](https://discord.gg/6fC2sjDU7w): Community support and discussions
- [Playground](https://orval.dev/playground): Interactive playground to try Orval in the browser
- [OpenCollective](https://opencollective.com/orval): Sponsor the project`;

interface PageMeta {
  rel: string;
  title: string;
  description: string;
  markdown: string;
}

interface MetaJson {
  title?: string;
  pages?: string[];
}

async function getFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getFiles(full)));
    } else if (entry.name.endsWith('.mdx')) {
      files.push(full);
    }
  }
  return files;
}

function parseFrontmatter(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return { title: '', description: '', body: content };

  const yaml = match[1];
  const title = yaml.match(/^title:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const description = yaml.match(/^description:\s*(.+)$/m)?.[1]?.trim() ?? '';
  const body = content.slice(match[0].length);

  return { title, description, body };
}

function transformMdx(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let inCodeBlock = false;
  let inCallout = false;
  let calloutType = '';

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        const cleaned = line.replace(/^(\s*```\w*)\s+title="[^"]*"\s*$/, '$1');
        out.push(cleaned);
        continue;
      } else {
        inCodeBlock = false;
        out.push(line);
        continue;
      }
    }

    if (inCodeBlock) {
      out.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === '<Cards>' || trimmed === '</Cards>') continue;
    if (trimmed.startsWith('<Tabs ') || trimmed === '</Tabs>') continue;
    if (trimmed.startsWith('<Tab ') || trimmed === '</Tab>') continue;

    const cardMatch = trimmed.match(
      /^<Card\s+title="([^"]+)"\s+href="([^"]+)"(?:\s+description="([^"]+)")?\s*\/>$/,
    );
    if (cardMatch) {
      const [, title, href, desc] = cardMatch;
      const url = href.startsWith('/') ? `${BASE_URL}${href}` : href;
      out.push(desc ? `- [${title}](${url}): ${desc}` : `- [${title}](${url})`);
      continue;
    }

    const calloutMatch = trimmed.match(/^<Callout\s+type="(\w+)">$/);
    if (calloutMatch) {
      inCallout = true;
      calloutType = calloutMatch[1];
      const label = calloutType === 'warn' ? 'Warning' : 'Note';
      out.push(`> **${label}:**`);
      continue;
    }

    if (trimmed === '</Callout>') {
      inCallout = false;
      calloutType = '';
      continue;
    }

    if (inCallout) {
      out.push(line ? `> ${line.trim()}` : '>');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function mdUrl(rel: string): string {
  const name = basename(rel, '.mdx');
  const dir = dirname(rel);
  const outName = name === 'index' ? 'index.html.md' : `${name}.md`;
  const path = dir === '.' ? outName : `${dir}/${outName}`;
  return `${BASE_URL}/docs/${path}`;
}

async function readMeta(dir: string): Promise<MetaJson | null> {
  try {
    const content = await readFile(join(dir, 'meta.json'), 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Walk meta.json tree to produce ordered pages and section headers
interface LlmsEntry {
  type: 'section' | 'page';
  value: string; // section name or page rel path
}

async function walkMeta(
  contentDir: string,
  dir: string,
  isRoot = false,
): Promise<LlmsEntry[]> {
  const meta = await readMeta(dir);
  if (!meta?.pages) return [];

  const entries: LlmsEntry[] = [];
  const relDir = relative(contentDir, dir);

  // At root level, separators label the pages/spread *above* them (Fumadocs convention).
  // Buffer pages so we can emit the separator heading first.
  // In subdirectories, separators label what follows — emit them directly.
  let bufferedPages: LlmsEntry[] = [];

  for (let i = 0; i < meta.pages.length; i++) {
    const item = meta.pages[i];

    // Separator: ---Name---
    const sepMatch = SEPARATOR_REGEX.exec(item);
    if (sepMatch) {
      const name = sepMatch.groups?.name?.trim();

      if (isRoot) {
        // Root separators label pages above — skip if they follow a spread
        const prevItem = i > 0 ? meta.pages[i - 1] : null;
        if (prevItem?.startsWith('...')) continue;

        if (name) {
          entries.push({ type: 'section', value: name });
          entries.push(...bufferedPages);
          bufferedPages = [];
        }
      } else {
        // Sub-directory separators label pages below
        if (name) {
          entries.push({ type: 'section', value: name });
        }
      }
      continue;
    }

    // Spread: ...subdir
    if (item.startsWith('...')) {
      entries.push(...bufferedPages);
      bufferedPages = [];

      const subdir = item.slice(3);
      const subdirPath = join(dir, subdir);
      const subMeta = await readMeta(subdirPath);

      if (subMeta?.title) {
        entries.push({ type: 'section', value: subMeta.title });
      }

      const subEntries = await walkMeta(contentDir, subdirPath);
      entries.push(...subEntries);
      continue;
    }

    // Regular page
    const rel = relDir ? `${relDir}/${item}.mdx` : `${item}.mdx`;
    if (isRoot) {
      bufferedPages.push({ type: 'page', value: rel });
    } else {
      entries.push({ type: 'page', value: rel });
    }
  }

  entries.push(...bufferedPages);

  return entries;
}

async function generate(contentDir: string, outputDir: string) {
  const files = await getFiles(contentDir);
  const pagesByRel = new Map<string, PageMeta>();
  let count = 0;

  for (const file of files) {
    const rel = relative(contentDir, file);
    const content = await readFile(file, 'utf-8');
    const { title, description, body } = parseFrontmatter(content);
    const markdown = transformMdx(body);
    const output = `# ${title}\n${markdown}`;

    pagesByRel.set(rel, { rel, title, description, markdown: output });

    const name = basename(rel, '.mdx');
    const dir = dirname(rel);
    const outName = name === 'index' ? 'index.html.md' : `${name}.md`;
    const outPath = join(outputDir, dir, outName);

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, output, 'utf-8');
    count++;
  }

  // Walk meta.json to get ordered entries with sections
  const entries = await walkMeta(contentDir, contentDir, true);

  // Build llms.txt
  const llmsLines: string[] = [
    LLMS_HEADER,
    '',
    `For the full documentation in a single file, see [llms-full.txt](${BASE_URL}/llms-full.txt).`,
  ];

  const allOrdered: PageMeta[] = [];
  let needsBlankLine = true;

  for (const entry of entries) {
    if (entry.type === 'section') {
      llmsLines.push('', `## ${entry.value}`, '');
      needsBlankLine = false;
    } else {
      const page = pagesByRel.get(entry.value);
      if (!page) continue;

      if (needsBlankLine) {
        llmsLines.push('');
        needsBlankLine = false;
      }

      allOrdered.push(page);
      const url = mdUrl(page.rel);
      const line = page.description
        ? `- [${page.title}](${url}): ${page.description}`
        : `- [${page.title}](${url})`;
      llmsLines.push(line);
    }
  }

  llmsLines.push('', LLMS_FOOTER, '');

  await writeFile(
    join(outputDir, '..', 'llms.txt'),
    llmsLines.join('\n'),
    'utf-8',
  );

  // Generate llms-full.txt
  const fullSections = allOrdered.map((p) => p.markdown).join('\n---\n\n');
  const llmsFull = `${LLMS_HEADER}\n\n---\n\n${fullSections}`;
  await writeFile(join(outputDir, '..', 'llms-full.txt'), llmsFull, 'utf-8');

  return count;
}

export function generateMdPages(): Plugin {
  let contentDir: string;
  let outputDir: string;

  return {
    name: 'generate-md-pages',
    configResolved(config) {
      contentDir = join(config.root, 'content/docs');
      outputDir = join(config.root, 'public/docs');
    },
    async buildStart() {
      const count = await generate(contentDir, outputDir);
      console.log(`[generate-md-pages] Generated ${count} .md files`);
    },
  };
}
