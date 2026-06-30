import { tmpdir } from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import {
  buildSiblingImports,
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
        variant: 'classic',
        version: 'auto',
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

  it('writes zod mini schema files with zod/mini imports', async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-mini-'));
    const schemasPath = path.join(root, 'schemas');
    const output = createOutputOptions();
    output.override.zod.variant = 'mini';
    output.override.zod.version = 4;

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

    await writeZodSchemas(builder, schemasPath, '.ts', '', output);

    const fileContent = await fs.readFile(
      path.join(schemasPath, 'RangeSchema.ts'),
      'utf8',
    );

    expect(fileContent).toContain("import * as zod from 'zod/mini';");
    expect(fileContent).toContain(
      'export const RangeSchema = /*#__PURE__*/ zod.number().check(/*#__PURE__*/ zod.gte(RangeSchemaMin)).check(/*#__PURE__*/ zod.lte(RangeSchemaMax))',
    );

    await fs.remove(root);
  });

  it("defaults 'auto' to zod v4 syntax when no packageJson is available", async () => {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {},
      target: '',
      schemas: [
        {
          name: 'PetSchema',
          schema: {
            type: 'object',
            properties: {
              email: {
                type: 'string',
                format: 'email',
              },
            },
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

    const filePath = path.join(schemasPath, 'PetSchema.ts');
    const fileContent = await fs.readFile(filePath, 'utf8');

    expect(fileContent).toContain('zod.strictObject({');
    expect(fileContent).toContain('"email": zod.email().optional()');
    expect(fileContent).not.toContain('.strict()');
    expect(fileContent).not.toContain('zod.string().email()');

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
    options.override.zod.generateReusableSchemas = true;

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
    options.override.zod.generateReusableSchemas = true;

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
    options.override.zod.generateReusableSchemas = true;

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

  it('imports type-only refs that the recursive TS body uses but the zod runtime drops', async () => {
    // A recursive schema whose TS type references a sibling component only
    // through `propertyNames` (record-key constraint). The zod runtime
    // collapses record keys to `zod.string()`, so that sibling never appears
    // in the entry's `usedRefs`. Pre-fix the split-mode writer derived imports
    // purely from `usedRefs`, leaving the rendered `Partial<Record<KeyType,
    // ...>>` referencing an unimported `KeyType` (TS2304).
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-reuse-pn-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {
        components: {
          schemas: {
            // `Tree` recurses through its `children` map. The map keys are
            // constrained by `RelationType` (propertyNames $ref); the values
            // are arrays of self-references.
            Tree: {
              type: 'object',
              properties: {
                children: {
                  type: 'object',
                  propertyNames: {
                    $ref: '#/components/schemas/RelationType',
                  },
                  additionalProperties: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Tree' },
                  },
                },
              },
            },
            RelationType: {
              type: 'string',
              enum: ['parent', 'child', 'sibling'],
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: 'Tree', schema: { $ref: '#/components/schemas/Tree' } },
        {
          name: 'RelationType',
          schema: { $ref: '#/components/schemas/RelationType' },
        },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    const options = createOutputOptions();
    options.override.zod.generateReusableSchemas = true;

    await writeZodSchemas(builder, schemasPath, '.ts', '', options);

    const treeContent = await fs.readFile(
      path.join(schemasPath, 'Tree.ts'),
      'utf8',
    );

    // The recursive TS type references RelationType through the record key.
    expect(treeContent).toMatch(/Record<\s*RelationType/);
    // And that sibling is imported so the file compiles.
    expect(treeContent).toMatch(
      /import \{ RelationType \} from '\.\/RelationType'/,
    );
    // `resolveValue` reports `Tree` itself in its imports for the recursive
    // body; the writer must filter self-refs so `Tree.ts` doesn't import from
    // `./Tree`.
    expect(treeContent).not.toMatch(/from '\.\/Tree'/);
    expect(treeContent).not.toContain('__REF_');

    // The bug's mechanism: the zod runtime collapses `propertyNames` to a
    // plain string key (`zod.record(zod.string(), ...)`), so `RelationType`
    // never enters `usedRefs` from the runtime path. Pin that here — if the
    // runtime ever started carrying the propertyNames ref through to the zod
    // expression, `RelationType` would land in `usedRefs` directly and the
    // `extraImports` path would no longer be load-bearing for this case.
    expect(treeContent).toMatch(/zod\.record\(\s*zod\.string\(\)/);
    expect(treeContent).not.toMatch(/zod\.record\(\s*RelationType/);

    // RelationType itself is emitted as a sibling file; the import above
    // would dangle without this. Asserting the emission keeps "what's
    // imported" and "what's written" in lockstep.
    expect(await fs.pathExists(path.join(schemasPath, 'RelationType.ts'))).toBe(
      true,
    );

    await fs.remove(root);
  });

  it('emits the implicit sub-model an inline nested object hoists in a recursive schema', async () => {
    // A recursive schema (self-loop via `next`) takes the explicit
    // `zod.ZodType<T>` path, whose TS body is hand-written from
    // `resolveValue().value`. That body references the implicit sub-model
    // `resolveValue` mints for the inline `meta` object (`ActionMeta`), which
    // arrives in `resolved.schemas`. Pre-fix the writer dropped
    // `resolved.schemas`, so the body named a type that was never declared
    // (TS2552 in single-file output, TS2305 in split). The acyclic path never
    // hits this: it derives its type via `zod.input<typeof X>`.
    const root = await fs.mkdtemp(path.join(tmpdir(), 'orval-zod-reuse-sub-'));
    const schemasPath = path.join(root, 'schemas');

    const builder = {
      spec: {
        components: {
          schemas: {
            Action: {
              type: 'object',
              properties: {
                next: { $ref: '#/components/schemas/Action' },
                meta: {
                  type: 'object',
                  properties: { label: { type: 'string' } },
                },
              },
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: 'Action', schema: { $ref: '#/components/schemas/Action' } },
      ],
    } satisfies Parameters<typeof writeZodSchemas>[0];

    const options = createOutputOptions();
    options.override.zod.generateReusableSchemas = true;

    await writeZodSchemas(builder, schemasPath, '.ts', '', options);

    const actionContent = await fs.readFile(
      path.join(schemasPath, 'Action.ts'),
      'utf8',
    );

    // The recursive path is taken (so the hand-written body is in play) and
    // references the hoisted sub-model.
    expect(actionContent).toContain(
      'export const Action: zod.ZodType<Action> = ',
    );
    expect(actionContent).toMatch(/meta\??: ActionMeta/);
    // The sub-model is declared locally in the same file — not a dangling
    // reference, not a cross-file import, and no sibling file is written for
    // it (it isn't a component).
    expect(actionContent).toContain('export type ActionMeta = ');
    expect(actionContent).not.toMatch(/from '\.\/ActionMeta'/);
    expect(await fs.pathExists(path.join(schemasPath, 'ActionMeta.ts'))).toBe(
      false,
    );
    expect(actionContent).not.toContain('__REF_');

    await fs.remove(root);
  });
});

describe('buildSiblingImports', () => {
  // The helper is exported for these tests because no `resolveValue` caller
  // that feeds `renderReusableSchemaEntry` produces aliased imports today —
  // an integration test can't reach the alias branch through a real spec.
  // Driving the helper directly pins the contract.
  const componentNames = new Set(['Foo', 'Bar', 'Baz']);

  it('emits one bare import per name from usedRefs', () => {
    const out = buildSiblingImports({
      usedRefs: ['Foo', 'Bar'],
      extraImports: [],
      entryName: 'Entry',
      componentNames,
      namingConvention: 'PascalCase',
      importExt: '',
    });

    expect(out).toBe(
      `import { Bar } from './Bar';\nimport { Foo } from './Foo';`,
    );
  });

  it('emits an aliased import when extraImports carries `alias`', () => {
    const out = buildSiblingImports({
      usedRefs: [],
      extraImports: [{ name: 'Foo', alias: 'FooBis' }],
      entryName: 'Entry',
      componentNames,
      namingConvention: 'PascalCase',
      importExt: '',
    });

    // Filename derives from the export `name`; the alias only changes the
    // local binding.
    expect(out).toBe(`import { Foo as FooBis } from './Foo';`);
  });

  it('lets an aliased extraImports entry override a bare usedRefs entry for the same name', () => {
    const out = buildSiblingImports({
      usedRefs: ['Foo'],
      extraImports: [{ name: 'Foo', alias: 'FooBis' }],
      entryName: 'Entry',
      componentNames,
      namingConvention: 'PascalCase',
      importExt: '',
    });

    // The recursive TS body uses the local binding (`FooBis`); the aliased
    // form has to win, otherwise the body refers to an unbound name.
    expect(out).toBe(`import { Foo as FooBis } from './Foo';`);
  });

  it('drops self-refs and non-component names', () => {
    const out = buildSiblingImports({
      usedRefs: ['Entry', 'Foo'],
      extraImports: [
        { name: 'Entry', alias: 'EntryBis' },
        { name: 'NotAComponent' },
        { name: 'Bar' },
      ],
      entryName: 'Entry',
      componentNames,
      namingConvention: 'PascalCase',
      importExt: '',
    });

    expect(out).toBe(
      `import { Bar } from './Bar';\nimport { Foo } from './Foo';`,
    );
  });

  it('sorts by source name (stable across `extraImports` and `usedRefs` order)', () => {
    const out = buildSiblingImports({
      usedRefs: ['Foo'],
      extraImports: [{ name: 'Baz' }, { name: 'Bar', alias: 'BarBis' }],
      entryName: 'Entry',
      componentNames,
      namingConvention: 'PascalCase',
      importExt: '',
    });

    expect(out).toBe(
      `import { Bar as BarBis } from './Bar';\n` +
        `import { Baz } from './Baz';\n` +
        `import { Foo } from './Foo';`,
    );
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
    options.override.zod.generateReusableSchemas = true;
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
    options.override.zod.generateReusableSchemas = true;
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

  it('emits schemas whose raw name differs from the sanitized model name', () => {
    // `__my_data` sanitizes to `_MyData`. The inline writer must seed from the
    // RAW component keys; seeding from `builder.schemas` (sanitized) yields a
    // ref (`#/components/schemas/_MyData`) absent from `components.schemas`, so
    // the definition used to be dropped — leaving the operation wrapper that
    // references it dangling.
    const builder = {
      spec: {
        components: {
          schemas: {
            __my_data: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
            },
          },
        },
      },
      target: '',
      schemas: [
        { name: '_MyData', schema: { $ref: '#/components/schemas/__my_data' } },
      ],
    } satisfies Parameters<typeof generateZodSchemasInline>[0];

    const output = createOutputOptions();
    (output.override.zod as Record<string, unknown>).generateReusableSchemas =
      true;

    const result = generateZodSchemasInline(builder, output);

    expect(result).toContain('export const _MyData =');
    expect(result).not.toContain('__REF_');
  });

  const metaBuilder = () =>
    ({
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              description: 'A pet',
              deprecated: true,
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
      target: '',
      schemas: [{ name: 'Pet', schema: { $ref: '#/components/schemas/Pet' } }],
    }) satisfies Parameters<typeof generateZodSchemasInline>[0];

  it('attaches .meta({ id, description, deprecated }) on zod v4 when generateMeta is on', () => {
    const output = createOutputOptions();
    const zodOverride = output.override.zod as Record<string, unknown>;
    zodOverride.generateReusableSchemas = true;
    zodOverride.generateMeta = true;
    (output as { packageJson?: unknown }).packageJson = {
      dependencies: { zod: '4.0.0' },
    };

    const result = generateZodSchemasInline(metaBuilder(), output);

    expect(result).toContain(
      ".meta({ id: 'Pet', description: 'A pet', deprecated: true })",
    );
  });

  it('falls back to .describe() (no .meta) on zod v3 even when generateMeta is on', () => {
    const output = createOutputOptions();
    const zodOverride = output.override.zod as Record<string, unknown>;
    zodOverride.generateReusableSchemas = true;
    zodOverride.generateMeta = true;
    (output as { packageJson?: unknown }).packageJson = {
      dependencies: { zod: '3.23.0' },
    };

    const result = generateZodSchemasInline(metaBuilder(), output);

    expect(result).not.toContain('.meta(');
    expect(result).toContain(".describe('A pet')");
  });

  it('keeps the use-site .describe() chained AFTER .meta() on the named export (zod v4)', () => {
    // A `$ref` with a `description` sibling renders at the use site as
    // `<RefName>.describe('use site desc')`. The named export ends with
    // `.meta(...)` — so the full runtime form is `Pet.meta(...).describe(...)`,
    // which in zod v4 is exactly the documented pattern for "reference to Pet
    // with a context-specific description": `z.toJSONSchema` produces
    // `{ description: 'use site desc', $ref: '#/$defs/Pet' }` and the parent
    // schema stays valid at runtime. This test pins that arrangement so the
    // namedRef + emitMeta interaction can't silently regress.
    const builder = {
      spec: {
        components: {
          schemas: {
            Pet: {
              type: 'object',
              description: 'a pet',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
            Owner: {
              type: 'object',
              properties: {
                pet: {
                  $ref: '#/components/schemas/Pet',
                  description: 'the owner pet',
                },
              },
              required: ['pet'],
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
    const zodOverride = output.override.zod as Record<string, unknown>;
    zodOverride.generateReusableSchemas = true;
    zodOverride.generateMeta = true;
    (output as { packageJson?: unknown }).packageJson = {
      dependencies: { zod: '4.0.0' },
    };

    const result = generateZodSchemasInline(builder, output);

    // Pet's definition carries the meta...
    expect(result).toContain(".meta({ id: 'Pet', description: 'a pet' })");
    // ...and the property use site chains describe onto the named ref —
    // `Pet.describe(...)` (NOT a fresh `.meta()` reusing Pet's id, which would
    // collide in the global registry).
    // namedRef path emits `.describe(...)` with double quotes; main path with
    // single — tolerate either so this doesn't trip on a formatter swap.
    expect(result).toMatch(/"?pet"?:\s*Pet\.describe\(['"]the owner pet['"]\)/);
    // Owner's definition still gets its own meta (no description on Owner).
    expect(result).toMatch(/export const Owner\b/);
    expect(result).toContain(".meta({ id: 'Owner' })");
  });
});
