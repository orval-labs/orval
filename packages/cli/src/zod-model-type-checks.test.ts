import type {
  NormalizedOutputOptions,
  OpenApiDocument,
  ZodVariantOption,
  ZodVersionOption,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import {
  addFormatTypeImports,
  generateZodSchemasInline,
} from './write-zod-specs';

// Exists for the refinement callable of a test, which is only serialized.
const Models = (value: unknown): boolean => typeof value === 'string';

const spec: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'test', version: '1' },
  paths: {},
  components: {
    schemas: {
      Pet: {
        type: 'object',
        properties: { owner: { $ref: '#/components/schemas/Owner' } },
      },
      Owner: { type: 'object', properties: { name: { type: 'string' } } },
      // Recursive: declares its own types.
      Node: {
        type: 'object',
        properties: {
          children: {
            type: 'array',
            items: { $ref: '#/components/schemas/Node' },
          },
        },
      },
    },
  },
};

interface OutputOptions {
  models?: string;
  target?: string;
  variant?: ZodVariantOption;
  version?: ZodVersionOption;
}

const outputWith = ({
  models,
  target = '/work/api.ts',
  variant = 'classic',
  version = 4,
}: OutputOptions = {}): NormalizedOutputOptions =>
  createTestContextSpec({
    spec,
    output: {
      target,
      override: {
        zod: { variant, version, generateReusableSchemas: true },
        ...(models ? { modelTypeChecks: { models } } : {}),
      },
    },
  }).output;

const inline = (
  output: NormalizedOutputOptions,
  includeImport = true,
  document: OpenApiDocument = spec,
): string =>
  generateZodSchemasInline(
    { spec: document, target: '', schemas: [] },
    output,
    includeImport,
  );

