import { describe, expect, it } from 'vite-plus/test';

import {
  createSplitModeBuilder,
  createSplitModeOperation,
  createSplitModeOutput,
} from '../test-utils/split-modes';
import { OutputMode, type WriteSpecBuilder } from '../types';
import { generateTargetForTags } from './target-tags';

// Regression: tag bucket keys come from the OpenAPI document, and `kebab` leaves
// `constructor` unchanged. Checking the accumulator with `in` found the inherited
// member, so generation failed on `[...Object.imports]`.
//
// Buckets are read back through a Map because `result.constructor` resolves to
// `Object.prototype.constructor`, not the index signature.

const builderWith = (operations: Record<string, unknown>): WriteSpecBuilder =>
  ({
    ...createSplitModeBuilder('petstore.ts'),
    operations,
  }) as unknown as WriteSpecBuilder;

const bucketsOf = (result: ReturnType<typeof generateTargetForTags>) =>
  new Map(Object.entries(result));

const generate = (operations: Record<string, unknown>) =>
  bucketsOf(
    generateTargetForTags(
      builderWith(operations),
      createSplitModeOutput('petstore.ts', { mode: OutputMode.TAGS }),
    ),
  );

describe('generateTargetForTags — tags that collide with Object.prototype', () => {
  it('buckets an operation tagged `constructor`', () => {
    const buckets = generate({
      listPets: createSplitModeOperation({
        tags: ['constructor'],
        operationName: 'listPets',
        implementation: 'export const listPets = () => {};',
      }),
    });

    expect([...buckets.keys()]).toEqual(['constructor']);
    expect(buckets.get('constructor')?.implementation).toContain('listPets');
    expect(buckets.get('constructor')?.imports).toEqual([]);
  });

  it('merges two operations that share the `constructor` tag', () => {
    const buckets = generate({
      listPets: createSplitModeOperation({
        tags: ['Constructor'],
        operationName: 'listPets',
        implementation: 'export const listPets = () => {};',
      }),
      getPet: createSplitModeOperation({
        tags: ['constructor'],
        operationName: 'getPet',
        implementation: 'export const getPet = () => {};',
      }),
    });

    expect([...buckets.keys()]).toEqual(['constructor']);
    const implementation = buckets.get('constructor')?.implementation;
    expect(implementation).toContain('listPets');
    expect(implementation).toContain('getPet');
  });

  it('still buckets ordinary tags', () => {
    const buckets = generate({
      listPets: createSplitModeOperation({
        tags: ['pets'],
        operationName: 'listPets',
      }),
      getHealth: createSplitModeOperation({
        tags: ['health'],
        operationName: 'getHealth',
      }),
    });

    expect([...buckets.keys()].sort()).toEqual(['health', 'pets']);
  });
});
