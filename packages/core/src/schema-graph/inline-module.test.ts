import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import { createImportCheck, withInlineImports } from './inline-module';

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
