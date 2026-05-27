import { tmpdir } from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import {
  generateZodSchemasInline,
  writeZodSchemas,
  writeZodSchemasFromVerbs,
} from './write-zod-specs';

interface MinimalVerbsContext {
  output: {
    override: {
      useDates?: boolean;
      zod: {
        dateTimeOptions?: Record<string, unknown>;
        timeOptions?: Record<string, unknown>;
      };
    };
  };
  spec: unknown;
  target: string;
  workspace: string;
}
const createOutputOptions = (): Parameters<typeof writeZodSchemas>[4] =>
  ({
    namingConvention: 'PascalCase',
    indexFiles: true,
    override: {
      // Mirrors the normalized defaults the real pipeline supplies; the
      // recursive-schema TS-type generation (`resolveValue`) reads these.
      components: {
        schemas: { suffix: '', itemSuffix: 'Item' },
      },
      zod: {
        strict: {
          body: true,
        },
        generate: {
          param: true,
          body: true,
          query: true,
          header: true,
          response: true,
        },
        coerce: {
          body: false,
        },
      },
    },
  }) as Parameters<typeof writeZodSchemas>[4];

describe('write-zod-specs regressions', () => {
  it('writes const constraints before schema export', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {},
      target: '',
      schemas: [
        {
          name: 'RangeSchema',
          schema: {
            type: 'number',
            minimum: 2,
            maximum: 10,
          },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    await writeZodSchemas(
      builder,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
    );

    const filePath = path.join(schemasPath, 'RangeSchema.ts');
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain('export const RangeSchemaMin = 2;');
    expect(fileContent).toContain('export const RangeSchemaMax = 10;');
    expect(
      fileContent.indexOf('export const RangeSchemaMin = 2;'),
    ).toBeLessThan(fileContent.indexOf('export const RangeSchema ='));
    expect(fileContent).toContain(
      'export const RangeSchema = zod.number().min(RangeSchemaMin).max(RangeSchemaMax)',
    );
    expect(fileContent).toContain(
      'export type RangeSchema = zod.input<typeof RangeSchema>;',
    );
    expect(fileContent).toContain(
      'export type RangeSchemaOutput = zod.output<typeof RangeSchema>;',
    );
    expect(fileContent).not.toContain('\n    export type RangeSchema =');
    expect(fileContent).not.toContain(
      'export const RangeSchema = export const',
    );

    await fs.remove(root);
  });

  it('merges case-colliding schema files and keeps canonical index export', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const context = {
      output: {
        override: {
          useDates: false,
          zod: {
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      },
      spec: {},
      target: '',
      workspace: root,
    } satisfies MinimalVerbsContext;

    const verbOptions = {
      firstVerb: {
        operationName: 'fooBar',
        originalOperation: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'number',
                  minimum: 2,
                },
              },
            },
          },
          parameters: [],
        },
        response: {
          types: {
            success: [],
            errors: [],
          },
        },
      },
      secondVerb: {
        operationName: 'Foobar',
        originalOperation: {
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'number',
                  minimum: 3,
                },
              },
            },
          },
          parameters: [],
        },
        response: {
          types: {
            success: [],
            errors: [],
          },
        },
      },
    } satisfies Parameters<typeof writeZodSchemasFromVerbs>[0];

    await writeZodSchemasFromVerbs(
      verbOptions,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
      context,
    );

    const directoryFiles = await fs.readdir(schemasPath);
    const schemaFiles = directoryFiles.filter((file) =>
      file.toLowerCase().startsWith('foobarbody.'),
    );

    expect(schemaFiles).toHaveLength(1);

    const mergedFilePath = path.join(schemasPath, schemaFiles[0]);
    const mergedContent = await fs.readFile(mergedFilePath, 'utf8');

    expect(mergedContent).toContain('export const FooBarBodyMin = 2;');
    expect(mergedContent).toContain('export const FoobarBodyMin = 3;');
    expect(mergedContent).toContain(
      'export const FooBarBody = zod.number().min(FooBarBodyMin)',
    );
    expect(mergedContent).toContain(
      'export const FoobarBody = zod.number().min(FoobarBodyMin)',
    );

    const indexPath = path.join(schemasPath, 'index.ts');
    const indexContent = await fs.readFile(indexPath, 'utf8');
    const mergedSchemaExport = path.basename(schemaFiles[0], '.ts');

    expect(indexContent).toContain(`export * from './${mergedSchemaExport}';`);

    await fs.remove(root);
  });

  it('writes default const before schema export in split output (#2801)', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {},
      target: '',
      schemas: [
        {
          name: 'DefaultedSchema',
          schema: {
            type: 'string',
            default: 'hello',
          },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    await writeZodSchemas(
      builder,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
    );

    const filePath = path.join(schemasPath, 'DefaultedSchema.ts');
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain(
      'export const DefaultedSchemaDefault = `hello`;',
    );
    expect(fileContent).toContain(
      'export const DefaultedSchema = zod.string()',
    );
    expect(
      fileContent.indexOf('export const DefaultedSchemaDefault = `hello`;'),
    ).toBeLessThan(fileContent.indexOf('export const DefaultedSchema ='));
    expect(fileContent).not.toContain(
      'export const DefaultedSchema = export const',
    );

    await fs.remove(root);
  });

  it('honors response generate override in split zod output', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const context = {
      output: {
        override: {
          useDates: false,
          zod: {
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      },
      spec: {},
      target: '',
      workspace: root,
    } satisfies MinimalVerbsContext;

    const verbOptions = {
      getPet: {
        operationName: 'getPet',
        originalOperation: {
          parameters: [],
        },
        override: {
          ...createOutputOptions().override,
          zod: {
            ...createOutputOptions().override.zod,
            generate: {
              param: true,
              body: true,
              query: true,
              header: true,
              response: false,
            },
          },
        },
        response: {
          types: {
            success: [
              {
                value: 'GetPetResponse',
                originalSchema: {
                  type: 'object',
                  properties: {
                    id: {
                      type: 'string',
                    },
                  },
                },
              },
            ],
            errors: [],
          },
        },
      },
    } satisfies Parameters<typeof writeZodSchemasFromVerbs>[0];

    await writeZodSchemasFromVerbs(
      verbOptions,
      schemasPath,
      '.ts',
      '',
      createOutputOptions(),
      context,
    );

    if (await fs.pathExists(schemasPath)) {
      const directoryFiles = await fs.readdir(schemasPath);

      expect(directoryFiles).not.toContain('GetPetResponse.ts');
    }

    await fs.remove(root);
  });
});

