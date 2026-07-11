import type { ContextSpec, NormalizedOutputOptions } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  buildAngularBaseUrlFileContent,
  generateAngularBaseUrlExtraFiles,
  getAngularBaseUrlFilePath,
  getAngularBaseUrlImportSpecifier,
  getBaseUrlConstantPrefix,
  getBaseUrlResolverTokenName,
  getBaseUrlServerUrlConstantName,
  getBaseUrlTokenName,
  getProvideBaseUrlName,
  getProvideBaseUrlResolverName,
} from './base-url';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const angularOverride = {
  provideIn: 'root',
  client: 'httpClient',
  runtimeValidation: false,
} as const;

const createOutput = (
  overrides: Partial<NormalizedOutputOptions> = {},
): NormalizedOutputOptions => {
  const output = {
    target: '/tmp/pet.ts',
    schemas: '/tmp/schemas',
    operationSchemas: undefined,
    namingConvention: 'camelCase',
    fileExtension: '.ts',
    schemaFileExtension: '.ts',
    mode: 'single',
    mock: { indexMockFiles: false, generators: [] },
    override: {
      operations: {},
      tags: {},
      query: {},
      jsDoc: {},
      header: false,
      hono: {
        handlerGenerationStrategy: 'smart',
        compositeRoute: '',
        validator: true,
        validatorOutputPath: '',
      },
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
      requestOptions: true,
      namingConvention: {},
      components: {
        schemas: { suffix: 'Schema', itemSuffix: 'Item' },
        responses: { suffix: 'Response' },
        parameters: { suffix: 'Parameters' },
        requestBodies: { suffix: 'Body' },
      },
      angular: angularOverride,
      swr: {},
      zod: {
        version: 'auto',
        variant: 'classic',
        strict: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generate: {
          param: true,
          query: true,
          header: true,
          body: true,
          response: true,
        },
        coerce: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generateEachHttpStatus: false,
        generateReusableSchemas: false,
        generateMeta: false,
        generateDiscriminatedUnion: false,
        useBrandedTypes: false,
        dateTimeOptions: {},
        timeOptions: {},
      },
      effect: {
        strict: {
          param: false,
          query: false,
          header: false,
          body: false,
          response: false,
        },
        generate: {
          param: true,
          query: true,
          header: true,
          body: true,
          response: true,
        },
        generateEachHttpStatus: false,
        useBrandedTypes: false,
      },
      fetch: {
        includeHttpResponseReturnType: true,
        forceSuccessResponse: false,
        runtimeValidation: false,
        useRuntimeFetcher: false,
      },
      enumGenerationType: 'const',
      splitByContentType: false,
      aliasCombinedTypes: false,
      suppressReadonlyModifier: false,
      mcp: {},
    },
    client: 'angular',
    httpClient: 'angular',
    clean: false,
    docs: false,
    formatter: undefined,
    tsconfig: {},
    packageJson: {},
    headers: false,
    indexFiles: true,
    baseUrl: undefined,
    allParamsOptional: false,
    urlEncodeParameters: false,
    optionsParamRequired: false,
    unionAddMissingProperties: false,
    propertySortOrder: 'Specification',
    tagsSplitDeduplication: false,
    commonTypesFileName: 'common-types',
    factoryMethods: {
      functionNamePrefix: 'create',
      mode: 'single',
      outputDirectory: '',
      includeOptionalProperty: false,
    },
    ...overrides,
  } satisfies NormalizedOutputOptions;

  return output;
};

const createContextSpec = (
  output: NormalizedOutputOptions,
  servers?: ContextSpec['spec']['servers'],
): ContextSpec => {
  const spec = {
    openapi: '3.1.0',
    info: { title: 'Pets', version: '1.0.0' },
    paths: {},
    ...(servers ? { servers } : {}),
  } satisfies ContextSpec['spec'];

  return {
    output,
    projectName: 'pets',
    target: output.target,
    workspace: output.workspace ?? '/tmp',
    spec,
  } satisfies ContextSpec;
};

