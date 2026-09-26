import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vite-plus/test';
import * as zod from 'zod';

import { Item } from './generated/fetch/zod-inline-array/model/item.zod';

/**
 * #4106: an inline `type: array` response resolves to the definition `Item[]`,
 * which never equals the import name `Item`, so the exact-name gate to Zod
 * runtime validation missed it. The array reached the caller as a compile-time
 * `Item[]` with nothing checked at runtime, while a `$ref` to a named array
 * component validated normally — which is what made the gap easy to miss.
 *
 * These assertions pair the emitted source with the behaviour of the expression
 * it emits: the generator must wire up `zod.array(Item).parse`, and that
 * expression must reject an element the schema does not allow.
 */
const readGenerated = (dir: string) =>
  readFileSync(
    path.join(import.meta.dirname, 'generated/fetch', dir, 'endpoints.ts'),
    'utf8',
  );

describe('fetch inline array responses are validated (#4106)', () => {
  const endpoints = readGenerated('zod-inline-array');
  const disabled = readGenerated('zod-inline-array-disabled');

  it('parses the response through the element schema', () => {
    expect(endpoints).toContain('zod.array(Item).parse(parsedBody)');
  });

  it('imports the zod binding and the element schema as a value', () => {
    expect(endpoints).toMatch(/import \{ z as zod \} from 'zod'/);
    expect(endpoints).toMatch(/import \{[^}]*\bItem\b[^}]*\} from '\.\/model'/);
  });

  it('declares the element output type for the parsed data', () => {
    expect(endpoints).toContain('data: ItemOutput[];');
  });

  it('leaves the named-array and primitive-array controls alone', () => {
    // A $ref to a named array component still parses through its own schema.
    expect(endpoints).toContain('Items.parse(parsedBody)');
    expect(endpoints).toContain('data: ItemsOutput;');
    // A primitive element has no schema to compose from.
    expect(endpoints).toContain('data: string[];');
  });

  it('emits no validation at all when runtimeValidation is off', () => {
    expect(disabled).not.toContain('zod.array(');
    expect(disabled).not.toContain('Items.parse(');
    expect(disabled).toContain('data: Item[];');
  });

  // The point of the fix: the emitted expression actually rejects bad data.
  it('raises a ZodError for an invalid element instead of returning it', () => {
    const schema = zod.array(Item);

    expect(() => schema.parse([{ id: 'not-a-number' }])).toThrow(zod.ZodError);
    expect(schema.parse([{ id: 1, name: 'a' }])).toEqual([
      { id: 1, name: 'a' },
    ]);
  });
});
