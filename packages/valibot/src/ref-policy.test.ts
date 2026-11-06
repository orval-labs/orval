import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { dereference } from './dereference';
import { parseBodyAndResponse } from './operation';
import {
  createRefPolicy,
  getComponentModes,
  mayCheckNothing,
} from './ref-policy';

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

type Schemas = Record<string, OpenApiSchemaObject>;

const DEPTH = 40;

// Each level holds the next one twice, so walking every path doubles at every
// level while the document only grows by one component.
const ladder = (
  key: 'allOf' | 'oneOf',
  last: OpenApiSchemaObject,
  depth = DEPTH,
): Schemas =>
  Object.fromEntries(
    Array.from({ length: depth }, (_, level) => [
      `L${level}`,
      level === depth - 1
        ? last
        : { [key]: [ref(`L${level + 1}`), ref(`L${level + 1}`)] },
    ]),
  );

const contextOf = (schemas: Schemas, useDates = false) =>
  createTestContextSpec({
    spec: { components: { schemas } },
    output: {
      override: { useDates, valibot: { generateReusableSchemas: true } },
    },
  });

const generate = (
  schemas: Schemas,
  body: OpenApiSchemaObject,
  useDates = false,
) =>
  parseBodyAndResponse({
    data: { content: { 'application/json': { schema: body } } },
    context: contextOf(schemas, useDates),
    strict: false,
    exactOptional: false,
    generate: true,
    isRequest: true,
  });

const TIME_LIMIT_MS = 5000;

const timed = (run: () => void) => {
  const start = performance.now();
  run();
  expect(performance.now() - start).toBeLessThan(TIME_LIMIT_MS);
};

describe('queries over deeply shared components', () => {
  it('finds a schema that checks nothing', () => {
    const context = contextOf(ladder('allOf', {}));
    timed(() => expect(mayCheckNothing(ref('L0'), context)).toBe(true));
  });

  it('finds that a schema checks something', () => {
    const context = contextOf(
      ladder('allOf', {
        type: 'object',
        properties: { a: { type: 'string' } },
      }),
    );
    timed(() => expect(mayCheckNothing(ref('L0'), context)).toBe(false));
  });

  it('walks a ladder that closes a cycle', () => {
    const schemas = ladder('allOf', ref('L0'));
    const context = contextOf(schemas);
    timed(() => expect(mayCheckNothing(ref('L0'), context)).toBe(true));
  });

  it('generates a body over a ladder that closes a cycle', () => {
    // Shallow enough for the inlined result to stay within its size budget.
    const schemas = ladder('allOf', ref('L0'), 12);
    timed(() => generate(schemas, ref('L0')));
  });

  it('gives a cyclic component the same answer whichever is asked first', () => {
    const schemas: Schemas = {
      A: { allOf: [ref('B')] },
      B: { allOf: [ref('A'), { type: 'object', properties: { x: {} } }] },
      C: { allOf: [ref('A'), ref('C')] },
    };
    const alone = (name: string) =>
      mayCheckNothing(ref(name), contextOf(schemas));
    const afterOthers = (name: string) => {
      const context = contextOf(schemas);
      for (const other of ['A', 'B', 'C']) mayCheckNothing(ref(other), context);
      return mayCheckNothing(ref(name), context);
    };
    for (const name of ['A', 'B', 'C']) {
      expect(afterOthers(name)).toBe(alone(name));
    }
  });

  it('walks a ladder of alternatives for null of a ladder', () => {
    const schemas = ladder('oneOf', { type: 'string' });
    const body: OpenApiSchemaObject = {
      type: 'object',
      properties: { d: { type: 'boolean' } },
      oneOf: [ref('L0')],
    };
    timed(() => generate(schemas, body));
  });

  it('walks a ladder of intersections for dates of a ladder', () => {
    const schemas = ladder('allOf', { type: 'string' });
    const body: OpenApiSchemaObject = {
      allOf: [ref('L0'), { type: 'string', minLength: 1 }],
    };
    timed(() => generate(schemas, body, true));
  });
});

