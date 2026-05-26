import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import { generateComponentDefinition } from './component-definition';

const context = createTestContextSpec({
  target: 'typescript',
});

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

  it('preserves leading underscore in response components like _401', () => {
    const result = generateComponentDefinition(
      {
        _401: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
      context,
      'Response',
    );

    expect(result).toHaveLength(1);
    expect(result).toMatchObject([{ name: '_401Response' }]);
    expect(result[0]?.model).toContain('export type _401Response');
  });
});
