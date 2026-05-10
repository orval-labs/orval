import { describe, expect, it } from 'vitest';

import { normalizeOptions } from './options';

describe('normalizeOptions factoryMethods', () => {
  const baseInput = { target: 'petstore.yaml' };

  it('should use defaults when factoryMethods has generate: true', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: { generate: true },
      },
    });

    expect(options.output.factoryMethods).toEqual({
      generate: true,
      functionNamePrefix: 'create',
      mode: 'separate-file',
      optionalPropertyStrategy: 'include',
      outputDirectory: process.cwd(),
    });
  });

  it('should override specific properties', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: {
          generate: true,
          functionNamePrefix: 'build',
          mode: 'inline-with-schema',
          optionalPropertyStrategy: 'omit',
        },
      },
    });

    expect(options.output.factoryMethods).toEqual({
      generate: true,
      functionNamePrefix: 'build',
      mode: 'inline-with-schema',
      optionalPropertyStrategy: 'omit',
      outputDirectory: process.cwd(),
    });
  });

  it('should use default values when properties are omitted', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
        factoryMethods: {
          generate: true,
          functionNamePrefix: 'make',
        },
      },
    });

    expect(options.output.factoryMethods).toEqual({
      generate: true,
      functionNamePrefix: 'make',
      mode: 'separate-file',
      optionalPropertyStrategy: 'include',
      outputDirectory: process.cwd(),
    });
  });

  it('should default to generate: false if factoryMethods is not provided', async () => {
    const options = await normalizeOptions({
      input: baseInput,
      output: {
        target: 'api.ts',
      },
    });

    expect(options.output.factoryMethods).toEqual({
      generate: false,
      functionNamePrefix: 'create',
      mode: 'separate-file',
      optionalPropertyStrategy: 'include',
      outputDirectory: process.cwd(),
    });
  });
});
