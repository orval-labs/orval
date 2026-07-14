import { describe, expect, it } from 'vitest';

import type { GeneratorMockOutputFull } from '../types';
import { OutputMockType } from '../types';
import {
  buildCrossFileFakerImports,
  buildFakerReexportStatement,
  collapseInlineMockOutputs,
  collapseMswFakerFullOutputs,
  extractResponseMockNames,
  flattenMockOutput,
} from './mock-outputs';

const mswFull = (
  overrides: Partial<GeneratorMockOutputFull> = {},
): GeneratorMockOutputFull => ({
  type: OutputMockType.MSW,
  implementation: {
    function: 'export const getPetResponseMock = () => ({})\n',
    handler:
      'export const getPetMockHandler = () => { return HttpResponse.json(overrideResponse ?? getPetResponseMock()) }\n',
    handlerName: 'getPetMockHandler',
  },
  imports: [{ name: 'HttpResponse' }],
  ...overrides,
});

const fakerFull = (
  overrides: Partial<GeneratorMockOutputFull> = {},
): GeneratorMockOutputFull => ({
  type: OutputMockType.FAKER,
  implementation: {
    function: 'export const getPetResponseMock = () => ({})\n',
    handler: '',
    handlerName: '',
  },
  imports: [{ name: 'faker' }],
  ...overrides,
});

describe('collapseInlineMockOutputs', () => {
  it('returns inputs unchanged when no MSW entry is present', () => {
    const outputs = [fakerFull()];
    expect(collapseInlineMockOutputs(outputs)).toBe(outputs);
  });

  it('drops Faker entries when MSW is also present', () => {
    const outputs = [mswFull(), fakerFull()];
    const result = collapseInlineMockOutputs(outputs);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(OutputMockType.MSW);
  });

  it('keeps MSW-only entries unchanged', () => {
    const outputs = [mswFull()];
    const result = collapseInlineMockOutputs(outputs);
    expect(result).toEqual(outputs);
  });

  it('keeps Faker-only entries unchanged', () => {
    const outputs = [fakerFull()];
    const result = collapseInlineMockOutputs(outputs);
    expect(result).toBe(outputs);
  });
});

describe('flattenMockOutput', () => {
  it('concatenates function and handler into a single implementation string', () => {
    const full = mswFull();
    const result = flattenMockOutput(full);
    expect(result.type).toBe(OutputMockType.MSW);
    expect(result.implementation).toBe(
      full.implementation.function + full.implementation.handler,
    );
    expect(result.imports).toBe(full.imports);
  });

  it('works with empty function portion', () => {
    const full = mswFull({
      implementation: {
        function: '',
        handler: 'handler only\n',
        handlerName: 'h',
      },
    });
    const result = flattenMockOutput(full);
    expect(result.implementation).toBe('handler only\n');
  });

  it('works with empty handler portion', () => {
    const full = fakerFull({
      implementation: {
        function: 'function only\n',
        handler: '',
        handlerName: '',
      },
    });
    const result = flattenMockOutput(full);
    expect(result.implementation).toBe('function only\n');
  });

  it('passes strictMockSchemaTypeNames through to the flattened output', () => {
    const full = mswFull({ strictMockSchemaTypeNames: ['Pet', 'Owner'] });
    const result = flattenMockOutput(full);
    expect(result.strictMockSchemaTypeNames).toEqual(['Pet', 'Owner']);
  });
});