describe('zod modelTypeChecks', () => {
  it('asserts each constant against its model', () => {
    const code = inline(
      outputWith({
        models: '/work/gen/models',
        target: '/work/gen/zod/api.ts',
      }),
    );
    expect(code).toContain(
      "import * as zod from 'zod';\nimport type * as Models from '../models';",
    );
    expect(code).toContain('type Assert<T extends true> = T;');
    expect(code).toContain('\ntype SchemaModelTypeChecks = {');
    expect(code).not.toContain('export type SchemaModelTypeChecks');
    expect(code).toContain(
      '  Pet: [\n    Assert<Extends<zod.output<typeof Pet>, Models.Pet>>,\n    Assert<Extends<Models.Pet, zod.output<typeof Pet>>>,\n  ];',
    );
  });

  it('writes the block after the constants', () => {
    const code = inline(outputWith({ models: '/work/models' }));
    expect(code.indexOf('export const Pet =')).toBeLessThan(
      code.indexOf('\ntype SchemaModelTypeChecks'),
    );
  });

  it('checks a recursive constant against the type it is pinned to', () => {
    const code = inline(outputWith({ models: '/work/models' }));
    expect(code).toContain('export type Node = {');
    expect(code).toContain(
      'Assert<Extends<zod.output<typeof Node>, Models.Node>>',
    );
  });

  it('infers the output the same way in every Zod target', () => {
    const targets: OutputOptions[] = [
      { version: 3 },
      { version: 4 },
      { version: 4, variant: 'mini' },
    ];
    for (const target of targets) {
      const code = inline(outputWith({ models: '/work/models', ...target }));
      expect(code).toContain(
        'Assert<Extends<zod.output<typeof Pet>, Models.Pet>>',
      );
    }
  });

  it('imports the models next to a Zod Mini import', () => {
    const code = inline(
      outputWith({ models: '/work/models', variant: 'mini' }),
    );
    expect(code).toContain(
      "import * as zod from 'zod/mini';\nimport type * as Models from './models';",
    );
  });

  it('keeps the helper names clear of the components', () => {
    const code = inline(outputWith({ models: '/work/models' }), true, {
      ...spec,
      components: {
        schemas: {
          Models: { type: 'object', properties: { id: { type: 'string' } } },
          Assert: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
    });
    expect(code).toContain("import type * as ModelsSchema from './models';");
    expect(code).toContain('type AssertSchema<T extends true> = T;');
    expect(code).toContain(
      'AssertSchema<Extends<zod.output<typeof Assert>, ModelsSchema.Assert>>',
    );
    // The components keep their names.
    expect(code).toContain('export const Models =');
    expect(code).toContain('export const Assert =');
  });

  it('imports the models next to the target', () => {
    const code = inline(outputWith({ models: '/work/models' }));
    expect(code).toContain("from './models';");
  });

  it('keeps a dot in the name of the models directory', () => {
    expect(
      inline(
        outputWith({
          models: '/work/api/model.gen',
          target: '/work/api/zod/api.ts',
        }),
      ),
    ).toContain("from '../model.gen';");
    expect(
      inline(
        outputWith({
          models: '/work/api/zod/model.v2',
          target: '/work/api/zod/api.ts',
        }),
      ),
    ).toContain("from './model.v2';");
  });

  describe('imports the models from their index file only where the tsconfig needs it', () => {
    const withOutput = (
      extension: string,
      compilerOptions?: Record<string, unknown>,
    ) =>
      createTestContextSpec({
        spec,
        output: {
          target: `/work/api/zod/api${extension}`,
          fileExtension: extension,
          schemaFileExtension: extension,
          ...(compilerOptions ? { tsconfig: { compilerOptions } } : {}),
          override: {
            zod: { generateReusableSchemas: true },
            modelTypeChecks: { models: '/work/api/model' },
          },
        },
      }).output;
    const nodeNext = { module: 'nodenext', moduleResolution: 'nodenext' };

    // The models write `index.ts` whatever the extension of this output.
    it.each(['.ts', '.gen.ts', '.types.ts', '.zod.ts'])(
      'names no index file with %s and a bundler',
      (extension) => {
        expect(inline(withOutput(extension))).toContain("from '../model';");
      },
    );

    it.each(['.ts', '.gen.ts', '.types.ts', '.zod.ts'])(
      'names index.js under NodeNext with %s',
      (extension) => {
        expect(inline(withOutput(extension, nodeNext))).toContain(
          "from '../model/index.js';",
        );
      },
    );

    it.each(['.ts', '.gen.ts', '.types.ts', '.zod.ts'])(
      'names index.ts with allowImportingTsExtensions and %s',
      (extension) => {
        expect(
          inline(withOutput(extension, { allowImportingTsExtensions: true })),
        ).toContain("from '../model/index.ts';");
      },
    );
  });

  describe('names of the helpers', () => {
    const output = outputWith({ models: '/work/models' });
    const withModule = (moduleContent: string) =>
      generateZodSchemasInline(
        { spec, target: '', schemas: [] },
        output,
        false,
        undefined,
        false,
        undefined,
        undefined,
        moduleContent,
      );

    it('avoid what the module imports or declares around the constants', () => {
      const code = withModule(
        "import type { Models } from './other';\nexport const Extends = 1;\nexport type SchemaModelTypeChecks = string;\n",
      );
      expect(code).toContain("import type * as ModelsSchema from './models';");
      expect(code).toContain(
        'type ExtendsSchema<A, B> = [A] extends [B] ? true : false;',
      );
      expect(code).toContain('\ntype SchemaModelTypeChecksSchema = {');
    });
  });

  it('keeps the helper names clear of the decode functions the module imports', () => {
    const output = createTestContextSpec({
      spec,
      output: {
        target: '/work/api.ts',
        override: {
          formatType: {
            'date-time': {
              type: 'Day',
              decode: 'Models',
              decodeImport: { name: 'Models', importPath: './day' },
            },
          },
          zod: {
            variant: 'classic',
            version: 4,
            generateReusableSchemas: true,
          },
          modelTypeChecks: { models: '/work/models' },
        },
      },
    }).output;
    const dated: OpenApiDocument = {
      ...spec,
      components: { schemas: { At: { type: 'string', format: 'date-time' } } },
    };
    const code = addFormatTypeImports(
      generateZodSchemasInline(
        { spec: dated, target: '', schemas: [] },
        output,
        true,
      ),
      output.override,
    );
    expect(code).toContain("import { Models } from './day';");
    expect(code).toContain("import type * as ModelsSchema from './models';");
    expect(code).toContain('ModelsSchema.At');
    expect(code).not.toContain('Models.At');
  });

  describe('the params mutator the schemas import', () => {
    const paramsMutator = {
      name: 'schemaModelTypeChecks',
      path: './params',
      default: false,
      hasErrorType: false,
      errorTypeName: '',
      hasSecondArg: false,
      hasThirdArg: false,
      isHook: false,
    };

    it('keeps the helper names clear of its binding in a split output', () => {
      const code = generateZodSchemasInline(
        { spec, target: '', schemas: [] },
        outputWith({ models: '/work/models' }),
        true,
        paramsMutator,
        true,
      );
      expect(code).toContain(
        "import { schemaModelTypeChecks } from './params';",
      );
      expect(code).toContain('declare const schemaModelTypeChecksSchema:');
      expect(code).not.toContain('declare const schemaModelTypeChecks:');
    });
  });

  describe('a formatType function that no schema calls', () => {
    const outputOf = (decode: string) =>
      createTestContextSpec({
        spec,
        output: {
          target: '/work/api.ts',
          override: {
            formatType: {
              'date-time': {
                type: 'Day',
                decode,
                decodeImport: { name: decode, importPath: './day' },
              },
            },
            zod: {
              variant: 'classic',
              version: 4,
              generateReusableSchemas: true,
            },
            modelTypeChecks: { models: '/work/models' },
          },
        },
      }).output;
    const written = (output: NormalizedOutputOptions, document = spec) =>
      addFormatTypeImports(
        generateZodSchemasInline(
          { spec: document, target: '', schemas: [] },
          output,
          true,
        ),
        output.override,
      );

    it.each(['T', 'A', 'B'])(
      'is not imported for the type parameter %s of a helper',
      (decode) => {
        const code = written(outputOf(decode));
        expect(code).toContain('Assert<');
        expect(code).not.toContain("from './day'");
      },
    );

    it('is not imported for a word in the reason of a skipped check', () => {
      const skipped: OpenApiDocument = {
        ...spec,
        components: {
          schemas: {
            Tags: { type: 'array', readOnly: true, items: { type: 'string' } },
          },
        },
      };
      const code = written(outputOf('model'), skipped);
      expect(code).toContain('// Tags: skipped, a readOnly array');
      expect(code).not.toContain("from './day'");
    });

    it('is not imported for a segment of the path of an import', () => {
      expect(written(outputOf('models'))).not.toContain("from './day'");
    });

    it('is imported where a schema calls it', () => {
      const dated: OpenApiDocument = {
        ...spec,
        components: {
          schemas: { At: { type: 'string', format: 'date-time' } },
        },
      };
      expect(written(outputOf('T'), dated)).toContain(
        "import { T } from './day';",
      );
    });
  });

  describe('without the operations around the schemas', () => {
    const dayOutput = createTestContextSpec({
      spec,
      output: {
        target: '/work/api.ts',
        override: {
          formatType: {
            'date-time': {
              type: 'Day',
              decode: 'Models',
              decodeImport: { name: 'Models', importPath: './day' },
            },
          },
          zod: {
            variant: 'classic',
            version: 4,
            generateReusableSchemas: true,
          },
          modelTypeChecks: { models: '/work/models' },
        },
      },
    }).output;

    // Only an operation converts a date, so the schemas never mention the
    // function of the format, which a split output writes elsewhere.
    it('keeps the helper names clear of a formatType function that only they use', () => {
      const code = addFormatTypeImports(
        generateZodSchemasInline(
          { spec, target: '', schemas: [] },
          dayOutput,
          true,
        ),
        dayOutput.override,
      );
      expect(code).toContain("import type * as ModelsSchema from './models';");
      expect(code).not.toContain("from './day'");
    });

    it('keeps the helper names clear of the local name of a refinement import', () => {
      const output = createTestContextSpec({
        spec,
        output: {
          target: '/work/api.ts',
          override: {
            zod: {
              variant: 'classic',
              version: 4,
              generateReusableSchemas: true,
              schemaExtension: [
                {
                  type: 'string',
                  format: '',
                  validatorsGenerator: () => ({
                    callable: (value: unknown) => Models(value),
                    bindings: {
                      $imports: ["import { Models } from './is';"],
                    },
                  }),
                },
              ],
            },
            modelTypeChecks: { models: '/work/models' },
          },
        },
      }).output;
      const code = inline(output);
      expect(code).toContain("import { Models } from './is';");
      expect(code).toContain("import type * as ModelsSchema from './models';");
      expect(code).not.toContain('import type * as Models from');
    });
  });

  it('leaves the library import to the operations that have it', () => {
    const code = inline(outputWith({ models: '/work/models' }), false);
    expect(code.startsWith("import type * as Models from './models';")).toBe(
      true,
    );
    expect(code).not.toContain("from 'zod'");
  });

  it('emits nothing for a document without components', () => {
    expect(
      inline(outputWith({ models: '/work/models' }), true, {
        ...spec,
        components: {},
      }),
    ).toBe('');
  });

  describe('a schema looser than its model on purpose', () => {
    const loose: OpenApiDocument = {
      ...spec,
      components: {
        schemas: {
          Pet: {
            type: 'object',
            required: ['id'],
            properties: { id: { type: 'integer' } },
          },
          Page: {
            type: 'object',
            properties: { size: { type: 'integer', default: 20 } },
          },
          Tags: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                readOnly: true,
                items: { type: 'string' },
              },
            },
          },
          Listing: {
            type: 'object',
            properties: {
              page: { $ref: '#/components/schemas/Page' },
            },
          },
          // Zod has tuples and reads a cycle lazily, so both are checked.
          Point: { type: 'array', prefixItems: [{ type: 'number' }] },
          Tree: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/Tree' },
          },
        },
      },
    };
    const code = inline(outputWith({ models: '/work/models' }), true, loose);

    it('replaces the assertion with the reason', () => {
      expect(code).toContain(
        '  // Page: skipped, the default of an optional property makes it required in the schema output only\n',
      );
      expect(code).toContain(
        '  // Tags: skipped, a readOnly array is readonly in the model, which the schema output is not\n',
      );
      expect(code).not.toContain('Extends<zod.output<typeof Page>');
      expect(code).not.toContain('Extends<zod.output<typeof Tags>');
    });

    it('skips what references a skipped schema', () => {
      expect(code).toContain(
        '  // Listing: skipped, it references Page, which is skipped\n',
      );
    });

    it('still checks the others', () => {
      for (const name of ['Pet', 'Point', 'Tree']) {
        expect(code).toContain(
          `Assert<Extends<zod.output<typeof ${name}>, Models.${name}>>`,
        );
      }
    });
  });

  it('writes no check by default', () => {
    const code = inline(outputWith());
    expect(code).not.toContain('Models');
    expect(code).not.toContain('SchemaModelTypeChecks');
  });
});
