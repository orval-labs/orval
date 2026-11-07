import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { dereference } from './dereference';
import { MAX_INLINE_NODES } from './inline-budget';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

// Each level references the next one twice, so inlining doubles at every level.
const exponentialSchemas = (
  depth: number,
): Record<string, OpenApiSchemaObject> =>
  Object.fromEntries(
    Array.from({ length: depth }, (_, level) => [
      `S${level}`,
      level === depth - 1
        ? { type: 'string' }
        : {
            type: 'object',
            properties: {
              left: ref(`S${level + 1}`),
              right: ref(`S${level + 1}`),
            },
          },
    ]),
  );

// Like `exponentialSchemas`, but each reference carries a sibling, so the
// expansion cannot be shared between the references.
const siblingSchemas = (depth: number): Record<string, OpenApiSchemaObject> =>
  Object.fromEntries(
    Array.from({ length: depth }, (_, level) => [
      `S${level}`,
      level === depth - 1
        ? { type: 'string' }
        : {
            type: 'object',
            properties: {
              left: { ...ref(`S${level + 1}`), description: 'left' },
              right: { ...ref(`S${level + 1}`), description: 'right' },
            },
          },
    ]),
  );

const contextOf = (
  schemas: Record<string, OpenApiSchemaObject>,
  generateReusableSchemas = false,
) =>
  createTestContextSpec({
    spec: { components: { schemas } },
    output: { override: { valibot: { generateReusableSchemas } } },
  });

describe('inline node budget', () => {
  it('stops an expansion that grows past the limit', () => {
    const context = contextOf(exponentialSchemas(40));
    expect(() =>
      dereference(ref('S0'), context, undefined, {
        label: 'getPet request body',
        limit: 1000,
      }),
    ).toThrow(
      'Inlining "#/components/schemas/S0" for getPet request body produced more than 1000 schema nodes. Set override.valibot.generateReusableSchemas to true to generate one schema per component instead.',
    );
  });

  it('fails fast instead of finishing the expansion', () => {
    const context = contextOf(exponentialSchemas(60));
    const start = performance.now();
    expect(() => dereference(ref('S0'), context)).toThrow(
      `more than ${MAX_INLINE_NODES} schema nodes`,
    );
    expect(performance.now() - start).toBeLessThan(10_000);
  });

  it('fails fast on references that are not shared between uses', () => {
    const context = contextOf(siblingSchemas(60));
    const start = performance.now();
    expect(() => dereference(ref('S0'), context)).toThrow(
      `more than ${MAX_INLINE_NODES} schema nodes`,
    );
    expect(performance.now() - start).toBeLessThan(10_000);
  });

  it('does not count the data of a schema as schema nodes', () => {
    const example = Array.from({ length: 2000 }, (_, index) => ({ index }));
    const context = contextOf({
      Shared: { type: 'string', example },
      Holder: {
        type: 'object',
        properties: Object.fromEntries(
          Array.from({ length: 150 }, (_, index) => [
            `p${index}`,
            ref('Shared'),
          ]),
        ),
      },
    });
    expect(() => dereference(ref('Holder'), context)).not.toThrow();
  });

  it('counts a property named like a keyword as a schema', () => {
    const properties: Record<string, OpenApiSchemaObject> = Object.fromEntries(
      ['example', 'enum', 'default', 'const'].map((name) => [
        name,
        { type: 'string' },
      ]),
    );
    const context = contextOf({ Holder: { type: 'object', properties } });
    expect(() =>
      dereference(ref('Holder'), context, undefined, { limit: 5 }),
    ).not.toThrow();
    expect(() =>
      dereference(ref('Holder'), context, undefined, { limit: 4 }),
    ).toThrow('more than 4 schema nodes');
  });

  it('inlines an expansion within the limit', () => {
    const context = contextOf(exponentialSchemas(5));
    const result = dereference(ref('S0'), context, undefined, { limit: 1000 });
    expect(JSON.stringify(result)).not.toContain('$ref');
  });

  it('limits the subgraphs a document that reuses schemas still inlines', () => {
    const context = contextOf(exponentialSchemas(40), true);
    expect(() =>
      dereference(ref('S0'), context, () => false, {
        label: 'getPet request body',
        limit: 1000,
      }),
    ).toThrow(
      'Inlining "#/components/schemas/S0" for getPet request body produced more than 1000 schema nodes.',
    );
  });

  it('does not suggest reusable schemas when they are already on', () => {
    const context = contextOf(exponentialSchemas(40), true);
    expect(() =>
      dereference(ref('S0'), context, () => false, { limit: 1000 }),
    ).not.toThrow('generateReusableSchemas');
  });

  it('does not spend on the schemas a document keeps as references', () => {
    const context = contextOf(exponentialSchemas(12), true);
    expect(() =>
      dereference(ref('S0'), context, () => true, { limit: 10 }),
    ).not.toThrow();
  });
});

describe('data keywords', () => {
  it('leaves enum and const values untouched', () => {
    const context = contextOf({ Pet: { type: 'string' } });
    const literal = { $ref: '#/components/schemas/Pet' };
    const schema: OpenApiSchemaObject = {
      type: 'object',
      enum: [literal],
      const: literal,
    };
    expect(dereference(schema, context)).toEqual(schema);
  });
});
