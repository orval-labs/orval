import { describe, expect, it, vi } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils';
import { dereferenceWithPolicy, type SchemaWalkReporter } from './dereference';

const createReporter = (): SchemaWalkReporter => ({
  library: 'effect',
  warn: vi.fn(),
  verbose: vi.fn(),
});

const context = createTestContextSpec({
  spec: {
    openapi: '3.1.0',
    info: { title: 'test', version: '1' },
    paths: {},
    components: {
      schemas: {
        Node: {
          type: 'object',
          properties: { next: { $ref: '#/components/schemas/Node' } },
        },
        Pet: { type: 'object', properties: { name: { type: 'string' } } },
      },
    },
  },
});

describe('dereferenceWithPolicy', () => {
  it('reports a circular ref through the reporter', () => {
    const reporter = createReporter();
    dereferenceWithPolicy(
      { $ref: '#/components/schemas/Node' },
      context,
      undefined,
      { suggestReusable: false, reporter },
    );
    expect(reporter.warn).toHaveBeenCalledWith(
      'Circular $ref "#/components/schemas/Node" is validated as unknown.',
    );
  });

  it('names the library and its option in the node limit error', () => {
    expect(() =>
      dereferenceWithPolicy(
        { $ref: '#/components/schemas/Pet' },
        context,
        undefined,
        { limit: 1, suggestReusable: true, reporter: createReporter() },
      ),
    ).toThrow(
      /^\[orval\/effect\] .* Set override\.effect\.generateReusableSchemas to true/,
    );
  });
});
