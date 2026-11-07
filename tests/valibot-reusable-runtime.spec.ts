import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

import * as tagsSplitSchemas from './generated/valibot/reusable-schemas-tags-split/reusable-schemas-tags-split.schemas';
import * as trees from './generated/valibot/reusable-schemas-tags-split/trees/trees';
import * as single from './generated/valibot/reusable-schemas/reusable-schemas';

const accepts = (schema: v.GenericSchema, input: unknown) =>
  v.safeParse(schema, input).success;

// Loading each module proves no constant reads another before it is declared.
describe.each([
  ['single', single],
  ['tags-split schemas', tagsSplitSchemas],
])('reusable valibot schemas (%s)', (_mode, schemas) => {
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
});

describe('operation schemas', () => {
  it('keeps readOnly properties out of the request body', () => {
    expect(accepts(single.CreateAccountBody, { name: 'n' })).toBe(true);
    expect(accepts(single.CreateAccountResponse, { name: 'n' })).toBe(false);
  });

  it('keeps writeOnly properties out of the response', () => {
    expect(
      accepts(single.CreateSecretBody, { label: 'l', password: 'p' }),
    ).toBe(true);
    expect(accepts(single.CreateSecretResponse, { label: 'l' })).toBe(true);
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
});
