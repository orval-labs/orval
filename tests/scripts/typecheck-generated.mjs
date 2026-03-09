import { execSync } from 'node:child_process';
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

const results = [];
let hasFailure = false;

console.log(`\nTypechecking ${folders.length} generated clients...\n`);

for (const folder of folders) {
  const tmpTsconfig = join(testsRoot, `tsconfig.${folder}.json`);

  const config = {
    extends: './tsconfig.json',
    include: [`generated/${folder}`, 'mutators'],
  };

  // Bun's flat node_modules makes the MCP SDK resolve `zod` to the project's v3.25
  // which ships both v3 and v4 compat types. The SDK's zod-compat.d.ts loads both
  // type systems, causing exponential type inference in server.tool() calls.
  // Yarn avoided this by nesting a separate zod@4.x for the SDK.
  // server.ts is pure glue — handlers, schemas and HTTP client are still fully checked.
  if (folder === 'mcp') {
    config.exclude = ['generated/mcp/**/server.ts'];
  }

  writeFileSync(tmpTsconfig, JSON.stringify(config, null, 2));

  process.stdout.write(`⏳ ${folder}...`);
  const start = performance.now();
  let ok = true;
  let error = '';

  try {
    execSync(`bunx tsc --noEmit --project ${tmpTsconfig}`, {
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
  results.push({ folder, ok, elapsed, error });

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

console.log('\n--- Summary ---\n');
for (const r of results) {
  const status = r.ok ? '✅' : '❌';
  console.log(`${status} ${r.folder.padEnd(20)} ${r.elapsed}s`);
}

if (hasFailure) {
  const failed = results.filter((r) => !r.ok).map((r) => r.folder);
  console.log(`\n❌ Failed: ${failed.join(', ')}`);
  process.exit(1);
} else {
  console.log(`\n✅ All ${folders.length} clients passed`);
}
