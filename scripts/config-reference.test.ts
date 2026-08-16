// Self-check for the config-reference generator's type resolution.
// Run: bun run test:config-reference
// Verifies that approved OpenApi* callback params are expanded to their
// concrete fields + spec URL, and that internal types are NOT expanded.
import assert from 'node:assert/strict';
import { getEntry } from '../docs/src/generated/config-reference/index.ts';

const failures: string[] = [];
function check(name: string, cond: boolean): void {
  if (!cond) failures.push(name);
}

// 1. override.header → info resolves to the OpenAPI Info Object.
const header = getEntry('output.override.header');
check('header is a field', header?.kind === 'field');
const info = header?.callback?.params?.[0];
check('header has info param', info?.name === 'info');
check('info type is OpenApiInfoObject', info?.type === 'OpenApiInfoObject');
const infoFields = info?.resolved?.fields?.map((f) => f.name) ?? [];
check('info resolves title', infoFields.includes('title'));
check('info resolves version', infoFields.includes('version'));
check('info resolves license', infoFields.includes('license'));
check(
  'info spec link is the info-object anchor',
  info?.resolved?.specUrl?.endsWith('#info-object') === true,
);
check(
  'info sourced from @scalar',
  info?.resolved?.source === '@scalar/openapi-types',
);

// 2. override.operationName → operation resolves to the Operation Object.
const op = getEntry('output.override.operationName');
const operation = op?.callback?.params?.[0];
check('operationName has operation param', operation?.name === 'operation');
check(
  'operation resolves parameters field',
  (operation?.resolved?.fields?.map((f) => f.name) ?? []).includes(
    'parameters',
  ),
);
check(
  'operation spec link is the operation-object anchor',
  operation?.resolved?.specUrl?.endsWith('#operation-object') === true,
);
// route and verb are primitives/enums and must NOT be expanded.
check(
  'route (string) not expanded',
  op?.callback?.params?.[1]?.resolved === undefined,
);
check(
  'verb (Verbs enum) not expanded',
  op?.callback?.params?.[2]?.resolved === undefined,
);

// 3. override.transformer → GeneratorVerbOptions is an INTERNAL type and must
//    NOT be auto-expanded into the public reference.
const transformer = getEntry('output.override.transformer');
check(
  'transformer verb (internal type) not expanded',
  transformer?.callback?.params?.[0]?.resolved === undefined,
);

// 4. input.override.transformer → spec resolves to the OpenAPI Document.
const inputT = getEntry('input.override.transformer');
const spec = inputT?.callback?.params?.[0];
check(
  'input transformer spec resolves openapi field',
  (spec?.resolved?.fields?.map((f) => f.name) ?? []).includes('openapi'),
);

// 5. Section lookups work.
const section = getEntry('output.override');
check('section lookup returns section kind', section?.kind === 'section');
check('section has fields', (section?.fields?.length ?? 0) > 0);

if (failures.length) {
  console.error(`\n✗ ${failures.length} resolver check(s) failed:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(
  '✓ All resolver checks passed (header/operationName/transformer/section).',
);