// Each level holds the next one three times, two of them with annotations,
// or with a sibling that changes nothing the queries read.
const annotatedLadder = (
  member: (next: string) => OpenApiSchemaObject,
  last: OpenApiSchemaObject,
  depth = DEPTH,
): Schemas =>
  Object.fromEntries(
    Array.from({ length: depth }, (_, level) => [
      `N${level}`,
      level === depth - 1
        ? last
        : {
            allOf: [
              member(`N${level + 1}`),
              member(`N${level + 1}`),
              {
                type: 'object',
                properties: { [`p${level}`]: { type: 'string' } },
              },
            ],
          },
    ]),
  );

describe('queries over shared components with annotated references', () => {
  const annotated = (next: string, description: string) => ({
    ...ref(next),
    description,
  });

  it('generates a body over annotated references', () => {
    const schemas = annotatedLadder((next) => annotated(next, 'a'), {
      type: 'object',
      properties: { leaf: { type: 'string' } },
    });
    timed(() => generate(schemas, ref('N0')));
  });

  it('generates a request body that requires a key nothing declares', () => {
    const schemas = annotatedLadder((next) => annotated(next, 'a'), {
      type: 'object',
      properties: { leaf: { type: 'string' } },
    });
    timed(() => generate(schemas, { allOf: [ref('N0')], required: ['zzz'] }));
  });

  it('walks annotated references for null and dates', () => {
    const schemas = annotatedLadder((next) => annotated(next, 'a'), {
      type: 'object',
      properties: { leaf: { type: 'string' } },
    });
    const body: OpenApiSchemaObject = {
      type: 'object',
      properties: { d: { type: 'boolean' } },
      oneOf: [ref('N0')],
    };
    timed(() => generate(schemas, body, true));
  });

  it('finds that references with siblings check nothing', () => {
    const schemas: Schemas = Object.fromEntries(
      Array.from({ length: DEPTH }, (_, level) => [
        `M${level}`,
        level === DEPTH - 1
          ? {}
          : {
              allOf: [
                { ...ref(`M${level + 1}`), nullable: true },
                { ...ref(`M${level + 1}`), nullable: true },
              ],
            },
      ]),
    );
    timed(() =>
      expect(mayCheckNothing(ref('M0'), contextOf(schemas))).toBe(true),
    );
  });

  it('finds structure behind references with siblings', () => {
    const schemas: Schemas = Object.fromEntries(
      Array.from({ length: DEPTH }, (_, level) => [
        `M${level}`,
        level === DEPTH - 1
          ? { type: 'object', properties: { a: { type: 'string' } } }
          : {
              allOf: [
                { ...ref(`M${level + 1}`), nullable: true },
                { ...ref(`M${level + 1}`), nullable: true },
              ],
            },
      ]),
    );
    timed(() =>
      expect(mayCheckNothing(ref('M0'), contextOf(schemas))).toBe(false),
    );
  });
});

describe('compositions with many members', () => {
  const MEMBERS = 8000;

  // Each member declares a key of its own, so every one is a sibling of all
  // the others.
  const members = (): Schemas =>
    Object.fromEntries(
      Array.from({ length: MEMBERS }, (_, index) => [
        `M${index}`,
        {
          type: 'object',
          properties: { kind: { type: 'string' }, [`f${index}`]: {} },
          required: ['kind'],
        } satisfies OpenApiSchemaObject,
      ]),
    );

  const wide = (key: 'allOf' | 'oneOf'): OpenApiSchemaObject => ({
    [key]: Array.from({ length: MEMBERS }, (_, index) => ref(`M${index}`)),
  });

  it('generates an allOf of many members', () => {
    timed(() => generate(members(), wide('allOf')));
  });

  it('generates a oneOf of many members', () => {
    timed(() => generate(members(), wide('oneOf')));
  });
});

describe('component facts of one spec read by several outputs', () => {
  const base = contextOf({ Day: { type: 'string', format: 'date-time' } });
  const body: OpenApiSchemaObject = {
    allOf: [ref('Day'), { type: 'string', maxLength: 40 }],
  };
  // Both contexts hold the same spec object.
  const keepsRef = (useDates: boolean): boolean => {
    const context = {
      ...base,
      output: {
        ...base.output,
        override: { ...base.output.override, useDates },
      },
    };
    const policy = createRefPolicy({ context, ...getComponentModes(context) });
    const expanded = dereference(body, context, policy);
    return JSON.stringify(expanded).includes('$ref');
  };

  it('inlines a date in an intersection once useDates is on', () => {
    expect(keepsRef(false)).toBe(true);
    expect(keepsRef(true)).toBe(false);
  });
});
