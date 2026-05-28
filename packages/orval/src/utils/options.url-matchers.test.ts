import { describe, expect, it } from 'vitest';

import { normalizeOptions } from './options';

describe('normalizeOptions urlMatchers', () => {
  it('defaults urlMatchers when enabled with a boolean', async () => {
    const options = await normalizeOptions({
      input: { target: './spec.yaml' },
      output: {
        target: './endpoints.ts',
        urlMatchers: true,
      },
    });

    expect(options.output.urlMatchers).toEqual({
      fileExtension: '.apis.ts',
      prefixCapture: '(.*)',
      defaultParamPattern: String.raw`[A-Za-z0-9_\-.]+`,
      exportSuffix: 'Api',
      querySuffix: 'auto',
    });
  });

  it('merges custom urlMatchers options', async () => {
    const options = await normalizeOptions({
      input: { target: './spec.yaml' },
      output: {
        target: './endpoints.ts',
        urlMatchers: {
          exportSuffix: 'Intercept',
          querySuffix: 'never',
        },
      },
    });

    expect(options.output.urlMatchers).toEqual({
      fileExtension: '.apis.ts',
      prefixCapture: '(.*)',
      defaultParamPattern: String.raw`[A-Za-z0-9_\-.]+`,
      exportSuffix: 'Intercept',
      querySuffix: 'never',
    });
  });

  it('leaves urlMatchers undefined when omitted', async () => {
    const options = await normalizeOptions({
      input: { target: './spec.yaml' },
      output: {
        target: './endpoints.ts',
      },
    });

    expect(options.output.urlMatchers).toBeUndefined();
  });
});
