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
