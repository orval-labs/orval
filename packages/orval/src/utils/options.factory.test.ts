import { describe, expect, it } from 'vitest';

import { normalizeOptions } from './options';

describe('normalizeOptions factoryMethods', () => {
  const baseInput = { target: 'petstore.yaml' };

  it('should use defaults when factoryMethods is an empty object', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: {},
      },
    });

    expect(options.output.factoryMethods).toEqual({
      functionNamePrefix: 'create',
      mode: 'split',
      includeOptionalProperty: true,
      outputDirectory: process.cwd(),
    });
  });

  it('should override specific properties', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: {
          functionNamePrefix: 'build',
          mode: 'single',
          includeOptionalProperty: false,
        },
      },
    });

    expect(options.output.factoryMethods).toEqual({
      functionNamePrefix: 'build',
      mode: 'single',
      includeOptionalProperty: false,
      outputDirectory: process.cwd(),
    });
  });

  it('should use default values when properties are omitted', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: {
          functionNamePrefix: 'make',
        },
      },
    });

    expect(options.output.factoryMethods).toEqual({
      functionNamePrefix: 'make',
      mode: 'split',
      includeOptionalProperty: true,
      outputDirectory: process.cwd(),
    });
  });

  it('should default to undefined if factoryMethods is not provided', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
      },
    });

    expect(options.output.factoryMethods).toBeUndefined();
  });
});
