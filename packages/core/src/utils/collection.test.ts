import { describe, expect, it } from 'vite-plus/test';

import {
  getAtPath,
  groupBy,
  omitBy,
  pick,
  unique,
  uniqueBy,
  uniqueWith,
} from './collection';

describe('collection helpers', () => {
  it('unique keeps the first occurrence in order', () => {
    expect(unique(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c']);
  });

  it('uniqueBy keeps the first item per key', () => {
    const items = [
      { id: 1, v: 'first' },
      { id: 2, v: 'other' },
      { id: 1, v: 'second' },
    ];
    expect(uniqueBy(items, (x) => x.id)).toEqual([items[0], items[1]]);
  });

  it('uniqueWith keeps the first of items the comparator equates', () => {
    const items = [{ n: 'a' }, { n: 'b' }, { n: 'a' }];
    expect(uniqueWith(items, (a, b) => a.n === b.n)).toEqual([
      items[0],
      items[1],
    ]);
  });

  it('groupBy buckets by the returned key', () => {
    expect(groupBy([1, 2, 3, 4], (n) => (n % 2 ? 'odd' : 'even'))).toEqual({
      odd: [1, 3],
      even: [2, 4],
    });
  });

  it('pick copies only the requested keys that exist', () => {
    const obj: Record<string, number> = { a: 1, b: 2 };
    expect(pick(obj, ['a', 'missing'])).toEqual({ a: 1 });
    expect(pick(obj, ['toString'])).toEqual({});
    expect(pick(obj, new Set(['b']))).toEqual({ b: 2 });
  });

  it('omitBy drops entries the predicate accepts', () => {
    expect(omitBy({ a: 1, b: 2, c: 3 }, (v, k) => v > 2 || k === 'a')).toEqual({
      b: 2,
    });
  });

  it('getAtPath walks the path and stops at a missing step', () => {
    const spec = { components: { schemas: { Pet: { type: 'object' } } } };
    expect(getAtPath(spec, ['components', 'schemas', 'Pet'])).toEqual({
      type: 'object',
    });
    expect(getAtPath(spec, ['components', 'nope', 'Pet'])).toBeUndefined();
    expect(getAtPath(undefined, ['a'])).toBeUndefined();
  });
});
