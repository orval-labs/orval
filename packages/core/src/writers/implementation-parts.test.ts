import { describe, expect, it, vi } from 'vite-plus/test';

import type { GeneratorImport, GeneratorMutator } from '../types';
import { escapeRegExp } from '../utils/string';
import type { TargetMutators } from './implementation-parts';
import {
  filterImportsUsedInImplementation,
  generateTargetMutatorImports,
} from './implementation-parts';

describe('filterImportsUsedInImplementation', () => {
  it('preserves the original word-boundary predicate for names and aliases', () => {
    const imports: GeneratorImport[] = [
      { name: 'Pet' },
      { name: 'Pets' },
      { name: 'missing', alias: 'Alias' },
      { name: 'Name', alias: 'absent' },
      { name: 'member' },
      { name: 'comment' },
      { name: 'string' },
      { name: 'foo$bar' },
      { name: '$start' },
      { name: 'éclair' },
      { name: 'a.b' },
      { name: 'a+b' },
      { name: 'line\n' },
      { name: '' },
    ];
    const implementations = [
      'Pets Alias Name obj.member // comment\n"string" foo$bar x$start éclair a.b a+b line\nx',
      'PetSuffix _Pet Pet_ Pet2 2Pet $Pet éPet Peté',
      '$start éclair .a.b. aab aaab',
      '',
    ];

    for (const implementation of implementations) {
      const expected = imports.filter((imp) => {
        const searchWords = [imp.alias, imp.name]
          .filter((part): part is string => Boolean(part?.length))
          .map(escapeRegExp)
          .join('|');
        return (
          Boolean(searchWords) &&
          new RegExp(String.raw`\b(${searchWords})\b`, 'g').test(implementation)
        );
      });
      expect(
        filterImportsUsedInImplementation(imports, implementation),
      ).toEqual(expected);
    }
  });

  it('retains input order, duplicates and object references', () => {
    const first = { name: 'First' };
    const second = { name: 'Second', alias: 'Other' };
    const result = filterImportsUsedInImplementation(
      [second, { name: 'Unused' }, first, second],
      'First Other',
    );
    expect(result).toEqual([second, first, second]);
    expect(result[0]).toBe(second);
    expect(result[1]).toBe(first);
    expect(result[2]).toBe(second);
  });

  it('indexes the implementation once for many ASCII candidates and skips empty candidates', () => {
    const match = vi.spyOn(String.prototype, 'match');
    const test = vi.spyOn(RegExp.prototype, 'test');
    try {
      const imports = Array.from({ length: 1000 }, (_, i) => ({
        name: `Candidate${i}`,
      }));
      expect(
        filterImportsUsedInImplementation(imports, 'Candidate999;'),
      ).toEqual([imports[999]]);
      expect(match).toHaveBeenCalledTimes(1);
      expect(
        test.mock.calls.filter(([value]) => value === 'Candidate999;'),
      ).toHaveLength(0);
      filterImportsUsedInImplementation([], 'anything');
      filterImportsUsedInImplementation([{ name: '', alias: '' }], 'anything');
      expect(match).toHaveBeenCalledTimes(1);
    } finally {
      match.mockRestore();
      test.mockRestore();
    }
  });
});

const makeMutator = (name: string): GeneratorMutator => ({
  name,
  path: `../mutators/${name}`,
  default: false,
  hasErrorType: false,
  errorTypeName: 'ErrorType',
  hasSecondArg: false,
  hasThirdArg: false,
  isHook: false,
});

describe('generateTargetMutatorImports', () => {
  // A configured mutator of any kind is attached to every operation whether
  // or not the operation's code calls it, so each kind must follow usage.
  const kinds: (keyof TargetMutators)[] = [
    'mutators',
    'formData',
    'formUrlEncoded',
    'paramsSerializer',
    'paramsFilter',
    'fetchReviver',
  ];

  it.each(kinds)(
    'imports a %s mutator only when the implementation references it',
    (kind) => {
      const target: TargetMutators = { [kind]: [makeMutator('customFn')] };

      expect(
        generateTargetMutatorImports(
          target,
          'export const listPets = () => customFn(url);',
        ),
      ).toBe("import { customFn } from '../mutators/customFn';\n");
      expect(
        generateTargetMutatorImports(
          target,
          'export const listPets = () => fetch(url);',
        ),
      ).toBe('');
    },
  );

  it('keeps the used kinds in declaration order and drops the rest', () => {
    const target: TargetMutators = {
      mutators: [makeMutator('customInstance')],
      formData: [makeMutator('customFormData')],
      paramsSerializer: [makeMutator('customSerializer')],
      fetchReviver: [makeMutator('customReviver')],
    };
    const implementation = `
      export const createPet = (body) =>
        customInstance({ data: customFormData(body) });
      export const getPet = (text) => JSON.parse(text, customReviver);
    `;

    expect(generateTargetMutatorImports(target, implementation)).toBe(
      "import { customInstance } from '../mutators/customInstance';\n" +
        "import { customFormData } from '../mutators/customFormData';\n" +
        "import { customReviver } from '../mutators/customReviver';\n",
    );
  });

  it('imports a function configured for two kinds once', () => {
    const serialize = makeMutator('serialize');
    const target: TargetMutators = {
      paramsSerializer: [serialize],
      paramsFilter: [serialize],
    };

    expect(generateTargetMutatorImports(target, 'serialize(params);')).toBe(
      "import { serialize } from '../mutators/serialize';\n",
    );
  });

  it('prepends ../ to a relative path when oneMore is set', () => {
    expect(
      generateTargetMutatorImports(
        { paramsSerializer: [makeMutator('serialize')] },
        'serialize(params);',
        true,
      ),
    ).toBe("import { serialize } from '../../mutators/serialize';\n");
  });

  it('always imports client mutators', () => {
    // A client may call them from code outside `implementation`: the zod
    // client's params mutator is called from inline component schemas.
    expect(
      generateTargetMutatorImports(
        { clientMutators: [makeMutator('zodParams')] },
        'export const listPets = () => fetch(url);',
      ),
    ).toBe("import { zodParams } from '../mutators/zodParams';\n");
  });
});
