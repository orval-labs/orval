import { describe, expect, it } from 'vite-plus/test';

import type { Tsconfig } from '../types';
import {
  getModelsImportPath,
  renderModelTypeChecks,
} from './model-type-checks';

const render = (taken: string[] = []) =>
  renderModelTypeChecks({
    checks: [
      { modelName: 'Pet', schemaName: 'Pet' },
      { modelName: 'File', schemaName: 'FileSchema' },
    ],
    modelsImportPath: '../model',
    inferOutput: (name) => `Infer<typeof ${name}>`,
    taken: new Set(taken),
  });

describe('renderModelTypeChecks', () => {
  it('asserts both directions for every check', () => {
    expect(render()).toEqual({
      importLine: "import type * as Models from '../model';",
      block: `type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type SchemaModelTypeChecks = {
  Pet: [
    Assert<Extends<Infer<typeof Pet>, Models.Pet>>,
    Assert<Extends<Models.Pet, Infer<typeof Pet>>>,
  ];
  File: [
    Assert<Extends<Infer<typeof FileSchema>, Models.File>>,
    Assert<Extends<Models.File, Infer<typeof FileSchema>>>,
  ];
};
declare const schemaModelTypeChecks: SchemaModelTypeChecks;`,
    });
  });

  it('escapes the import specifier of the models', () => {
    const { importLine } = renderModelTypeChecks({
      checks: [{ modelName: 'Pet', schemaName: 'Pet' }],
      modelsImportPath: String.raw`../O'Brien\model`,
      inferOutput: (name) => `Infer<typeof ${name}>`,
      taken: new Set(),
    });

    expect(importLine).toBe(
      String.raw`import type * as Models from '../O\'Brien\\model';`,
    );
  });

  it('names the declarations around the ones the module has', () => {
    const { importLine, block } = render(['Models', 'Assert', 'Extends']);
    expect(importLine).toContain('* as ModelsSchema from');
    expect(block).toContain('type AssertSchema<T extends true> = T;');
    expect(block).toContain('type ExtendsSchema<A, B>');
    expect(block).toContain('Pet: [\n    AssertSchema<ExtendsSchema<');
  });

  it('keeps the type out of the exports and names its reader apart', () => {
    const { block } = render([
      'SchemaModelTypeChecks',
      'schemaModelTypeChecks',
    ]);
    expect(block).not.toContain('export');
    expect(block).toContain('type SchemaModelTypeChecksSchema = {');
    expect(block).toContain(
      'declare const schemaModelTypeChecksSchema: SchemaModelTypeChecksSchema;',
    );
  });

  it('emits nothing without a check', () => {
    expect(
      renderModelTypeChecks({
        checks: [],
        modelsImportPath: '../model',
        inferOutput: (name) => name,
        taken: new Set(),
      }),
    ).toEqual({ importLine: '', block: '' });
  });

  it('leaves a comment where a schema is skipped', () => {
    const { importLine, block } = renderModelTypeChecks({
      checks: [
        { modelName: 'Pet', schemaName: 'Pet' },
        {
          modelName: 'Point',
          schemaName: 'Point',
          skipped: 'prefixItems is validated as an array of unknown',
        },
      ],
      modelsImportPath: '../model',
      inferOutput: (name) => `Infer<typeof ${name}>`,
      taken: new Set(),
    });
    expect(importLine).toBe("import type * as Models from '../model';");
    expect(block).toContain(
      '  ];\n  // Point: skipped, prefixItems is validated as an array of unknown\n};',
    );
    expect(block).not.toContain('Models.Point');
  });

  it('writes no import or helper when every schema is skipped', () => {
    expect(
      renderModelTypeChecks({
        checks: [{ modelName: 'Point', schemaName: 'Point', skipped: 'why' }],
        modelsImportPath: '../model',
        inferOutput: (name) => name,
        taken: new Set(),
      }),
    ).toEqual({
      importLine: '',
      block:
        'type SchemaModelTypeChecks = {\n  // Point: skipped, why\n};\ndeclare const schemaModelTypeChecks: SchemaModelTypeChecks;',
    });
  });
});

describe('getModelsImportPath', () => {
  it.each([
    ['/app/src/api/schemas.ts', '/app/src/api/model', './model'],
    ['/app/src/api/schemas.ts', '/app/src/model', '../model'],
    ['/app/src/api/schemas.ts', '/app/src/api/models/v2', './models/v2'],
    ['/app/src/api/schemas.ts', '/app/src', '..'],
  ])('imports %s -> %s as %s', (modulePath, models, expected) => {
    expect(getModelsImportPath(modulePath, models)).toBe(expected);
  });

  describe('names the index file when the module system needs an extension', () => {
    const nodeNext: Tsconfig = {
      compilerOptions: { module: 'nodenext', moduleResolution: 'nodenext' },
    };

    it.each([
      ['/app/src/model', '../model/index.js'],
      ['/app/src/api/model', './model/index.js'],
      ['/app/src/api', './index.js'],
      ['/app/src', '../index.js'],
    ])('under NodeNext, %s is %s', (models, expected) => {
      expect(
        getModelsImportPath('/app/src/api/schemas.ts', models, nodeNext),
      ).toBe(expected);
    });

    it('keeps the .ts extension with allowImportingTsExtensions', () => {
      expect(
        getModelsImportPath('/app/src/api/schemas.ts', '/app/src/model', {
          compilerOptions: { allowImportingTsExtensions: true },
        }),
      ).toBe('../model/index.ts');
    });
  });

  it.each<Tsconfig | undefined>([
    { compilerOptions: { module: 'esnext', moduleResolution: 'bundler' } },
    { compilerOptions: {} },
    undefined,
  ])('imports the directory when nothing needs an extension', (tsconfig) => {
    expect(
      getModelsImportPath(
        '/app/src/api/schemas.ts',
        '/app/src/model',
        tsconfig,
      ),
    ).toBe('../model');
  });

  it('keeps a dot in the name of the directory', () => {
    expect(
      getModelsImportPath('/app/src/api/schemas.ts', '/app/src/api/model.gen'),
    ).toBe('./model.gen');
    expect(
      getModelsImportPath('/app/src/api/schemas.ts', '/app/src/model.v2/gen'),
    ).toBe('../model.v2/gen');
  });
});
