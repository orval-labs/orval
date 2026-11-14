import { Schema as S } from 'effect';
import { describe, expect, it } from 'vite-plus/test';

import * as exactOptional from './generated/effect/reusable-schemas-exact-optional/reusable-schemas-exact-optional';
import * as tagsSplitSchemas from './generated/effect/reusable-schemas-tags-split/reusable-schemas-tags-split.schemas';
import * as trees from './generated/effect/reusable-schemas-tags-split/trees/trees';
import * as single from './generated/effect/reusable-schemas/reusable-schemas';

const accepts = (schema: S.Codec<unknown, unknown>, input: unknown) => {
  try {
    S.decodeUnknownSync(schema)(input);
    return true;
  } catch {
    return false;
  }
};

// Loading each module proves no constant reads another before it is declared.
describe.each([
  ['single', single],
  ['tags-split schemas', tagsSplitSchemas],
])('reusable effect schemas (%s)', (_mode, schemas) => {
  it('validates a self-referencing tree', () => {
    const tree = {
      name: 'root',
      children: [{ name: 'leaf', parent: { name: 'root' } }],
    };
    expect(accepts(schemas.Tree, tree)).toBe(true);
    expect(accepts(schemas.Tree, { name: 'root', children: [{}] })).toBe(false);
  });

  it('validates a two-node cycle', () => {
    const author = {
      name: 'a',
      books: [{ title: 't', author: { name: 'a' } }],
    };
    expect(accepts(schemas.Author, author)).toBe(true);
    expect(
      accepts(schemas.Author, { name: 'a', books: [{ title: 't' }] }),
    ).toBe(false);
  });

  it('validates a three-node cycle', () => {
    expect(accepts(schemas.RingA, { b: { c: { a: { b: { c: {} } } } } })).toBe(
      true,
    );
    expect(accepts(schemas.RingA, { b: { c: { a: { b: {} } } } })).toBe(false);
  });

  it('merges allOf members that are references', () => {
    expect(accepts(schemas.Extended, { id: '1', label: 'x' })).toBe(true);
    expect(accepts(schemas.Extended, { label: 'x' })).toBe(false);
  });

  it('requires a key the parent requires of an optional member', () => {
    expect(accepts(schemas.Requirements, { id: '1', left: 'x' })).toBe(true);
    expect(accepts(schemas.Requirements, { id: '1' })).toBe(false);
  });

  it('rejects excess keys through nested constants', () => {
    const decode = S.decodeUnknownSync(schemas.Tree);
    const options = { onExcessProperty: 'error' } as const;
    expect(() => decode({ name: 'a', extra: 1 }, options)).toThrow();
    expect(() =>
      decode({ name: 'a', children: [{ name: 'b', extra: 1 }] }, options),
    ).toThrow();
  });
});

describe('operation schemas', () => {
  it('keeps readOnly properties out of the request body', () => {
    expect(accepts(single.CreateAccountBody, { name: 'n' })).toBe(true);
    expect(() =>
      S.decodeUnknownSync(single.CreateAccountBody)(
        { name: 'n', id: 'x' },
        { onExcessProperty: 'error' },
      ),
    ).toThrow();
    expect(accepts(single.CreateAccountResponse, { name: 'n' })).toBe(false);
  });

  it('renames an operation constant that matches a component', () => {
    expect(accepts(single.ListPetsResponse, { status: 'sold' })).toBe(true);
    expect(accepts(single.ListPetsResponseSchema, { status: 'sold' })).toBe(
      true,
    );
  });

  it('resolves the same constants when the operations are split from the schemas', () => {
    expect(trees.GetTreeResponse).toBe(tagsSplitSchemas.Tree);
  });

  it('declares optional keys without undefined with exactOptional', () => {
    expect(accepts(exactOptional.Tree, { name: 'a' })).toBe(true);
    expect(accepts(exactOptional.Tree, { name: 'a', parent: undefined })).toBe(
      false,
    );
  });
});
