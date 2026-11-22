import type { NormalizedOutputOptions, OpenApiDocument } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { generateValibotSchemasInline } from './schemas-inline';

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
    },
  },
};

const ref = (key: string) => ({ $ref: `#/components/schemas/${key}` });

const outputWith = (suffix: string): NormalizedOutputOptions =>
  createTestContextSpec({
    spec,
    output: {
      override: {
        components: { schemas: { suffix } },
        valibot: { generateReusableSchemas: true },
      },
    },
  }).output;

const inlineWith = (suffix: string): string =>
  generateValibotSchemasInline({ spec, target: '' }, outputWith(suffix), false);

describe('generateValibotSchemasInline', () => {
  it('follows the naming options when one spec is reused', () => {
    for (const suffix of ['A', 'B', 'A']) {
      const code = inlineWith(suffix);
      expect(code).toContain(`export const Pet${suffix} =`);
      expect(code).toContain(`export const Owner${suffix} =`);
      expect(code).toContain(`owner: v.optional(Owner${suffix})`);
    }
  });

  it('imports the decode functions the constants reference', () => {
    const output = createTestContextSpec({
      output: {
        override: {
          formatType: {
            'date-time': {
              type: 'Day',
              decode: 'toDay',
              decodeImport: { name: 'toDay', importPath: './day' },
            },
            uuid: {
              type: 'Id',
              decode: 'toId',
              decodeImport: { name: 'toId', importPath: './id' },
            },
          },
          valibot: { generateReusableSchemas: true },
        },
      },
    }).output;
    const mapped: OpenApiDocument = {
      ...spec,
      components: { schemas: { At: { type: 'string', format: 'date-time' } } },
    };
    const inline = (precedingContent?: string) =>
      generateValibotSchemasInline(
        { spec: mapped, target: '' },
        output,
        true,
        precedingContent,
      );
    const toDayImport = "import { toDay } from './day';";

    expect(inline()).toContain(
      `import * as v from 'valibot';\n${toDayImport}\n\nexport const At =`,
    );
    expect(inline()).not.toContain('toId');
    expect(inline(`${toDayImport}\n`)).not.toContain(toDayImport);
  });

  it('scans only the constants for the decode functions to import', () => {
    const output = createTestContextSpec({
      output: {
        target: '/work/api.ts',
        override: {
          formatType: {
            uuid: {
              type: 'Id',
              decode: 'File',
              decodeImport: { name: 'File', importPath: './u' },
            },
          },
          valibot: { generateReusableSchemas: true },
          modelTypeChecks: { models: '/work/models' },
        },
      },
    }).output;
    const binary: OpenApiDocument = {
      ...spec,
      components: {
        schemas: {
          Upload: {
            type: 'object',
            properties: { body: { type: 'string', format: 'binary' } },
          },
        },
      },
    };
    const code = generateValibotSchemasInline(
      { spec: binary, target: '' },
      output,
      true,
    );
    expect(code).toContain('// Upload: skipped, a binary string');
    expect(code).not.toContain("from './u'");
  });

  describe('modelTypeChecks', () => {
    const checked: OpenApiDocument = {
      ...spec,
      components: {
        schemas: {
          ...spec.components?.schemas,
          // Its constant is named `DateSchema`, the model `Date`.
          Date: { type: 'object', properties: { id: { type: 'string' } } },
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
    const checksOutput = (models: string, target: string) =>
      createTestContextSpec({
        spec: checked,
        output: {
          target,
          override: {
            valibot: { generateReusableSchemas: true },
            modelTypeChecks: { models },
          },
        },
      }).output;
    const inline = (output: NormalizedOutputOptions, includeImport = true) =>
      generateValibotSchemasInline(
        { spec: checked, target: '' },
        output,
        includeImport,
      );

    it('asserts each constant against its model', () => {
      const code = inline(
        checksOutput('/work/gen/models', '/work/gen/valibot/api.ts'),
      );
      expect(code).toContain(
        "import * as v from 'valibot';\nimport type * as Models from '../models';",
      );
      expect(code).toContain('type SchemaModelTypeChecks = {');
      expect(code).not.toContain('export type SchemaModelTypeChecks');
      expect(code).toContain(
        '  Pet: [\n    Assert<Extends<v.InferOutput<typeof Pet>, Models.Pet>>,\n    Assert<Extends<Models.Pet, v.InferOutput<typeof Pet>>>,\n  ];',
      );
    });

    it('names the model, not the constant, when they differ', () => {
      const code = inline(checksOutput('/work/models', '/work/api.ts'));
      expect(code).toContain(
        'Assert<Extends<v.InferOutput<typeof DateSchema>, Models.Date>>',
      );
      expect(code).toContain(
        'Assert<Extends<Models.Date, v.InferOutput<typeof DateSchema>>>',
      );
    });

    it('checks a recursive constant like any other', () => {
      const code = inline(checksOutput('/work/models', '/work/api.ts'));
      expect(code).toContain('export type Node = {');
      expect(code).toContain(
        'Assert<Extends<v.InferOutput<typeof Node>, Models.Node>>',
      );
    });

    it('imports the models next to the target', () => {
      const code = inline(checksOutput('/work/models', '/work/api.ts'));
      expect(code).toContain("from './models';");
    });

    it('keeps a dot in the name of the models directory', () => {
      const code = inline(
        checksOutput('/work/api/model.gen', '/work/api/valibot/api.ts'),
      );
      expect(code).toContain("from '../model.gen';");
      const sibling = inline(
        checksOutput('/work/api/valibot/model.v2', '/work/api/valibot/api.ts'),
      );
      expect(sibling).toContain("from './model.v2';");
    });

    describe('imports the models from their index file only where the tsconfig needs it', () => {
      const withOutput = (
        extension: string,
        compilerOptions?: Record<string, unknown>,
      ) =>
        createTestContextSpec({
          spec: checked,
          output: {
            target: `/work/api/valibot/api${extension}`,
            fileExtension: extension,
            schemaFileExtension: extension,
            ...(compilerOptions ? { tsconfig: { compilerOptions } } : {}),
            override: {
              valibot: { generateReusableSchemas: true },
              modelTypeChecks: { models: '/work/api/model' },
            },
          },
        }).output;
      const nodeNext = { module: 'nodenext', moduleResolution: 'nodenext' };

      // The models write `index.ts` whatever the extension of this output.
      it.each(['.ts', '.gen.ts', '.types.ts'])(
        'names no index file with %s and a bundler',
        (extension) => {
          expect(inline(withOutput(extension))).toContain("from '../model';");
        },
      );

      it.each(['.ts', '.gen.ts', '.types.ts'])(
        'names index.js under NodeNext with %s',
        (extension) => {
          expect(inline(withOutput(extension, nodeNext))).toContain(
            "from '../model/index.js';",
          );
        },
      );

      it.each(['.ts', '.gen.ts', '.types.ts'])(
        'names index.ts with allowImportingTsExtensions and %s',
        (extension) => {
          expect(
            inline(withOutput(extension, { allowImportingTsExtensions: true })),
          ).toContain("from '../model/index.ts';");
        },
      );
    });

    describe('names of the helpers', () => {
      const output = checksOutput('/work/models', '/work/api.ts');

      it('avoid what the module imports before the constants', () => {
        const code = generateValibotSchemasInline(
          { spec: checked, target: '' },
          output,
          false,
          "import type { Models, Assert } from './other';\n",
        );
        expect(code).toContain(
          "import type * as ModelsSchema from './models';",
        );
        expect(code).toContain('ModelsSchema.Pet');
        expect(code).toContain('type AssertSchema<T extends true> = T;');
        expect(code).toContain('AssertSchema<Extends<');
      });

      it('avoid what the operations declare after the constants', () => {
        const code = generateValibotSchemasInline(
          { spec: checked, target: '' },
          output,
          false,
          '',
          'export const Extends = 1;\nexport type SchemaModelTypeChecks = string;\n',
        );
        expect(code).toContain(
          'type ExtendsSchema<A, B> = [A] extends [B] ? true : false;',
        );
        expect(code).toContain('type SchemaModelTypeChecksSchema = {');
      });
    });

    it('avoid the decode functions the constants make the module import', () => {
      const withDecode = (alias?: string) =>
        createTestContextSpec({
          spec: checked,
          output: {
            target: '/work/api.ts',
            override: {
              formatType: {
                'date-time': {
                  type: 'Day',
                  decode: 'Models',
                  decodeImport: {
                    name: 'Models',
                    ...(alias ? { alias } : {}),
                    importPath: './day',
                  },
                },
              },
              valibot: { generateReusableSchemas: true },
              modelTypeChecks: { models: '/work/models' },
            },
          },
        }).output;
      const dated: OpenApiDocument = {
        ...spec,
        components: {
          schemas: { At: { type: 'string', format: 'date-time' } },
        },
      };
      const code = (output: NormalizedOutputOptions) =>
        generateValibotSchemasInline({ spec: dated, target: '' }, output, true);
      const plain = code(withDecode());
      expect(plain).toContain("import { Models } from './day';");
      expect(plain).toContain("import type * as ModelsSchema from './models';");
      expect(plain).toContain('ModelsSchema.At');
      const aliased = code(withDecode('Assert'));
      expect(aliased).toContain('AssertSchema<Extends<');
    });

    it('leaves the library import to the operations that have it', () => {
      const code = inline(checksOutput('/work/models', '/work/api.ts'), false);
      expect(code.startsWith("import type * as Models from './models';")).toBe(
        true,
      );
      expect(code).not.toContain("from 'valibot'");
    });

    it('emits nothing for a document without components', () => {
      const output = checksOutput('/work/models', '/work/api.ts');
      expect(
        generateValibotSchemasInline(
          { spec: { ...spec, components: {} }, target: '' },
          output,
          true,
        ),
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
            Point: { type: 'array', prefixItems: [{ type: 'number' }] },
            Route: {
              type: 'object',
              properties: { stops: { type: 'array', items: ref('Point') } },
            },
            // Valibot reads the cycle as `unknown`.
            Tree: { type: 'object', additionalProperties: ref('Tree') },
          },
        },
      };
      const code = generateValibotSchemasInline(
        { spec: loose, target: '' },
        checksOutput('/work/models', '/work/api.ts'),
        true,
      );

      it('replaces the assertion with the reason', () => {
        expect(code).toContain(
          '  // Point: skipped, prefixItems is validated as an array of unknown\n',
        );
        expect(code).toContain(
          '  // Tree: skipped, a circular reference is validated as unknown\n',
        );
        expect(code).not.toContain('typeof Point>');
        expect(code).not.toContain('typeof Tree>');
      });

      it('skips what references a skipped schema', () => {
        expect(code).toContain(
          '  // Route: skipped, it references Point, which is skipped\n',
        );
      });

      it('still checks the others', () => {
        expect(code).toContain(
          'Assert<Extends<v.InferOutput<typeof Pet>, Models.Pet>>',
        );
      });

      it('writes the block without an import when every schema is skipped', () => {
        const onlyLoose: OpenApiDocument = {
          ...spec,
          components: {
            schemas: { Point: { type: 'array', prefixItems: [{}] } },
          },
        };
        const skipped = generateValibotSchemasInline(
          { spec: onlyLoose, target: '' },
          checksOutput('/work/models', '/work/api.ts'),
          true,
        );
        expect(skipped).not.toContain('Models');
        expect(skipped).not.toContain('Assert');
        expect(skipped).toContain(
          'type SchemaModelTypeChecks = {\n  // Point: skipped,',
        );
      });
    });

    it('writes no check by default', () => {
      const code = generateValibotSchemasInline(
        { spec: checked, target: '' },
        outputWith(''),
        true,
      );
      expect(code).not.toContain('Models');
      expect(code).not.toContain('SchemaModelTypeChecks');
    });
  });
});