// ---------------------------------------------------------------------------
// Naming derivation
// ---------------------------------------------------------------------------

describe('naming helpers', () => {
  it('derives CONSTANT_CASE names from a kebab-case apiId', () => {
    expect(getBaseUrlConstantPrefix('example-api')).toBe('EXAMPLE_API');
    expect(getBaseUrlServerUrlConstantName('example-api')).toBe(
      'EXAMPLE_API_SERVER_URL',
    );
    expect(getBaseUrlTokenName('example-api')).toBe('EXAMPLE_API_BASE_URL');
    expect(getBaseUrlResolverTokenName('example-api')).toBe(
      'EXAMPLE_API_BASE_URL_RESOLVER',
    );
  });

  it('derives PascalCase provide-helper names from a kebab-case apiId', () => {
    expect(getProvideBaseUrlName('example-api')).toBe(
      'provideExampleApiBaseUrl',
    );
    expect(getProvideBaseUrlResolverName('example-api')).toBe(
      'provideExampleApiBaseUrlResolver',
    );
  });
});

// ---------------------------------------------------------------------------
// buildAngularBaseUrlFileContent
// ---------------------------------------------------------------------------

describe('buildAngularBaseUrlFileContent', () => {
  it('emits the tokens, precedence wiring, and provide helpers', () => {
    const content = buildAngularBaseUrlFileContent({
      apiId: 'example-api',
      serverUrl: 'http://example.com/v1',
    });

    expect(content).toContain(
      "import { InjectionToken, inject, type Provider } from '@angular/core';",
    );
    expect(content).toContain(
      'export const EXAMPLE_API_SERVER_URL: string = "http://example.com/v1";',
    );
    expect(content).toContain('export function normalizeBaseUrl(');
    expect(content).toContain(
      'export const EXAMPLE_API_BASE_URL_RESOLVER = new InjectionToken<ExampleApiBaseUrlResolver>(',
    );
    expect(content).toContain(
      'factory: (): ExampleApiBaseUrlResolver => (context) => context.serverUrl,',
    );
    expect(content).toContain(
      'export const EXAMPLE_API_BASE_URL = new InjectionToken<string>(',
    );
    expect(content).toContain(
      'const resolver = inject(EXAMPLE_API_BASE_URL_RESOLVER);',
    );
    expect(content).toContain(
      'resolver({ apiId: "example-api", serverUrl: EXAMPLE_API_SERVER_URL }),',
    );
    expect(content).toContain(
      'export function provideExampleApiBaseUrl(baseUrl: string): Provider {',
    );
    expect(content).toContain(
      'export function provideExampleApiBaseUrlResolver(',
    );
    expect(content).not.toMatch(/\bany\b/);
  });

  it('embeds an empty serverUrl fallback verbatim', () => {
    const content = buildAngularBaseUrlFileContent({
      apiId: 'example-api',
      serverUrl: '',
    });

    expect(content).toContain(
      'export const EXAMPLE_API_SERVER_URL: string = "";',
    );
  });
});

// ---------------------------------------------------------------------------
// normalizeBaseUrl (trailing-slash matrix)
// ---------------------------------------------------------------------------

// Mirrors the emitted `normalizeBaseUrl` body (`baseUrl.replace(/\/+$/, '')`)
// exactly. Kept as a literal, independently-written implementation (rather
// than executing the generated source) so the test never evaluates
// dynamically constructed code.
const stripTrailingSlashes = (baseUrl: string): string =>
  baseUrl.replace(/\/+$/, '');

