import { execFileSync } from 'node:child_process';
import {
  existsSync,
  readFileSync,
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
const excludedByFolder = new Map([
  // Bun's flat node_modules makes the MCP SDK resolve `zod` to the project's v3.25
  // which ships both v3 and v4 compat types. The SDK's zod-compat.d.ts loads both
  // type systems, causing exponential type inference in server.registerTool() calls.
  // Yarn avoided this by nesting a separate zod@4.x for the SDK.
  // server.ts is pure glue — handlers, schemas and HTTP client are still fully checked.
  [
    'mcp',
    [
      'generated/mcp/**/server.ts',
      'generated/mcp/**/server.*.ts',
    ],
  ],
]);

const results = [];
let hasFailure = false;

/**
 * Typecheck one generated corpus. `slug` names the throwaway tsconfig; `label`
 * is what the console and the summary show.
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
  } catch (error_) {
    ok = false;
    hasFailure = true;
    error =
      error_.stderr?.toString() || error_.stdout?.toString() || error_.message;
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
}

console.log(`\nTypechecking ${folders.length} generated clients...\n`);

for (const folder of folders) {
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

  typecheck(folder, config);
}

// ─── exactOptionalPropertyTypes gate (#3909) ─────────────────────────────
// Under this flag an optional property may be *absent* but never *present and
// `undefined`, so it catches generated code that types an optional request
// field as `T | undefined` and then always writes the key — which is how every
// Angular `httpResource` client stopped compiling in #3909. The rest of the
// generated corpus does not pass under the flag yet, so the gate covers the
// fixtures that emit the request-extension helpers.
const angularRoot = join(generatedDir, 'angular');

const emitsRequestExtension = (dir) =>
  readdirSync(dir, { recursive: true })
    .filter((file) => typeof file === 'string' && file.endsWith('.ts'))
    .some((file) =>
      readFileSync(join(dir, file), 'utf8').includes(
        'applyOrvalRequestExtension',
      ),
    );

const exactOptionalFolders = !existsSync(angularRoot)
  ? []
  : readdirSync(angularRoot)
      .filter((f) => statSync(join(angularRoot, f)).isDirectory())
      .filter((f) => emitsRequestExtension(join(angularRoot, f)))
      .sort();

// The folders are detected by content, so renaming the emitted helper would
// otherwise empty the list and retire the gate on a green run. Fail instead.
if (exactOptionalFolders.length === 0) {
  console.error(
    '\nError: no Angular fixture emits `applyOrvalRequestExtension`.\n' +
      'The #3909 gate has nothing to check — was the helper renamed, or the\n' +
      'httpResource fixtures removed? Update this detection rather than dropping it.',
  );
  process.exit(1);
}

console.log(
  `\nTypechecking ${exactOptionalFolders.length} httpResource clients with exactOptionalPropertyTypes...\n`,
);

typecheck('exact-optional', {
  extends: './tsconfig.json',
  compilerOptions: { exactOptionalPropertyTypes: true },
  include: exactOptionalFolders.map((f) => `generated/angular/${f}`),
}, 'angular (exactOptionalPropertyTypes)');

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
