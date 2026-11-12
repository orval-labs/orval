import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import {
  allocateConstName,
  allocateDerivedNames,
  getComponentNames,
} from './component-names';

const contextOf = (keys: string[]) =>
  createTestContextSpec({
    spec: {
      components: {
        schemas: Object.fromEntries(keys.map((key) => [key, {}])),
      },
    },
  });

const options = { library: 'effect', reserved: new Set(['File']) };

describe('getComponentNames', () => {
  it('suffixes a reserved name', () => {
    const names = getComponentNames(contextOf(['Pet', 'File']), options);
    expect([...names]).toEqual([
      ['Pet', 'Pet'],
      ['File', 'FileSchema'],
    ]);
  });

  it('names the library when two components share a name', () => {
    expect(() =>
      getComponentNames(contextOf(['File', 'FileSchema']), options),
    ).toThrow('[orval/effect] generateReusableSchemas: refs');
  });

  it('keeps the names of each library apart', () => {
    const context = contextOf(['File']);
    expect(getComponentNames(context, options).get('File')).toBe('FileSchema');
    expect(
      getComponentNames(context, { library: 'other', reserved: new Set() }).get(
        'File',
      ),
    ).toBe('File');
  });
});

describe('allocateConstName', () => {
  it('numbers a name that is taken', () => {
    const taken = new Set(['Pet', 'PetSchema']);
    expect(allocateConstName('Pet', taken)).toBe('PetSchema1');
    expect(allocateConstName('Pet', taken)).toBe('PetSchema2');
    expect(taken.has('PetSchema2')).toBe(true);
  });
});

describe('allocateDerivedNames', () => {
  it('numbers a derived name that is taken or repeated', () => {
    const derived = allocateDerivedNames(
      ['A', 'B'],
      new Set(['A', 'B', 'AEncoded']),
      'Encoded',
    );
    expect([...derived]).toEqual([
      ['A', 'AEncoded2'],
      ['B', 'BEncoded'],
    ]);
  });
});
