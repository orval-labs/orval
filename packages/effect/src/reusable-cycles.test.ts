import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { generateEffectComponents } from './reusable-schemas';
import { declaredTypeErrors, ref, type Schemas } from './test-helpers';

const components = (schemas: Schemas) =>
  generateEffectComponents(
    createTestContextSpec({
      spec: { components: { schemas } },
      output: {
        override: { effect: { version: 4, generateReusableSchemas: true } },
      },
    }),
    new Set(Object.keys(schemas)),
  );

// Each of `size` types reads the next ones, the last reading the first.
const strongComponent = (size: number, reads: number): Schemas =>
  Object.fromEntries(
    Array.from({ length: size }, (_, index) => [
      `T${index}`,
      {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          ...Object.fromEntries(
            Array.from({ length: reads }, (_read, offset) => [
              `r${offset}`,
              ref(`T${(index + offset + 1) % size}`),
            ]),
          ),
        },
      },
    ]),
  );

describe('constants on a long cycle', () => {
  it.each([
    ['a ring of 18 types', strongComponent(18, 1)],
    ['24 types that read 3 others each', strongComponent(24, 3)],
  ])('type checks %s', (_name, schemas) => {
    expect(declaredTypeErrors(components(schemas))).toEqual([]);
  });

  it('reads every reference to a constant on a cycle through S.suspend', () => {
    const text = components({
      Head: { type: 'object', properties: { tree: ref('Tree') } },
      Tree: {
        type: 'object',
        properties: { children: { type: 'array', items: ref('Tree') } },
      },
    });
    expect(text).toContain('S.suspend((): S.Codec<Tree, TreeEncoded> => Tree)');
    expect(text).not.toMatch(/"tree": S\.optional\(Tree\)/);
  });
});
