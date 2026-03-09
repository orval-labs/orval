import {
  existsSync,
  readdirSync,
  statSync,
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

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

  // MCP SDK's server.tool() triggers exponential type inference via
  // ShapeOutput<Args> -> SchemaOutput -> z3.infer<S> | z4.output<S> (zod-compat).
  // Handlers, schemas, and HTTP client are still fully type-checked.
  if (folder === 'mcp') {
    config.exclude = [`generated/mcp/**/server.ts`];
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
  } catch (e) {
    ok = false;
    hasFailure = true;
    error = e.stderr?.toString() || e.stdout?.toString() || e.message;
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
