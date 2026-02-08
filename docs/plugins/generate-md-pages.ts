import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, dirname, basename } from 'node:path';
import type { Plugin } from 'vite';

const BASE_URL = 'https://orval.dev';

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
    // Track code block boundaries
    if (line.trimStart().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        // Strip title attribute from code fences: ```ts title="file.ts" → ```ts
        const cleaned = line.replace(
          /^(\s*```\w*)\s+title="[^"]*"\s*$/,
          '$1',
        );
        out.push(cleaned);
        continue;
      } else {
        inCodeBlock = false;
        out.push(line);
        continue;
      }
    }

    // Inside code blocks: output verbatim
    if (inCodeBlock) {
      out.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Remove <Cards> / </Cards>
    if (trimmed === '<Cards>' || trimmed === '</Cards>') continue;

    // Remove <Tabs ...> / </Tabs>
    if (trimmed.startsWith('<Tabs ') || trimmed === '</Tabs>') continue;

    // Remove <Tab ...> / </Tab>
    if (trimmed.startsWith('<Tab ') || trimmed === '</Tab>') continue;

    // <Card> components → markdown links
    const cardMatch = trimmed.match(
      /^<Card\s+title="([^"]+)"\s+href="([^"]+)"(?:\s+description="([^"]+)")?\s*\/>$/,
    );
    if (cardMatch) {
      const [, title, href, desc] = cardMatch;
      const url = href.startsWith('/') ? `${BASE_URL}${href}` : href;
      out.push(
        desc ? `- [${title}](${url}): ${desc}` : `- [${title}](${url})`,
      );
      continue;
    }

    // <Callout type="...">
    const calloutMatch = trimmed.match(/^<Callout\s+type="(\w+)">$/);
    if (calloutMatch) {
      inCallout = true;
      calloutType = calloutMatch[1];
      const label = calloutType === 'warn' ? 'Warning' : 'Note';
      out.push(`> **${label}:**`);
      continue;
    }

    // </Callout>
    if (trimmed === '</Callout>') {
      inCallout = false;
      calloutType = '';
      continue;
    }

    // Lines inside a callout get blockquoted
    if (inCallout) {
      out.push(line ? `> ${line.trim()}` : '>');
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

type LlmsEntry =
  | { section: string }
  | { page: string; label?: string };

// Single source of truth for llms.txt structure, section groupings, and page order.
// To add a new page: add a { page } entry under the right section.
const LLMS_STRUCTURE: LlmsEntry[] = [
  { section: 'Getting Started' },
  { page: 'index.mdx', label: 'Overview' },
  { page: 'installation.mdx' },
  { page: 'quick-start.mdx' },
  { page: 'guides/basics.mdx' },

  { section: 'Guides — HTTP Clients' },
  { page: 'guides/fetch.mdx' },
  { page: 'guides/fetch-client.mdx' },
  { page: 'guides/custom-client.mdx' },
  { page: 'guides/custom-axios.mdx' },
  { page: 'guides/set-base-url.mdx' },

  { section: 'Guides — Data Fetching' },
  { page: 'guides/react-query.mdx' },
  { page: 'guides/vue-query.mdx' },
  { page: 'guides/svelte-query.mdx' },
  { page: 'guides/solid-query.mdx' },
  { page: 'guides/angular-query.mdx' },
  { page: 'guides/swr.mdx' },

  { section: 'Guides — Frameworks' },
  { page: 'guides/angular.mdx' },
  { page: 'guides/solid-start.mdx' },
  { page: 'guides/hono.mdx' },

  { section: 'Guides — Validation & Mocking' },
  { page: 'guides/zod.mdx' },
  { page: 'guides/client-with-zod.mdx' },
  { page: 'guides/msw.mdx' },

  { section: 'Guides — Advanced' },
  { page: 'guides/enums.mdx' },
  { page: 'guides/stream-ndjson.mdx' },
  { page: 'guides/mcp.mdx' },

  { section: 'Reference' },
  { page: 'reference/cli.mdx' },
  { page: 'reference/integration.mdx' },
  { page: 'reference/configuration/index.mdx' },
  { page: 'reference/configuration/input.mdx' },
  { page: 'reference/configuration/output.mdx' },
  { page: 'reference/configuration/hooks.mdx' },
  { page: 'reference/configuration/full-example.mdx' },

  { section: 'Versions' },
  { page: 'versions/v8.mdx' },
];

const LLMS_HEADER = `# Orval

> Orval generates type-safe TypeScript clients from OpenAPI v3 and Swagger v2 specifications. It produces HTTP request functions, React Query/Vue Query/SWR hooks, Angular services, Zod schemas, and MSW mock handlers — all fully typed.

Orval takes any valid OpenAPI/Swagger specification (YAML or JSON) and generates production-ready code for your frontend. The default HTTP client uses the Fetch API, but you can configure any client including Axios. Orval supports multiple data-fetching libraries (React Query, Vue Query, Svelte Query, Solid Query, Angular Query, SWR) and frameworks (Angular, SolidStart, Hono).`;

const LLMS_FOOTER = `## Optional

- [GitHub Repository](https://github.com/orval-labs/orval): Source code, issues, and contributions
- [Discord](https://discord.gg/6fC2sjDU7w): Community support and discussions
- [Playground](https://orval.dev/playground): Interactive playground to try Orval in the browser
- [OpenCollective](https://opencollective.com/orval): Sponsor the project`;

function mdUrl(rel: string): string {
  const name = basename(rel, '.mdx');
  const dir = dirname(rel);
  const outName = name === 'index' ? 'index.html.md' : `${name}.md`;
  const path = dir === '.' ? outName : `${dir}/${outName}`;
  return `${BASE_URL}/docs/${path}`;
}

async function generate(contentDir: string, outputDir: string) {
  const files = await getFiles(contentDir);
  const pagesByRel = new Map<
    string,
    { title: string; description: string; markdown: string }
  >();
  let count = 0;

  for (const file of files) {
    const rel = relative(contentDir, file);
    const content = await readFile(file, 'utf-8');
    const { title, description, body } = parseFrontmatter(content);
    const markdown = transformMdx(body);
    const output = `# ${title}\n${markdown}`;

    pagesByRel.set(rel, { title, description, markdown: output });

    // Write individual .md file
    const name = basename(rel, '.mdx');
    const dir = dirname(rel);
    const outName = name === 'index' ? 'index.html.md' : `${name}.md`;
    const outPath = join(outputDir, dir, outName);

    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, output, 'utf-8');
    count++;
  }

  // Generate llms.txt
  const llmsLines: string[] = [
    LLMS_HEADER,
    '',
    `For the full documentation in a single file, see [llms-full.txt](${BASE_URL}/llms-full.txt).`,
    '',
  ];

  const pageOrder: string[] = [];
  let isFirstSection = true;

  for (const entry of LLMS_STRUCTURE) {
    if ('section' in entry) {
      if (!isFirstSection) llmsLines.push('');
      isFirstSection = false;
      llmsLines.push(`## ${entry.section}`, '');
    } else {
      const meta = pagesByRel.get(entry.page);
      if (!meta) continue;
      pageOrder.push(entry.page);
      const label = entry.label ?? meta.title;
      const url = mdUrl(entry.page);
      const line = meta.description
        ? `- [${label}](${url}): ${meta.description}`
        : `- [${label}](${url})`;
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
  const sections = pageOrder
    .map((rel) => pagesByRel.get(rel)?.markdown)
    .filter(Boolean)
    .join('\n---\n\n');

  const llmsFull = `${LLMS_HEADER}\n\n---\n\n${sections}`;
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
