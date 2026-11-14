import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { dereference } from '.';
import { createTestContextSpec } from '../../core/src/test-utils';
import { createRefPolicy, createRootRefPolicy } from './ref-policy';
import { ref, type Schemas } from './test-helpers';

const plain: Schemas = {
  Pet: { type: 'object', properties: { id: { type: 'string' } } },
};

// Whether the reference to `Pet` survives in the schema the policy walks.
const keeps = (
  schema: OpenApiSchemaObject,
  schemas: Schemas = plain,
  { enabled = true, exactOptional = false, outputExactOptional = false } = {},
): boolean => {
  const context = createTestContextSpec({
    spec: { components: { schemas } },
    output: {
      override: {
        effect: {
          generateReusableSchemas: enabled,
          exactOptional: outputExactOptional,
        },
      },
    },
  });
  const policy = createRefPolicy({ context, exactOptional });
  return JSON.stringify(dereference(schema, context, policy)).includes(
    'schemas/Pet"',
  );
};

describe('ref policy', () => {
  it('is off without the flag', () => {
    const context = createTestContextSpec({
      spec: { components: { schemas: plain } },
    });
    expect(createRefPolicy({ context, exactOptional: false })).toBeUndefined();
  });

  it.each([
    ['a property', { type: 'object', properties: { pet: ref('Pet') } }],
    ['an array item', { type: 'array', items: ref('Pet') }],
    ['a record value', { type: 'object', additionalProperties: ref('Pet') }],
    ['a oneOf member', { oneOf: [ref('Pet'), { type: 'string' }] }],
    ['the root', ref('Pet')],
  ] satisfies [string, OpenApiSchemaObject][])('keeps %s', (_name, schema) => {
    expect(keeps(schema)).toBe(true);
  });

  it('inlines a member that is merged', () => {
    expect(keeps({ allOf: [ref('Pet'), { type: 'object' }] })).toBe(false);
    expect(
      keeps({ properties: { x: { type: 'string' } }, oneOf: [ref('Pet')] }),
    ).toBe(false);
    expect(keeps({ allOf: [ref('Pet')], oneOf: [ref('Pet')] })).toBe(false);
  });

  it('inlines a reference that closes an allOf cycle', () => {
    const schemas: Schemas = {
      Pet: { allOf: [ref('Pet'), { type: 'object' }] },
    };
    expect(keeps({ type: 'array', items: ref('Pet') }, schemas)).toBe(false);
  });

  it('inlines a reference that closes a cycle no schema guards', () => {
    const schemas: Schemas = {
      Pet: { oneOf: [ref('Other'), { type: 'string', minLength: 2 }] },
      Other: { oneOf: [ref('Pet'), { type: 'number', minimum: 1 }] },
    };
    expect(keeps({ type: 'array', items: ref('Pet') }, schemas)).toBe(false);
  });

  it('inlines an unknown component', () => {
    expect(keeps({ type: 'array', items: ref('Missing') })).toBe(false);
  });

  it('inlines an alias that carries siblings', () => {
    const schemas: Schemas = {
      Pet: { ...ref('Other'), minLength: 2 },
      Other: { type: 'string' },
    };
    expect(keeps({ type: 'array', items: ref('Pet') }, schemas)).toBe(false);
  });

  it('inlines a component with a default', () => {
    const schemas: Schemas = { Pet: { type: 'string', default: 'a' } };
    expect(keeps({ type: 'array', items: ref('Pet') }, schemas)).toBe(false);
  });

  it('inlines a component that checks nothing', () => {
    expect(keeps({ type: 'array', items: ref('Pet') }, { Pet: {} })).toBe(
      false,
    );
    expect(
      keeps({ type: 'array', items: ref('Pet') }, { Pet: { type: 'object' } }),
    ).toBe(false);
  });

  it('inlines a member that leaves a required key optional', () => {
    const schemas: Schemas = {
      Pet: { type: 'object', properties: { k: { type: 'string' } } },
    };
    expect(keeps({ required: ['k'], oneOf: [ref('Pet')] }, schemas)).toBe(
      false,
    );
  });

  it('inlines everything for a site that renders optional keys differently', () => {
    const schema = {
      type: 'array',
      items: ref('Pet'),
    } satisfies OpenApiSchemaObject;
    expect(keeps(schema, plain, { exactOptional: true })).toBe(false);
    expect(
      keeps(schema, plain, { exactOptional: true, outputExactOptional: true }),
    ).toBe(true);
  });
});

describe('root ref policy', () => {
  const context = createTestContextSpec({
    spec: { components: { schemas: plain } },
    output: { override: { effect: { generateReusableSchemas: true } } },
  });
  const policy = createRefPolicy({
    context,
    exactOptional: false,
    direction: 'readOnly',
  });
  const arrayRoot = { type: 'array', items: ref('Pet') };

  it('carries no direction, which the effect walk never reads', () => {
    expect(policy).not.toHaveProperty('direction');
    expect(createRootRefPolicy(policy, arrayRoot, context)).not.toHaveProperty(
      'direction',
    );
  });
});
