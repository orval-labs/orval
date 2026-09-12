import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vite-plus/test';
import * as zod from 'zod';

import { Item } from './generated/angular/zod-inline-array/model/item.zod';

/**
 * #3718: an inline `type: array` response resolves to the definition `Item[]`,
 * which never equals the import name `Item`, so every exact-name gate to Zod
 * runtime validation missed it. The array reached the caller as a compile-time
 * `Item[]` with nothing checked at runtime.
 *
 * These assertions pair the emitted source with the behaviour of the expression
 * it emits: the generator must wire up `zod.array(Item).parse`, and that
 * expression must reject an element the schema does not allow.
 */
const readGenerated = (file: string) =>
  readFileSync(
    path.join(import.meta.dirname, 'generated/angular/zod-inline-array', file),
    'utf8',
  );

describe('angular inline array responses are validated (#3718)', () => {
  const service = readGenerated('endpoints.ts');
  const resource = readGenerated('endpoints.resource.ts');

  it('parses every HttpClient observe branch through the element schema', () => {
    expect(service).toContain('.pipe(map((data) => zod.array(Item).parse(data)))');
    expect(service).toContain(
      'response.clone({ body: zod.array(Item).parse(response.body) })',
    );
    expect(service).toContain(
      'event.clone({ body: zod.array(Item).parse(event.body) })',
    );
  });

  it('passes the composed parser to httpResource', () => {
    expect(resource).toContain('parse: zod.array(Item).parse');
  });

  it('imports the zod namespace and the element schema as a value', () => {
    for (const source of [service, resource]) {
      expect(source).toMatch(/import \* as zod from 'zod'/);
      expect(source).toMatch(/import \{[^}]*\bItem\b[^}]*\} from/);
    }
  });

  it('declares the element output type instead of a TData generic', () => {
    expect(service).toContain('Observable<ItemOutput[]>');
    expect(service).not.toContain('listItems<TData');
    expect(resource).toContain('HttpResourceRef<ItemOutput[] | undefined>');
  });

  it('leaves the named-array and primitive-array controls alone', () => {
    // A $ref to a named array component still parses through its own schema.
    expect(service).toContain('Items.parse(data)');
    // A primitive element has no schema to compose from.
    expect(service).toContain('listStrings<TData = string[]>');
  });

  // The point of the fix: the emitted expression actually rejects bad data.
  it('raises a ZodError for an invalid element instead of returning it', () => {
    const parse = zod.array(Item).parse;

    expect(() => parse([{ id: 'not-a-number' }])).toThrow(zod.ZodError);
    expect(parse([{ id: 1, name: 'a' }])).toEqual([{ id: 1, name: 'a' }]);
  });
});