describe('writeZodSchemas with generateReusableSchemas', () => {
  it('emits cross-file imports instead of inlining $refs', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-reuse-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: { owner: { $ref: '#/components/schemas/Owner' } },
              required: ['owner'],
            },
            Owner: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: 'Pet', schema: { $ref: '#/components/schemas/Pet' } },
        { name: 'Owner', schema: { $ref: '#/components/schemas/Owner' } },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    const options = createOutputOptions();
    (options.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;

    await writeZodSchemas(builder, schemasPath, '.ts', '', options);

    const petContent = await fs.readFile(
      path.join(schemasPath, 'Pet.ts'),
      'utf8',
    );
    const ownerContent = await fs.readFile(
      path.join(schemasPath, 'Owner.ts'),
      'utf8',
    );

    expect(petContent).toMatch(/from '\.\/Owner'/);
    expect(petContent).not.toContain('__REF_');
    expect(ownerContent).not.toContain('__REF_');

    await fs.remove(root);
  });

  it('emits schemas whose raw name differs from the sanitized model name', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-reuse-raw-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {
        components: {
          schemas: {
            Page_Item_: {
              type: 'object',
              properties: { total: { type: 'number' } },
              required: ['total'],
            },
          },
        },
      },
      target: '',
      schemas: [
        {
          name: 'PageItem',
          schema: { $ref: '#/components/schemas/Page_Item_' },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    const options = createOutputOptions();
    (options.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;

    await writeZodSchemas(builder, schemasPath, '.ts', '', options);

    const fileExists = await fs.pathExists(
      path.join(schemasPath, 'PageItem.ts'),
    );
    expect(fileExists).toBe(true);

    const content = await fs.readFile(
      path.join(schemasPath, 'PageItem.ts'),
      'utf8',
    );
    expect(content).toContain('export const PageItem = ');

    await fs.remove(root);
  });

  it('pins recursive schemas to a generated TS type across files', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-reuse-rec-'));
    const schemasPath = path.join(root, 'schemas');

    // Node <-> Edge mutual recursion: the back-edge is emitted as a `zod.lazy`,
    // so each `const` reads (transitively) its own binding and needs an
    // explicit `zod.ZodType<...>` annotation to satisfy TS7022.
    const builder = {
      spec: {
        components: {
          schemas: {
            Node: {
              type: 'object',
              properties: {
                edges: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Edge' },
                },
              },
              required: ['edges'],
            },
            Edge: {
              type: 'object',
              properties: { to: { $ref: '#/components/schemas/Node' } },
              required: ['to'],
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: 'Node', schema: { $ref: '#/components/schemas/Node' } },
        { name: 'Edge', schema: { $ref: '#/components/schemas/Edge' } },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    const options = createOutputOptions();
    (options.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;

    await writeZodSchemas(builder, schemasPath, '.ts', '', options);

    const nodeContent = await fs.readFile(
      path.join(schemasPath, 'Node.ts'),
      'utf8',
    );

    // The recursive TS type is generated and the const is pinned to it.
    expect(nodeContent).toContain('export type Node = ');
    expect(nodeContent).toContain('export const Node: zod.ZodType<Node> = ');
    // Cross-file reference to Edge is imported (so the generated type resolves).
    expect(nodeContent).toMatch(/from '\.\/Edge'/);
    // The acyclic `zod.input<typeof Node>` alias would be circular here.
    expect(nodeContent).not.toContain('export type Node = zod.input<');
    expect(nodeContent).not.toContain('__REF_');

    await fs.remove(root);
  });
});

describe('writeZodSchemasFromVerbs with generateReusableSchemas', () => {
  it('skips operation wrapper when body is a pure $ref', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-verbs-'));
    const schemasPath = path.join(root, 'schemas');

    const verbOptions = {
      petCreate: {
        operationName: 'petCreate',
        originalOperation: {
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Pet' },
              },
            },
          },
        },
        response: { types: { success: [], errors: [] } },
      },
    } as never;

    const options = createOutputOptions();
    (options.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;
    const ctx = {
      output: {
        override: {
          useDates: false,
          zod: { dateTimeOptions: {}, timeOptions: {} },
        },
      },
      spec: {
        components: {
          schemas: {
            Pet: { type: 'object', properties: { id: { type: 'number' } } },
          },
        },
      } as never,
      target: '',
      workspace: '',
    } satisfies MinimalVerbsContext;

    await writeZodSchemasFromVerbs(
      verbOptions,
      schemasPath,
      '.ts',
      '',
      options,
      ctx,
    );

    // No PetCreateBody file should be emitted because the body is a pure ref.
    const fileExists = await fs.pathExists(
      path.join(schemasPath, 'PetCreateBody.ts'),
    );
    expect(fileExists).toBe(false);

    await fs.remove(root);
  });

  // Regression for #3463: an operation param/body/response that references a
  // component schema (e.g. a nullable enum query param) must rewrite the
  // `__REF_<name>__` sentinel to the bare identifier AND emit the import.
  it('rewrites sentinels and emits imports for refs in operation schemas', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-verbs-ref-'));
    const schemasPath = path.join(root, 'schemas');

    const verbOptions = {
      findPetsByStatus: {
        operationName: 'findPetsByStatus',
        originalOperation: {
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              schema: {
                anyOf: [
                  { $ref: '#/components/schemas/PetStatus' },
                  { type: 'null' },
                ],
              },
            },
          ],
        },
        response: { types: { success: [], errors: [] } },
      },
    } as never;

    const options = createOutputOptions();
    // camelCase namingConvention → file names are camelCased (`petStatus.ts`),
    // but the exported identifier is always PascalCase (`PetStatus`).
    (options as { namingConvention: string }).namingConvention = 'camelCase';
    (options.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;
    const ctx = {
      output: {
        override: {
          useDates: false,
          zod: { dateTimeOptions: {}, timeOptions: {} },
        },
      },
      spec: {
        components: {
          schemas: {
            PetStatus: {
              type: 'string',
              enum: ['available', 'pending', 'sold'],
            },
          },
        },
      } as never,
      target: '',
      workspace: '',
    } satisfies MinimalVerbsContext;

    await writeZodSchemasFromVerbs(
      verbOptions,
      schemasPath,
      '.ts',
      '',
      options,
      ctx,
    );

    const content = await fs.readFile(
      path.join(schemasPath, 'findPetsByStatusParams.ts'),
      'utf8',
    );

    // Sentinel resolved to the bare PascalCase identifier...
    expect(content).not.toContain('__REF_');
    expect(content).toContain('zod.union([PetStatus,');
    // ...and the matching import is emitted (PascalCase symbol, camelCase file).
    expect(content).toContain("import { PetStatus } from './petStatus';");

    await fs.remove(root);
  });
});

describe('generateZodSchemasInline with generateReusableSchemas', () => {
  it('emits one named schema per reachable component ref', () => {
    const builder = {
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              properties: { owner: { $ref: '#/components/schemas/Owner' } },
              required: ['owner'],
            },
            Owner: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: 'Pet', schema: { $ref: '#/components/schemas/Pet' } },
        { name: 'Owner', schema: { $ref: '#/components/schemas/Owner' } },
      ],
    } satisfies Parameters<typeof generateZodSchemasInline>[0];

    const output = createOutputOptions();
    (output.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;

    const result = generateZodSchemasInline(builder, output);

    expect(result).toContain('export const Owner =');
    expect(result).toContain('export const Pet =');
    // Pet references Owner by name (direct, since DAG).
    // Property name may be quoted in the output ("owner" or owner).
    expect(result).toMatch(/"?owner"?:\s*Owner/);
    // No sentinels.
    expect(result).not.toContain('__REF_');
  });
});