describe('collapseMswFakerFullOutputs', () => {
  it('returns inputs unchanged when no MSW entry is present', () => {
    const outputs = [fakerFull()];
    expect(collapseMswFakerFullOutputs(outputs)).toBe(outputs);
  });

  it('returns inputs unchanged when MSW has no function data', () => {
    const outputs = [
      mswFull({
        implementation: {
          function: '',
          handler: 'handler code',
          handlerName: 'h',
        },
      }),
    ];
    expect(collapseMswFakerFullOutputs(outputs)).toBe(outputs);
  });

  describe('MSW-only (no Faker configured)', () => {
    it('keeps the factories inline by default (pre-split behavior)', () => {
      const outputs = [mswFull()];
      expect(collapseMswFakerFullOutputs(outputs)).toBe(outputs);
    });

    it('strips function portion when mswOperationResponses is false', () => {
      const outputs = [mswFull()];
      const result = collapseMswFakerFullOutputs(outputs, {
        mswOperationResponses: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0].implementation.function).toBe('');
    });

    it('replaces ResponseMock fallback calls with undefined in handler when mswOperationResponses is false', () => {
      const outputs = [
        mswFull({
          implementation: {
            function: 'export const getPetResponseMock = () => ({})\n',
            handler:
              '  overrideResponse !== undefined\n    ? overrideResponse\n    : getPetResponseMock(),\n',
            handlerName: 'getPetMockHandler',
          },
        }),
      ];
      const result = collapseMswFakerFullOutputs(outputs, {
        mswOperationResponses: false,
      });
      expect(result[0].implementation.handler).toContain(': undefined');
      expect(result[0].implementation.handler).not.toContain(
        'getPetResponseMock()',
      );
    });

    it('replaces ResponseMock fallback calls with status suffixes when mswOperationResponses is false', () => {
      const outputs = [
        mswFull({
          implementation: {
            function:
              'export const getPetResponseMock200 = () => ({})\nexport const getPetResponseMockDefault = () => ({})\n',
            handler:
              '  overrideResponse !== undefined\n    ? overrideResponse\n    : getPetResponseMock200(),\n  overrideResponse !== undefined\n    ? overrideResponse\n    : getPetResponseMockDefault(),\n',
            handlerName: 'getPetMockHandler',
          },
        }),
      ];
      const result = collapseMswFakerFullOutputs(outputs, {
        mswOperationResponses: false,
      });
      expect(result[0].implementation.handler).not.toContain(
        'getPetResponseMock200()',
      );
      expect(result[0].implementation.handler).not.toContain(
        'getPetResponseMockDefault()',
      );
      expect(result[0].implementation.handler).toContain(': undefined');
    });

    it('preserves non-faker imports when mswOperationResponses is false', () => {
      const outputs = [mswFull()];
      const result = collapseMswFakerFullOutputs(outputs, {
        mswOperationResponses: false,
      });
      expect(result[0].imports.some((imp) => imp.name === 'HttpResponse')).toBe(
        true,
      );
    });
  });

  describe('MSW + Faker both configured', () => {
    it('strips function portion from MSW output but keeps handler intact', () => {
      const outputs = [mswFull(), fakerFull()];
      const result = collapseMswFakerFullOutputs(outputs);
      const mswResult = result.filter((m) => m.type === OutputMockType.MSW);
      expect(mswResult).toHaveLength(1);
      expect(mswResult[0].implementation.function).toBe('');
      expect(mswResult[0].implementation.handler).toContain(
        'getPetResponseMock()',
      );
    });

    it('does not modify Faker output', () => {
      const outputs = [mswFull(), fakerFull()];
      const result = collapseMswFakerFullOutputs(outputs);
      const fakerResult = result.filter((m) => m.type === OutputMockType.FAKER);
      expect(fakerResult).toHaveLength(1);
      expect(fakerResult[0].implementation.function).toBeTruthy();
    });

    it('moves the factories even when mswOperationResponses is false', () => {
      const outputs = [mswFull(), fakerFull()];
      const result = collapseMswFakerFullOutputs(outputs, {
        mswOperationResponses: false,
      });
      const mswResult = result.find((m) => m.type === OutputMockType.MSW);
      expect(mswResult?.implementation.function).toBe('');
      expect(mswResult?.implementation.handler).toContain(
        'getPetResponseMock()',
      );
    });

    it('keeps the factories inline when the faker output does not declare every referenced factory', () => {
      // e.g. faker with operationResponses: false alongside msw. Moving the
      // factories would leave the handlers calling names that don't exist.
      const outputs = [
        mswFull(),
        fakerFull({
          implementation: {
            function: 'export const getOtherResponseMock = () => ({})\n',
            handler: '',
            handlerName: '',
          },
        }),
      ];
      expect(collapseMswFakerFullOutputs(outputs)).toBe(outputs);
    });
  });
});

