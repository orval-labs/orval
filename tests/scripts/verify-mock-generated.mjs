import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testsRoot = path.resolve(__dirname, '..');

const fixturePaths = [
  'generated/mock/msw-mixed-content-union/endpoints.ts',
  'generated/mock/msw-mixed-content-union-preferred-json/endpoints.ts',
  'generated/mock/msw-mixed-content-union-vendor/endpoints.ts',
  'generated/mock/msw-mixed-content-union-each-status/endpoints.ts',
];

const expectedSignature =
  'overrideResponse: Partial<Extract<string | Pet, object>> = {}';
const legacySignature = 'overrideResponse: Partial< string | Pet > = {}';

const failures = [];

for (const relativePath of fixturePaths) {
  const absolutePath = path.resolve(testsRoot, relativePath);

  let content;
  try {
    content = await readFile(absolutePath, 'utf8');
  } catch (error) {
    failures.push(
      `${relativePath}: unable to read generated fixture (${error.message})`,
    );
    continue;
  }

  if (!content.includes(expectedSignature)) {
    failures.push(
      `${relativePath}: missing expected signature "${expectedSignature}"`,
    );
  }

  if (content.includes(legacySignature)) {
    failures.push(
      `${relativePath}: found legacy signature "${legacySignature}"`,
    );
  }
}

if (failures.length > 0) {
  console.error('Generated mock verification failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Generated mock verification passed.');
