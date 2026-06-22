import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { OpenApiDocument } from '@orval/core';
import fs from 'fs-extra';
import { describe, expect, it } from 'vitest';

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils';

const PETSTORE_SPEC: OpenApiDocument = {
  openapi: '3.1.0',
  info: { title: 'Petstore', version: '1.0.0' },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        responses: {
          '200': {
            description: 'A list of pets',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/Pet' },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
        },
      },
    },
  },
};

const createTempWorkspace = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'orval-gen-spec-'));
};

describe('generateSpec - schemas: false', () => {
  it('does not generate separate schema files when schemas is false', async () => {
    const workspace = await createTempWorkspace();
    const schemasDir = path.join(workspace, 'model');
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            client: 'zod',
            schemas: false,
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      // schemas: false should prevent the schemas directory from being created
      expect(await fs.pathExists(schemasDir)).toBe(false);

      // The target file should still be generated
      expect(await fs.pathExists(targetFile)).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('generates separate schema files when schemas is a path', async () => {
    const workspace = await createTempWorkspace();
    const schemasDir = path.join(workspace, 'model');
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            client: 'zod',
            schemas: './model',
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      // schemas: './model' should create the schemas directory with files
      expect(await fs.pathExists(schemasDir)).toBe(true);
      const schemaFiles = await fs.readdir(schemasDir);
      expect(schemaFiles.length).toBeGreaterThan(0);

      // The target file should also be generated
      expect(await fs.pathExists(targetFile)).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - generateReusableSchemas inline (single mode)', () => {
  // Regression for #3463 follow-up: with `client: 'zod'` +
  // `generateReusableSchemas` + operations + no `schemas:` dir, operations
  // reference component schemas by name, so the component definitions must be
  // emitted inline in the same single file (previously they were skipped
  // because operations were present, leaving dangling references).
  it('emits referenced component schemas inline alongside operations', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // The component schema referenced by the operation is defined inline
      // (PascalCase identifier, consistent with operation wrappers)...
      expect(content).toContain('export const Pet = zod.object(');
      // ...and an operation schema references it by name.
      expect(content).toMatch(/\bPet\b/);
      // The inline definition must come before the operation exports that use
      // it (anchor on the operation name section, derived from operationId).
      expect(content.indexOf('export const Pet =')).toBeLessThan(
        content.indexOf('export const ListPets'),
      );
      // Exactly one zod import — the inline schemas must not redeclare `zod`
      // on top of the zod client's `import * as zod from 'zod'`.
      expect(content.match(/from 'zod'/g) ?? []).toHaveLength(1);
      // No unresolved sentinels.
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - generateReusableSchemas inline + override.zod.params', () => {
  // Regression: with `client: 'zod'` + `generateReusableSchemas: true` and no
  // `output.schemas` dir, the inline-reusable writer emits component schemas
  // into the operation file (single mode) or an adjacent `.schemas` file
  // (split/tags). `override.zod.params` must be threaded through that path so
  // the named `export const Pet = …` definitions get `zodParams(…)` injection
  // — previously only the operation wrappers in `generateZodRoute` did,
  // leaving the shared definitions uninjected.
  it('injects zodParams on inline component schemas in single mode', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');
    const mutatorFile = path.join(workspace, 'zod-params.ts');

    try {
      await fs.writeFile(
        mutatorFile,
        'export const zodParams = (_ctx: unknown) => ({});\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: {
              zod: {
                generateReusableSchemas: true,
                params: { path: './zod-params.ts', name: 'zodParams' },
              },
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // Inline component schema is injected with location: 'schema' and the
      // component's name (not an operation's) — that's the whole point of
      // wiring this through the reusable path.
      expect(content).toContain('export const Pet = zod.object(');
      expect(content).toMatch(
        /zodParams\(\{"operationId":"","location":"schema","schemaName":"Pet","fieldPath":\["name"\],"validator":"string"\}\)/,
      );
      // Exactly one zodParams import in single mode: the operation file
      // builder already emits one via each verb's mutators array, and the
      // inline schemas live in the same file — emitting a second `import
      // { zodParams }` line would be a duplicate.
      expect(
        content.match(/import \{ zodParams \} from ['"]\.\/zod-params['"]/g) ??
          [],
      ).toHaveLength(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // Split mode writes the inline schemas to a separate `<name>.schemas.ts`
  // file with no other imports, so the params-mutator import has to be
  // emitted from the inline writer itself — the outer operation file builder
  // can't reach across files.
  it('emits the zodParams import in the split-mode schemas file', async () => {
    const workspace = await createTempWorkspace();
    const schemasFile = path.join(workspace, 'zod.schemas.ts');
    const targetFile = path.join(workspace, 'zod.ts');
    const mutatorFile = path.join(workspace, 'zod-params.ts');

    try {
      await fs.writeFile(
        mutatorFile,
        'export const zodParams = (_ctx: unknown) => ({});\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './zod.ts',
            mode: 'split',
            client: 'zod',
            override: {
              zod: {
                generateReusableSchemas: true,
                params: { path: './zod-params.ts', name: 'zodParams' },
              },
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const schemasContent = await fs.readFile(schemasFile, 'utf8');
      const targetContent = await fs.readFile(targetFile, 'utf8');

      // Injection lands in the schemas file...
      expect(schemasContent).toContain('export const Pet = zod.object(');
      expect(schemasContent).toMatch(
        /zodParams\(\{"operationId":"","location":"schema","schemaName":"Pet","fieldPath":\["name"\],"validator":"string"\}\)/,
      );
      // ...with its own import (the operation file's import doesn't reach
      // here — different file).
      expect(schemasContent).toMatch(
        /import \{ zodParams \} from ['"]\.\/zod-params['"]/,
      );
      // The operation file still imports zodParams independently (used by
      // operation wrappers via `generateZodRoute`'s mutators array).
      expect(targetContent).toMatch(
        /import \{ zodParams \} from ['"]\.\/zod-params['"]/,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // `tags` mode looks like `single` but isn't: per-tag operation files live
  // alongside a separate `<name>.schemas.ts` file. The schemas file has no
  // other imports either, so — same as `split` — it has to emit the params
  // import from inside the inline writer. Pinning this so the case can't
  // silently regress to "no import → `zodParams` undefined at runtime".
  const TAGGED_SPEC: OpenApiDocument = {
    ...PETSTORE_SPEC,
    paths: {
      '/pets': {
        get: {
          ...PETSTORE_SPEC.paths?.['/pets']?.get,
          tags: ['pets'],
        },
      },
    },
  };

  it('emits the zodParams import in the tags-mode schemas file', async () => {
    const workspace = await createTempWorkspace();
    const schemasFile = path.join(workspace, 'zod.schemas.ts');
    const mutatorFile = path.join(workspace, 'zod-params.ts');

    try {
      await fs.writeFile(
        mutatorFile,
        'export const zodParams = (_ctx: unknown) => ({});\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: TAGGED_SPEC },
          output: {
            target: './zod.ts',
            mode: 'tags',
            client: 'zod',
            override: {
              zod: {
                generateReusableSchemas: true,
                params: { path: './zod-params.ts', name: 'zodParams' },
              },
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const schemasContent = await fs.readFile(schemasFile, 'utf8');

      expect(schemasContent).toContain('export const Pet = zod.object(');
      expect(schemasContent).toMatch(
        /zodParams\(\{"operationId":"","location":"schema","schemaName":"Pet","fieldPath":\["name"\],"validator":"string"\}\)/,
      );
      expect(schemasContent).toMatch(
        /import \{ zodParams \} from ['"]\.\/zod-params['"]/,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('emits the zodParams import in the tags-split schemas file', async () => {
    const workspace = await createTempWorkspace();
    // In tags-split, operation files nest under `<dirname>/<tag>/<tag>.ts`
    // but the inline schemas file stays at the root next to `zod-params.ts`.
    const schemasFile = path.join(workspace, 'zod.schemas.ts');
    const mutatorFile = path.join(workspace, 'zod-params.ts');

    try {
      await fs.writeFile(
        mutatorFile,
        'export const zodParams = (_ctx: unknown) => ({});\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: TAGGED_SPEC },
          output: {
            target: './zod.ts',
            mode: 'tags-split',
            client: 'zod',
            override: {
              zod: {
                generateReusableSchemas: true,
                params: { path: './zod-params.ts', name: 'zodParams' },
              },
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const schemasContent = await fs.readFile(schemasFile, 'utf8');

      expect(schemasContent).toContain('export const Pet = zod.object(');
      expect(schemasContent).toMatch(
        /zodParams\(\{"operationId":"","location":"schema","schemaName":"Pet","fieldPath":\["name"\],"validator":"string"\}\)/,
      );
      expect(schemasContent).toMatch(
        /import \{ zodParams \} from ['"]\.\/zod-params['"]/,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - generateReusableSchemas recursive ($ref to self)', () => {
  // Regression: a self-referential component schema is emitted as a single
  // reusable `const` whose initializer references itself through `zod.lazy`.
  // TypeScript rejects such a `const` under strict / noImplicitAny with TS7022
  // ("'X' implicitly has type 'any' ... referenced directly or indirectly in
  // its own initializer"). The writer fixes this by generating the recursive
  // TS type and pinning the schema to it: `const X: zod.ZodType<X>`. That both
  // satisfies the compiler and preserves full `z.infer` typing through the
  // recursion (rather than collapsing recursive positions to `unknown`).
  const RECURSIVE_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'Recursive', version: '1.0.0' },
    paths: {
      '/values': {
        get: {
          operationId: 'listValues',
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/JsonValue' },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        JsonValue: {
          anyOf: [
            {
              anyOf: [
                { type: 'string' },
                { type: 'number' },
                { type: 'boolean' },
              ],
            },
            {
              type: 'array',
              items: { $ref: '#/components/schemas/JsonValue' },
            },
            {
              type: 'object',
              additionalProperties: { $ref: '#/components/schemas/JsonValue' },
            },
          ],
        },
      },
    },
  };

  it('pins the recursive schema to a generated TS type so it type-checks with full inference', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: RECURSIVE_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // A recursive TS type is generated for the schema. Asserted with a
      // whitespace-tolerant regex (union-bar spacing and index-signature brace
      // spacing are formatter-dependent) that still pins the structure: the
      // union of the four primitives plus the self-referential array and the
      // index signature whose value type is `JsonValue`.
      expect(content).toMatch(
        /export type JsonValue\s*=\s*string\s*\|\s*number\s*\|\s*boolean\s*\|\s*JsonValue\[\]\s*\|\s*\{\s*\[key:\s*string\]:\s*JsonValue\s*\}/,
      );
      // ...and the schema const is pinned to it (the fix for TS7022).
      expect(content).toContain(
        'export const JsonValue: zod.ZodType<JsonValue> = zod.union(',
      );
      // The self-reference is a plain lazy (the const annotation breaks the
      // self-inference cycle, so no callback annotation is needed).
      expect(content).toContain('zod.lazy(() => JsonValue)');
      // The recursive schema must NOT re-derive its type from itself via
      // `zod.input<typeof JsonValue>` — that alias would be circular.
      expect(content).not.toContain(
        'export type JsonValue = zod.input<typeof JsonValue>',
      );
      // No unresolved sentinels.
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // The split-mode writer merges `extraImports` (TS-body refs the zod runtime
  // collapses, e.g. a `propertyNames` $ref) into per-file imports. Inline
  // single-file mode resolves everything in the same file and discards
  // `extraImports`; a regression that started threading those names into the
  // inline output as bogus `from './X'` lines wouldn't be caught by the
  // split-mode test alone.
  const RECURSIVE_PROPERTY_NAMES_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'RecursivePropertyNames', version: '1.0.0' },
    paths: {
      '/trees': {
        get: {
          operationId: 'listTrees',
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Tree' },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Tree: {
          type: 'object',
          properties: {
            children: {
              type: 'object',
              propertyNames: { $ref: '#/components/schemas/RelationType' },
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
  };

  it('emits no sibling imports in single mode even when the recursive TS body references another component', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: RECURSIVE_PROPERTY_NAMES_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // Both component schemas are emitted inline...
      expect(content).toContain(
        'export const Tree: zod.ZodType<Tree> = zod.object(',
      );
      expect(content).toContain('export const RelationType = zod.enum(');
      // ...and the recursive type references the inline RelationType through
      // the `Record<>` key.
      expect(content).toMatch(/Record<\s*RelationType/);
      // No sibling imports leaked through `extraImports`: every component
      // (including `RelationType`) lives in this same file.
      expect(content).not.toMatch(/from '\.\/RelationType'/);
      expect(content).not.toMatch(/from '\.\/Tree'/);
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - generateReusableSchemas inline (pure-$ref operations)', () => {
  // Regression: the zod client's `import * as zod from 'zod'` is usage-gated on
  // the operations implementation. When every operation is a pure-`$ref` alias
  // (`export const GetThingResponse = Thing`), the client emits NO zod import,
  // so the inline schema block (which always uses zod) must supply it — else the
  // generated file references `zod` with no import and fails to compile.
  const PURE_REF_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'PureRef', version: '1.0.0' },
    paths: {
      '/thing': {
        get: {
          operationId: 'getThing',
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Thing' },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Thing: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
  };

  it('emits the zod import when no operation references zod directly', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PURE_REF_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // The component schema is defined inline...
      expect(content).toContain('export const Thing = zod.object(');
      // ...the operation wrapper is a pure-$ref alias (no `zod.` usage)...
      expect(content).toContain('export const GetThingResponse = Thing');
      // ...and exactly one zod import is present (the bug emitted zero).
      // Match either quote style so the assertion survives generator quote
      // changes while still asserting a single `zod` module import.
      expect(content.match(/from ['"]zod['"]/g) ?? []).toHaveLength(1);
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - generateReusableSchemas wrapper/import name collision (#3478)', () => {
  // component schema name, the operation wrapper used to be emitted with the
  // same identifier as the import:
  //
  //   import { ListPetsResponse } from "./schemas";
  //   export const ListPetsResponseItem = ListPetsResponse;     // TDZ self-ref
  //   export const ListPetsResponse = zod.array(...);            // shadows import
  //
  // TypeScript rejects this with TS7022. The fix appends a `Schema` suffix to
  // the wrapper (and its `Item` companion) when the chosen name would collide
  // with an imported ref, leaving the import's meaning intact.
  const COLLISION_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'Collision', version: '1.0.0' },
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/ListPetsResponse' },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ListPetsResponse: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
          },
        },
      },
    },
  };

  it('renames the operation wrapper to avoid shadowing the imported component schema', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: COLLISION_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // The component schema retains its name.
      expect(content).toContain('export const ListPetsResponse = zod.object(');
      // The operation wrapper is renamed with a `Schema` suffix so the array
      // initializer references the imported (`ListPetsResponse`) component
      // instead of itself.
      expect(content).toContain(
        'export const ListPetsResponseSchemaItem = ListPetsResponse',
      );
      expect(content).toContain(
        'export const ListPetsResponseSchema = zod.array(ListPetsResponseSchemaItem)',
      );
      // Crucially, the pre-fix bug pattern (the operation wrapper redeclaring
      // the imported name) must NOT appear.
      expect(content).not.toMatch(
        /export const ListPetsResponse = zod\.array\(/,
      );
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // When the base name AND its `Schema`-suffixed companion both already exist
  // as imported components, the allocator's counter branch (`Schema1`) must
  // fire. The above test only exercises the single-suffix path; nothing here
  // would catch a regression that broke the `while (collides(candidate))`
  // loop.
  const DOUBLE_COLLISION_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'DoubleCollision', version: '1.0.0' },
    paths: {
      '/pets': {
        get: {
          operationId: 'listPets',
          responses: {
            '200': {
              description: 'ok',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['first', 'second'],
                    properties: {
                      first: { $ref: '#/components/schemas/ListPetsResponse' },
                      second: {
                        $ref: '#/components/schemas/ListPetsResponseSchema',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        ListPetsResponse: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } },
        },
        ListPetsResponseSchema: {
          type: 'object',
          required: ['name'],
          properties: { name: { type: 'string' } },
        },
      },
    },
  };

  it('falls through to the numeric-counter suffix when both base and `Schema` collide', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'zod.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: DOUBLE_COLLISION_SPEC },
          output: {
            target: './zod.ts',
            mode: 'single',
            client: 'zod',
            override: { zod: { generateReusableSchemas: true } },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');

      // Both component schemas keep their names.
      expect(content).toContain('export const ListPetsResponse = zod.object(');
      expect(content).toContain(
        'export const ListPetsResponseSchema = zod.object(',
      );
      // The operation wrapper picks `Schema1` because `Schema` is already
      // taken by a component import.
      expect(content).toMatch(
        /export const ListPetsResponseSchema1 = zod\.object\(/,
      );
      // Neither component declaration is shadowed by an operation wrapper.
      expect(
        content.match(/export const ListPetsResponse = /g) ?? [],
      ).toHaveLength(1);
      expect(
        content.match(/export const ListPetsResponseSchema = /g) ?? [],
      ).toHaveLength(1);
      expect(content).not.toContain('__REF_');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - useNamedParameters + zod schema output', () => {
  // The fetch client references a named `${Op}PathParameters` type in its
  // signatures. In zod schema mode that type must be emitted as a zod schema
  // (with a companion `zod.input` type) instead of being dropped — otherwise
  // the import resolves to nothing and the output fails to compile.
  const PATH_PARAM_SPEC: OpenApiDocument = {
    openapi: '3.1.0',
    info: { title: 'Petstore', version: '1.0.0' },
    paths: {
      '/pets/{petId}': {
        get: {
          operationId: 'showPetById',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: { '200': { description: 'A pet' } },
        },
      },
    },
  };

  it('emits a `${Op}PathParameters` zod schema with companion input type', async () => {
    const workspace = await createTempWorkspace();

    try {
      const options = await normalizeOptions(
        {
          input: { target: PATH_PARAM_SPEC },
          output: {
            target: './endpoints.ts',
            client: 'fetch',
            schemas: { path: './model', type: 'zod' },
            override: { useNamedParameters: true },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const schema = await fs.readFile(
        path.join(workspace, 'model', 'showPetByIdPathParameters.zod.ts'),
        'utf8',
      );
      // Emitted as a zod object plus a companion `zod.input` type the client
      // can reference as a type (rather than being dropped).
      expect(schema).toContain(
        'export const ShowPetByIdPathParameters = zod.object(',
      );
      expect(schema).toContain(
        'export type ShowPetByIdPathParameters = zod.input<typeof ShowPetByIdPathParameters>;',
      );

      // The endpoints file consumes the named type in its signature.
      const endpoints = await fs.readFile(
        path.join(workspace, 'endpoints.ts'),
        'utf8',
      );
      expect(endpoints).toMatch(/:\s*ShowPetByIdPathParameters/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});

describe('generateSpec - schemas.importPath', () => {
  it('uses package import specifier in generated endpoint imports (single mode)', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            mode: 'single',
            schemas: {
              path: './model',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');
      expect(content).toMatch(/from\s+'@acme\/models'/);
      expect(content).not.toMatch(/from\s+'\.\./);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('uses package import specifier in generated endpoint imports (tags mode)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            mode: 'tags',
            schemas: {
              path: './model',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const files = await fs.readdir(workspace);
      const tagFileName = files.find(
        (f) => f.endsWith('.ts') && f !== 'endpoints.ts',
      );
      expect(tagFileName).toBeTruthy();
      const content = await fs.readFile(
        path.join(workspace, tagFileName ?? ''),
        'utf8',
      );
      expect(content).toMatch(/from\s+'@acme\/models'/);
      expect(content).not.toMatch(/from\s+'\.\./);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('uses package import specifier in generated endpoint imports (tags-split mode)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            mode: 'tags-split',
            schemas: {
              path: './model',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const entries = await fs.readdir(workspace, { recursive: true });
      const tsFile = entries.find(
        (e) => String(e).endsWith('.ts') && !String(e).includes('model'),
      );
      expect(tsFile).toBeTruthy();
      const tagFile = path.join(workspace, String(tsFile));
      const content = await fs.readFile(tagFile, 'utf8');
      expect(content).toMatch(/from\s+'@acme\/models'/);
      expect(content).not.toMatch(/from\s+'\.\./);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('uses package import specifier in generated endpoint imports (split mode)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            mode: 'split',
            schemas: {
              path: './model',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(
        path.join(workspace, 'endpoints.ts'),
        'utf8',
      );
      expect(content).toMatch(/from\s+'@acme\/models'/);
      expect(content).not.toMatch(/from\s+'\.\./);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('uses package import specifier with indexFiles (single mode)', async () => {
    const workspace = await createTempWorkspace();
    const targetFile = path.join(workspace, 'endpoints.ts');

    try {
      const options = await normalizeOptions(
        {
          input: { target: PETSTORE_SPEC },
          output: {
            target: './endpoints.ts',
            mode: 'single',
            indexFiles: true,
            schemas: {
              path: './model',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      await generateSpec(workspace, options);

      const content = await fs.readFile(targetFile, 'utf8');
      expect(content).toMatch(/from\s+'@acme\/models'/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