describe('extractResponseMockNames', () => {
  it('extracts ResponseMock function names from implementation', () => {
    const impl =
      'export const getPetResponseMock = () => ({})\n: getPetResponseMock()';
    expect(extractResponseMockNames(impl)).toEqual(['getPetResponseMock']);
  });

  it('extracts multiple unique names', () => {
    const impl =
      'export const getPetResponseMock = () => ({})\nexport const getUserResponseMock = () => ({})\n: getPetResponseMock()\n: getUserResponseMock()';
    expect(extractResponseMockNames(impl)).toEqual([
      'getPetResponseMock',
      'getUserResponseMock',
    ]);
  });

  it('deduplicates names that appear multiple times', () => {
    const impl =
      'export const getPetResponseMock = () => ({})\n: getPetResponseMock()\n: getPetResponseMock()';
    expect(extractResponseMockNames(impl)).toEqual(['getPetResponseMock']);
  });

  it('extracts names with numeric status suffixes', () => {
    const impl =
      'export const getPetResponseMock200 = () => ({})\n: getPetResponseMock200()';
    expect(extractResponseMockNames(impl)).toEqual(['getPetResponseMock200']);
  });

  it('extracts names with Default status suffix', () => {
    const impl =
      'export const getPetResponseMockDefault = () => ({})\n: getPetResponseMockDefault()';
    expect(extractResponseMockNames(impl)).toEqual([
      'getPetResponseMockDefault',
    ]);
  });

  it('extracts mixed names with and without status suffixes', () => {
    const impl =
      'export const getPetResponseMock = () => ({})\nexport const getPetResponseMock200 = () => ({})\n: getPetResponseMock()\n: getPetResponseMock200()';
    expect(extractResponseMockNames(impl)).toEqual([
      'getPetResponseMock',
      'getPetResponseMock200',
    ]);
  });

  it('returns empty array for implementation with no ResponseMock names', () => {
    expect(extractResponseMockNames('const x = 1')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractResponseMockNames('')).toEqual([]);
  });
});

describe('buildCrossFileFakerImports', () => {
  it('returns empty array when the handler references no ResponseMock names', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/endpoints.msw.ts',
      '/src/api/endpoints.faker.ts',
      'const x = 1',
      'export const getPetResponseMock = () => ({})',
    );
    expect(result).toEqual([]);
  });

  it('builds value imports for each ResponseMock name the handler references', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/endpoints.msw.ts',
      '/src/api/endpoints.faker.ts',
      ': getPetResponseMock()',
      'export const getPetResponseMock = () => ({})',
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('getPetResponseMock');
    expect(result[0].values).toBe(true);
    expect(result[0].importPath).toBe('./endpoints.faker');
  });

  it('builds imports for names with status suffixes', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/endpoints.msw.ts',
      '/src/api/endpoints.faker.ts',
      ': getPetResponseMock200()',
      'export const getPetResponseMock200 = () => ({})',
    );
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('getPetResponseMock200');
  });

  it('imports only the names the handler references, not every faker export', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/endpoints.msw.ts',
      '/src/api/endpoints.faker.ts',
      ': getPetResponseMock()',
      'export const getPetResponseMock = () => ({})\nexport const getPetResponseMock200 = () => ({})',
    );
    expect(result.map((r) => r.name)).toEqual(['getPetResponseMock']);
  });

  it('skips names referenced by the handler but not declared by faker', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/endpoints.msw.ts',
      '/src/api/endpoints.faker.ts',
      ': getPetResponseMock()\n: getUserResponseMock()',
      'export const getPetResponseMock = () => ({})',
    );
    expect(result.map((r) => r.name)).toEqual(['getPetResponseMock']);
  });

  it('uses relative import path between msw and faker files', () => {
    const result = buildCrossFileFakerImports(
      '/src/api/pets/pets.msw.ts',
      '/src/api/pets/pets.faker.ts',
      ': getPetResponseMock()',
      'export const getPetResponseMock = () => ({})',
    );
    expect(result[0].importPath).toBe('./pets.faker');
  });
});

describe('buildFakerReexportStatement', () => {
  it('returns an empty string for no imports', () => {
    expect(buildFakerReexportStatement([])).toBe('');
  });

  it('re-exports every imported name from the faker file', () => {
    const statement = buildFakerReexportStatement([
      { name: 'getPetResponseMock', values: true, importPath: './pets.faker' },
      {
        name: 'getUserResponseMock',
        values: true,
        importPath: './pets.faker',
      },
    ]);
    expect(statement).toBe(
      "export { getPetResponseMock, getUserResponseMock } from './pets.faker';\n",
    );
  });
});
