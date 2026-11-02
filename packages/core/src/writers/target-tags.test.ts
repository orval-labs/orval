import { describe, expect, it } from 'vite-plus/test';

import {
  createSplitModeBuilder,
  createSplitModeOperation,
  createSplitModeOutput,
} from '../test-utils/split-modes';
import { OutputClient, OutputMode, type WriteSpecBuilder } from '../types';
import { generateTargetForTags } from './target-tags';

// Regression: tag bucket keys come from the OpenAPI document, and `kebab` leaves
// `constructor` unchanged. Checking the accumulator with `in` found the inherited
// member, so generation failed on `[...Object.imports]`.
//
// Buckets are read back through a Map because `result.constructor` resolves to
// `Object.prototype.constructor`, not the index signature.

const builderWith = (
  operations: Record<string, ReturnType<typeof createSplitModeOperation>>,
): WriteSpecBuilder =>
  ({
    ...createSplitModeBuilder('petstore.ts'),
    operations,
  }) satisfies WriteSpecBuilder;

const bucketsOf = (result: Awaited<ReturnType<typeof generateTargetForTags>>) =>
  new Map(Object.entries(result));

const generate = async (
  operations: Record<string, ReturnType<typeof createSplitModeOperation>>,
) =>
  bucketsOf(
    await generateTargetForTags(
      builderWith(operations),
      createSplitModeOutput('petstore.ts', { mode: OutputMode.TAGS }),
    ),
  );

describe('generateTargetForTags — tags that collide with Object.prototype', () => {
  it('buckets an operation tagged `constructor`', async () => {
    const buckets = await generate({
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

  it('merges two operations that share the `constructor` tag', async () => {
    const buckets = await generate({
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

  it('still buckets ordinary tags', async () => {
    const buckets = await generate({
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

describe('generateTargetForTags: per-tag angular.provideIn (issue #4425)', () => {
  const generateProvideInByTag = async (mode: OutputMode) => {
    const provideInByTag = new Map<string, unknown>();
    const builder: WriteSpecBuilder = {
      ...builderWith({
        getPlans: createSplitModeOperation({
          tags: ['Public'],
          operationName: 'getPlans',
        }),
        listReports: createSplitModeOperation({
          tags: ['Admin Reports'],
          operationName: 'listReports',
        }),
        listUsers: createSplitModeOperation({
          tags: ['Users'],
          operationName: 'listUsers',
        }),
      }),
      header: async ({ tag, provideIn }) => {
        provideInByTag.set(tag ?? '', provideIn);
        return { implementation: '', implementationMock: '' };
      },
    };
    const output = createSplitModeOutput('petstore.ts', {
      mode,
      client: OutputClient.ANGULAR,
    });
    output.override.angular.provideIn = 'root';
    output.override.tags = {
      Public: {
        angular: { ...output.override.angular, provideIn: false },
      },
      'Admin Reports': {
        angular: { ...output.override.angular, provideIn: 'any' },
      },
    };

    await generateTargetForTags(builder, output);
    return provideInByTag;
  };

  it.each([OutputMode.TAGS, OutputMode.TAGS_SPLIT])(
    'uses the tag-level value for the service class in %s mode',
    async (mode) => {
      const provideInByTag = await generateProvideInByTag(mode);

      expect(provideInByTag.get('public')).toBe(false);
      expect(provideInByTag.get('admin-reports')).toBe('any');
      expect(provideInByTag.get('users')).toBe('root');
    },
  );
});
