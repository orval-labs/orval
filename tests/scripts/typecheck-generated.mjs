import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsRoot = resolve(__dirname, '..');
const generatedDir = join(testsRoot, 'generated');

if (!existsSync(generatedDir)) {
  console.error(
    'Error: generated/ directory not found. Run generate-api first.',
  );
  process.exit(1);
}

const folders = readdirSync(generatedDir)
  .filter((f) => statSync(join(generatedDir, f)).isDirectory())
  .sort();

// Files that are generated but do not compile yet. Every entry is a defect with
// its own fix; none of them may be widened to swallow a new failure.
/** @type {Map<string, string[]>} */
const excludedByFolder = new Map();

/**
 * @typedef {{ label: string, ok: boolean, elapsed: string, error: string }} TypecheckResult
 */

/** @type {TypecheckResult[]} */
const results = [];
let hasFailure = false;

/**
 * Typecheck one generated corpus. `slug` names the throwaway tsconfig; `label`
 * is what the console and the summary show.
 *
 * @param {string} slug
 * @param {Record<string, unknown>} config
 * @param {string} [label]
 */
function typecheck(slug, config, label = slug) {
  const tmpTsconfig = join(testsRoot, `tsconfig.${slug}.json`);

  writeFileSync(tmpTsconfig, JSON.stringify(config, null, 2));

  process.stdout.write(`⏳ ${label}...`);
  const start = performance.now();
  let ok = true;
  let error = '';

  try {
    execFileSync('bunx', ['tsc', '--noEmit', '--project', tmpTsconfig], {
      cwd: testsRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    });
  } catch (caught) {
    ok = false;
    error = readExecError(caught);
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(2);
  results.push({ label, ok, elapsed, error });

  if (ok) {
    console.log(` ✅ ${elapsed}s`);
  } else {
    console.log(` ❌ ${elapsed}s`);
    const lines = error.split('\n').slice(0, 20).join('\n');
    console.log(`   ${lines}\n`);
  }

  try {
    unlinkSync(tmpTsconfig);
  } catch {}

  return ok;
}

/** @param {unknown} caught */
function readExecError(caught) {
  if (!(caught instanceof Error)) return 'typecheck failed';
  const output =
    /** @type {Error & { stderr?: { toString(): string }, stdout?: { toString(): string } }} */ (
      caught
    );
  return (
    output.stderr?.toString() || output.stdout?.toString() || caught.message
  );
}

console.log(`\nTypechecking ${folders.length} generated clients...\n`);

for (const folder of folders) {
  /** @type {{ extends: string, include: string[], exclude?: string[] }} */
  const config = {
    extends: './tsconfig.json',
    // `regressions` holds hand-written compile-time tests that import generated
    // code and exercise its public types (e.g. the #1177 onMutate regression),
    // so a narrowed option type fails the typecheck.
    include: [`generated/${folder}`, 'mutators', 'regressions'],
  };

  const exclude = excludedByFolder.get(folder);

  if (exclude) {
    config.exclude = exclude;
  }

  if (!typecheck(folder, config)) hasFailure = true;
}

// ─── exactOptionalPropertyTypes gate (#3909) ─────────────────────────────
// Under this flag an optional property may be *absent* but never *present and
// `undefined`, which is how every Angular `httpResource` client stopped
// compiling in #3909. The gate lists the fixtures that emit the httpResource
// request-extension helper.
const exactOptionalFolders = [
  'base-url-token-both',
  'base-url-token-http-resource',
  'http-resource-both-tags-split',
  'http-resource-headers',
  'http-resource-multi-content',
  'http-resource-request-extension-multi-content',
  'http-resource-tags',
  'http-resource-zod',
  'http-resource-zod-disabled',
  'issue-3624',
  'issue-3705-http-resource',
  'issue-3712-http-resource',
  'url-encode-parameters-http-resource',
];

console.log(
  `\nTypechecking ${exactOptionalFolders.length} httpResource clients with exactOptionalPropertyTypes...\n`,
);

if (
  !typecheck(
    'exact-optional',
    {
      extends: './tsconfig.json',
      compilerOptions: { exactOptionalPropertyTypes: true },
      include: exactOptionalFolders.map((f) => `generated/angular/${f}`),
    },
    'angular (exactOptionalPropertyTypes)',
  )
) {
  hasFailure = true;
}

// The same gate for react-query, where `queryOptions()` type-checks the emitted
// literal instead of an `as` cast laundering it, so the caller-options spread
// must not widen `queryFn` to `… | undefined` (#4163), and the infinite-query
// page-param merge must not set an optional param to `undefined` (#4223). The
// axios-mutator fixtures have unrelated `exactOptionalPropertyTypes` failures
// of their own, so they are not listed.
const reactQueryExactOptionalFolders = [
  'issue-4223',
  'prefetch-serializable-headers',
];

console.log(
  `\nTypechecking ${reactQueryExactOptionalFolders.length} react-query client with exactOptionalPropertyTypes...\n`,
);

if (
  !typecheck(
    'exact-optional-react-query',
    {
      extends: './tsconfig.json',
      compilerOptions: { exactOptionalPropertyTypes: true },
      include: reactQueryExactOptionalFolders.map(
        (f) => `generated/react-query/${f}`,
      ),
    },
    'react-query (exactOptionalPropertyTypes)',
  )
) {
  hasFailure = true;
}

// vue-query builds the same page-param merge around `toValue(params)` (#4223).
const vueQueryExactOptionalFolders = ['issue-4223'];

console.log(
  `\nTypechecking ${vueQueryExactOptionalFolders.length} vue-query client with exactOptionalPropertyTypes...\n`,
);

if (
  !typecheck(
    'exact-optional-vue-query',
    {
      extends: './tsconfig.json',
      compilerOptions: { exactOptionalPropertyTypes: true },
      include: vueQueryExactOptionalFolders.map(
        (f) => `generated/vue-query/${f}`,
      ),
    },
    'vue-query (exactOptionalPropertyTypes)',
  )
) {
  hasFailure = true;
}

// Mocks only compile under the flag with `override.mock.exactOptional`, which
// leaves an optional key out instead of setting it to `undefined` (#3912).
const mockExactOptionalFolders = [
  'exact-optional-allof',
  'exact-optional-native-enum',
  'exact-optional-petstore',
];

console.log(
  `\nTypechecking ${mockExactOptionalFolders.length} mock clients with exactOptionalPropertyTypes...\n`,
);

if (
  !typecheck(
    'exact-optional-mock',
    {
      extends: './tsconfig.json',
      compilerOptions: { exactOptionalPropertyTypes: true },
      include: mockExactOptionalFolders.map((f) => `generated/mock/${f}`),
    },
    'mock (exactOptionalPropertyTypes)',
  )
) {
  hasFailure = true;
}

// ─── noUncheckedIndexedAccess gate (#4228) ───────────────────────────────
// Nuxt enables this flag by default. The date (de)serializers index arrays and
// maps inside bounded loops, so every such read must be asserted non-null.
const noUncheckedIndexedAccessFolders = [
  'dates-transform',
  'dates-transform-hook-mutator',
  'dates-transform-mutator',
  'dates-transform-no-http-response',
];

console.log(
  `\nTypechecking ${noUncheckedIndexedAccessFolders.length} fetch clients with noUncheckedIndexedAccess...\n`,
);

if (
  !typecheck(
    'no-unchecked-indexed-access',
    {
      extends: './tsconfig.json',
      compilerOptions: { noUncheckedIndexedAccess: true },
      include: noUncheckedIndexedAccessFolders.map(
        (f) => `generated/fetch/${f}`,
      ),
    },
    'fetch (noUncheckedIndexedAccess)',
  )
) {
  hasFailure = true;
}

console.log('\n--- Summary ---\n');
const labelWidth = Math.max(...results.map((r) => r.label.length));
for (const r of results) {
  const status = r.ok ? '✅' : '❌';
  console.log(`${status} ${r.label.padEnd(labelWidth)} ${r.elapsed}s`);
}

if (hasFailure) {
  const failed = results.filter((r) => !r.ok).map((r) => r.label);
  console.log(`\n❌ Failed: ${failed.join(', ')}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${results.length} typecheck runs passed`);
}
