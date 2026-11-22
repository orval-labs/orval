import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import {
  createImportCheck,
  getModuleIdentifiers,
  withInlineImports,
} from './inline-module';

describe('createImportCheck', () => {
  const isImported = createImportCheck(
    "import { Schema as S, type Effect } from 'effect';\nconst Date = 1;",
  );

  it('finds a name an import declaration binds', () => {
    expect(isImported('S')).toBe(true);
    expect(isImported('Effect')).toBe(true);
  });

  it('ignores a name outside the import, or only part of one', () => {
    expect(isImported('Date')).toBe(false);
    expect(isImported('Schema')).toBe(true);
    expect(isImported('Sche')).toBe(false);
  });
});

describe('withInlineImports', () => {
  const output = createTestContextSpec({
    output: {
      override: {
        formatType: {
          'date-time': {
            type: 'Dayjs',
            decodeImport: { name: 'decode', importPath: './codec' },
          },
        },
      },
    },
  }).output;
  const options = {
    components: 'export const A = decode(1);',
    output,
    pick: (config: {
      decodeImport?: { name: string; importPath?: string };
    }) => [config.decodeImport],
    libraryImport: () => "import * as v from 'valibot';",
  };

  it('puts the library and format type imports above the components', () => {
    expect(withInlineImports({ ...options, precedingContent: '' })).toBe(
      "import * as v from 'valibot';\nimport { decode } from './codec';\n\nexport const A = decode(1);\n\n",
    );
  });

  it('skips what the preceding content imports', () => {
    expect(
      withInlineImports({
        ...options,
        precedingContent: "import { decode } from './codec';",
        libraryImport: () => '',
      }),
    ).toBe('export const A = decode(1);\n\n');
  });
});

describe('getModuleIdentifiers', () => {
  it('reads the names imports bind', () => {
    const names = getModuleIdentifiers(
      [
        "import Default from './a';",
        "import * as Models from './b';",
        "import type * as Typed from './b';",
        "import { one, two as three, type Four } from './c';",
        'import type {',
        '  Five,',
        "} from './d';",
        "import Mixed, { six } from './e';",
        "import './effect-only';",
      ].join('\n'),
    );
    expect([...names].toSorted()).toEqual([
      'Default',
      'Five',
      'Four',
      'Mixed',
      'Models',
      'Typed',
      'one',
      'six',
      'three',
    ]);
  });

  it('reads the names declarations at the start of a line bind', () => {
    const names = getModuleIdentifiers(
      [
        'export const getPet = () => 1;',
        'type Assert<T> = T;',
        'export interface Pet {}',
        'export async function load() {}',
        'export enum Kind { A }',
        'declare const ambient: number;',
        'class Holder {}',
        '  const indented = 1;',
        'const used = () => { return other; };',
      ].join('\n'),
    );
    expect([...names].toSorted()).toEqual([
      'Assert',
      'Holder',
      'Kind',
      'Pet',
      'ambient',
      'getPet',
      'load',
      'used',
    ]);
  });

  it('finds nothing in empty content', () => {
    expect(getModuleIdentifiers('').size).toBe(0);
  });
});
