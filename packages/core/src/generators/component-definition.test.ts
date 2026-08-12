import { describe, expect, it } from 'vitest';

import type { ContextSpec } from '../types';
import { generateComponentDefinition } from './component-definition';

const context = {
  output: { override: { namingConvention: {} } },
  target: 'typescript',
  spec: {},
} as unknown as ContextSpec;

describe('generateComponentDefinition', () => {
  it('sanitizes inline schemas from numeric response components', () => {
    const result = generateComponentDefinition(
      {
        401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
      context,
      'Response',
    );

    expect(result).toHaveLength(1);
    expect(result).toMatchObject([{ name: 'N401Response' }]);
    expect(result[0]?.model).toContain('export type N401Response');
  });
});