describe('normalizeBaseUrl trailing-slash matrix', () => {
  it("emits exactly `return baseUrl.replace(/\\/+$/, '');`", () => {
    const content = buildAngularBaseUrlFileContent({
      apiId: 'example-api',
      serverUrl: '',
    });

    expect(content).toContain(
      "export function normalizeBaseUrl(baseUrl: string): string {\n  return baseUrl.replace(/\\/+$/, '');\n}",
    );
  });

  it.each([
    ['', ''],
    ['/', ''],
    ['/api/x/', '/api/x'],
    ['https://h', 'https://h'],
    ['https://h/', 'https://h'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(stripTrailingSlashes(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getAngularBaseUrlFilePath / getAngularBaseUrlImportSpecifier
// ---------------------------------------------------------------------------

describe('getAngularBaseUrlFilePath', () => {
  it('is mode-independent: always <dirname>/<filename>.base-url.ts', () => {
    for (const mode of ['single', 'split', 'tags', 'tags-split'] as const) {
      const output = createOutput({ target: '/tmp/api/pet.ts', mode });
      expect(getAngularBaseUrlFilePath(output)).toBe(
        '/tmp/api/pet.base-url.ts',
      );
    }
  });
});

describe('getAngularBaseUrlImportSpecifier', () => {
  // Always authored relative to `dirname` (as if the importer were a
  // sibling), for every mode including `tags-split` — the `tags-split`
  // writer (`writers/split-tags-mode.ts`) generically re-resolves every
  // relative `GeneratorImport.importPath` against the operation's actual
  // nested file location, so this function must NOT also apply a `'../'`
  // shift for that mode or the writer would double-apply it.
  it('is mode-independent: always "./<filename>.base-url"', () => {
    for (const mode of ['single', 'split', 'tags', 'tags-split'] as const) {
      const output = createOutput({ target: '/tmp/api/pet.ts', mode });
      expect(getAngularBaseUrlImportSpecifier(output)).toBe('./pet.base-url');
    }
  });
});

// ---------------------------------------------------------------------------
// generateAngularBaseUrlExtraFiles
// ---------------------------------------------------------------------------

describe('generateAngularBaseUrlExtraFiles', () => {
  it('returns [] when override.angular.baseUrl is unset', async () => {
    const output = createOutput();
    const files = await generateAngularBaseUrlExtraFiles(
      {},
      output,
      createContextSpec(output),
    );

    expect(files).toEqual([]);
  });

  it('embeds the first server URL from the spec when servers are present', async () => {
    const output = createOutput({
      override: {
        ...createOutput().override,
        angular: { ...angularOverride, baseUrl: { apiId: 'example-api' } },
      },
    });
    const context = createContextSpec(output, [
      { url: 'http://petstore.swagger.io/v1' },
      { url: 'http://other.example.com' },
    ]);

    const files = await generateAngularBaseUrlExtraFiles({}, output, context);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('/tmp/pet.base-url.ts');
    expect(files[0].content).toContain(
      'export const EXAMPLE_API_SERVER_URL: string = "http://petstore.swagger.io/v1";',
    );
  });

  it('selects servers[index] and resolves variables when configured', async () => {
    const output = createOutput({
      override: {
        ...createOutput().override,
        angular: {
          ...angularOverride,
          baseUrl: {
            apiId: 'example-api',
            index: 1,
            variables: { port: '8080' },
          },
        },
      },
    });
    const context = createContextSpec(output, [
      { url: 'http://primary.example.com' },
      {
        url: 'http://secondary.example.com:{port}',
        variables: { port: { default: '443' } },
      },
    ]);

    const files = await generateAngularBaseUrlExtraFiles({}, output, context);

    expect(files[0].content).toContain(
      'export const EXAMPLE_API_SERVER_URL: string = "http://secondary.example.com:8080";',
    );
  });

  it('embeds an empty serverUrl fallback when the spec has no servers', async () => {
    const output = createOutput({
      override: {
        ...createOutput().override,
        angular: { ...angularOverride, baseUrl: { apiId: 'example-api' } },
      },
    });

    const files = await generateAngularBaseUrlExtraFiles(
      {},
      output,
      createContextSpec(output),
    );

    expect(files[0].content).toContain(
      'export const EXAMPLE_API_SERVER_URL: string = "";',
    );
  });
});
