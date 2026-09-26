import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

/**
 * #4136 / #4137: react-query (and every other non-Angular query framework) and
 * swr reuse the fetch request function verbatim but assemble their own import
 * list. That list was derived without asking the fetch generator what it had
 * emitted, so a validated response came out as `User.parse(parsedBody)` sitting
 * next to `import type { User }` — TS1361 — with the `UserOutput` alias naming
 * the declared response type never imported at all.
 *
 * `tests` typechecks everything under `generated/`, so the compile errors alone
 * would fail the build. These assertions pin the two halves of the emission
 * separately, so a regression names which one broke.
 */
const readGenerated = (dir: string) =>
  readFileSync(
    path.join(
      import.meta.dirname,
      'generated/runtime-validation',
      dir,
      'endpoints.ts',
    ),
    'utf8',
  );

describe.each([
  ['react-query', 'react-query-fetch'],
  ['swr', 'swr-fetch'],
])(
  '%s reuses the fetch response validation imports (#4136, #4137)',
  (_client, dir) => {
    const endpoints = readGenerated(dir);

    it('imports the schema as a value, not as a type', () => {
      expect(endpoints).toContain('Item.parse(parsedBody)');
      expect(endpoints).toMatch(/^import \{[^}]*\bItem\b/m);
      expect(endpoints).not.toMatch(/^import type \{[^}]*\bItem\b[^}]*\}/m);
    });

    it('imports the Output alias the declared response type references', () => {
      expect(endpoints).toContain('data: ItemOutput');
      expect(endpoints).toMatch(/^import type \{[^}]*\bItemOutput\b/m);
    });

    it('composes an inline array response through the element schema', () => {
      expect(endpoints).toContain('zod.array(Item).parse(parsedBody)');
      expect(endpoints).toContain('data: ItemOutput[]');
      expect(endpoints).toMatch(/import \* as zod from 'zod'/);
    });

    it('leaves the named-array and primitive-array controls alone', () => {
      // A $ref to a named array component parses through its own schema.
      expect(endpoints).toContain('Items.parse(parsedBody)');
      expect(endpoints).toContain('data: ItemsOutput');
      // A primitive element has no generated schema to compose from.
      expect(endpoints).toContain('data: string[]');
    });
  },
);
