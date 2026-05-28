import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  GeneratorVerbOptions,
  NormalizedOutputOptions,
} from '../types';
import { OutputMode } from '../types';
import {
  buildUrlMatcherRegexLiteral,
  buildUrlMatcherRegexPattern,
  generateUrlMatcherExtraFiles,
  getUrlMatcherExportName,
} from './url-matchers';

const defaultMatcherOptions = {
  fileExtension: '.apis.ts',
  prefixCapture: '(.*)',
  defaultParamPattern: '[A-Za-z0-9_\\-.]+',
  exportSuffix: 'Api',
  querySuffix: 'auto' as const,
};

describe('buildUrlMatcherRegexPattern', () => {
  it('escapes static segments and replaces path params with capture groups', () => {
    expect(
      buildUrlMatcherRegexPattern(
        '/tenants/{tenantId}/maildomains/{domainId}',
        defaultMatcherOptions,
        false,
      ),
    ).toBe('(.*)/tenants/([A-Za-z0-9_\\-.]+)/maildomains/([A-Za-z0-9_\\-.]+)$');
  });

  it('appends optional query suffix when querySuffix is auto and operation has query params', () => {
    expect(
      buildUrlMatcherRegexPattern('/pets', defaultMatcherOptions, true),
    ).toBe(String.raw`(.*)/pets(\?.*)?$`);
  });

  it('omits query suffix when querySuffix is never', () => {
    expect(
      buildUrlMatcherRegexPattern(
        '/pets',
        { ...defaultMatcherOptions, querySuffix: 'never' },
        true,
      ),
    ).toBe(String.raw`(.*)/pets$`);
  });

  it('always appends query suffix when querySuffix is always', () => {
    expect(
      buildUrlMatcherRegexPattern(
        '/pets/{petId}',
        { ...defaultMatcherOptions, querySuffix: 'always' },
        false,
      ),
    ).toBe(String.raw`(.*)/pets/([A-Za-z0-9_\-.]+)(\?.*)?$`);
  });
});

describe('buildUrlMatcherRegexLiteral', () => {
  it('wraps the pattern in slashes for a RegExp literal', () => {
    expect(
      buildUrlMatcherRegexLiteral('/health', defaultMatcherOptions, false),
    ).toBe(String.raw`/(.*)\/health$/`);
  });
});

describe('getUrlMatcherExportName', () => {
  it('appends the configured export suffix to the operation name', () => {
    expect(getUrlMatcherExportName('listPets', defaultMatcherOptions)).toBe(
      'listPetsApi',
    );
  });
});

describe('generateUrlMatcherExtraFiles', () => {
  const context = {
    spec: { info: { title: 'Petstore', version: '1.0.0' } },
  } as ContextSpec;

  const verbOption = {
    operationId: 'listPets',
    operationName: 'listPets',
    pathRoute: '/pets',
    tags: ['pets'],
    queryParams: { schema: {} },
  } as GeneratorVerbOptions;

  const output = {
    target: '/tmp/petstore/endpoints.ts',
    fileExtension: '.ts',
    mode: OutputMode.SINGLE,
    urlMatchers: defaultMatcherOptions,
    override: { header: false },
  } as NormalizedOutputOptions;

  it('returns no files when urlMatchers is disabled', () => {
    expect(
      generateUrlMatcherExtraFiles(
        { listPets: verbOption },
        { ...output, urlMatchers: undefined },
        context,
      ),
    ).toEqual([]);
  });

  it('emits a single sibling file in single mode', () => {
    const [file] = generateUrlMatcherExtraFiles(
      { listPets: verbOption },
      output,
      context,
    );

    expect(file.path).toMatch(/endpoints\.apis\.ts$/);
    expect(file.content).toContain(
      String.raw`export const listPetsApi = /(.*)\/pets(\?.*)?$/;`,
    );
  });

  it('emits one file per tag in tags-split mode', () => {
    const tagsSplitOutput = {
      ...output,
      target: '/tmp/petstore-tags-split/endpoints.ts',
      mode: OutputMode.TAGS_SPLIT,
    } as NormalizedOutputOptions;

    const files = generateUrlMatcherExtraFiles(
      { listPets: verbOption },
      tagsSplitOutput,
      context,
    );

    expect(files).toHaveLength(1);
    expect(files[0].path).toMatch(/pets\/pets\.apis\.ts$/);
  });
});
