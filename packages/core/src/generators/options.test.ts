import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  type GeneratorMutator,
  type GeneratorSchema,
  type GetterBody,
  type GetterQueryParam,
  type ResReqTypesValue,
  Verbs,
} from '../types';
import {
  buildAngularParamsFilterExpression,
  generateAxiosOptions,
  generateBodyOptions,
  generateMutatorConfig,
  generateOptions,
  getAngularFilteredParamsCallExpression,
  getAngularFilteredParamsExpression,
  getAngularFilteredParamsHelperBody,
  getAngularObjectParamStrategies,
} from './options';

const minimalSchema: GeneratorSchema = {
  name: 'TestSchema',
  model: 'TestSchema',
  imports: [],
};

const minimalQueryParam: GetterQueryParam = {
  schema: minimalSchema,
  deps: [],
  isOptional: false,
};

const minimalBody: GetterBody = {
  originalSchema: {},
  imports: [],
  definition: '',
  implementation: 'data',
  schemas: [],
  formData: undefined,
  formUrlEncoded: undefined,
  contentType: 'application/json',
  isOptional: false,
};

const minimalParamsSerializer: GeneratorMutator = {
  name: 'paramsSerializerMutator',
  path: './paramsSerializerMutator',
  default: false,
  hasErrorType: false,
  errorTypeName: '',
  hasSecondArg: false,
  hasThirdArg: false,
  isHook: false,
};

const minimalParamsFilter: GeneratorMutator = {
  name: 'paramsFilterMutator',
  path: './paramsFilterMutator',
  default: false,
  hasErrorType: false,
  errorTypeName: '',
  hasSecondArg: false,
  hasThirdArg: false,
  isHook: false,
};

const buildScalarValue = (
  overrides: Partial<ResReqTypesValue>,
): ResReqTypesValue => ({
  value: 'string',
  isEnum: false,
  type: 'string',
  imports: [],
  schemas: [],
  isRef: false,
  hasReadonlyProps: false,
  dependencies: [],
  example: undefined,
  examples: undefined,
  key: '200',
  contentType: 'application/json',
  ...overrides,
});

describe('generateAxiosOptions', () => {
  it('should return "...options"', () => {
    const result = generateAxiosOptions({
      response: {
        imports: [],
        definition: {
          success: 'string',
          errors: 'unknown',
        },
        isBlob: false,
        types: {
          success: [
            buildScalarValue({
              originalSchema: {
                type: 'string',
                format: 'uuid',
              },
            }),
          ],
          errors: [],
        },
        contentTypes: ['application/json'],
        schemas: [],
        originalSchema: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'string',
                  format: 'uuid',
                },
              },
            },
          },
        },
      },
      isExactOptionalPropertyTypes: false,
      queryParams: undefined,
      headers: undefined,
      requestOptions: true,
      hasSignal: false,
      isAngular: false,
      paramsSerializer: undefined,
      paramsSerializerOptions: undefined,
    });
    expect(result).toBe('\n    ...options,');
  });

  it('should return "options"', () => {
    const result = generateAxiosOptions({
      response: {
        imports: [
          {
            name: 'Pet',
            schemaName: 'Pet',
          },
        ],
        definition: {
          success: 'Pet',
          errors: 'unknown',
        },
        isBlob: false,
        types: {
          success: [
            buildScalarValue({
              value: 'Pet',
              type: 'object',
              imports: [
                {
                  name: 'Pet',
                  schemaName: 'Pet',
                },
              ],
              originalSchema: {
                type: 'object',
                required: ['id', 'name'],
                properties: {
                  id: {
                    type: 'integer',
                    format: 'int64',
                  },
                  name: {
                    type: 'string',
                  },
                  tag: {
                    type: 'string',
                  },
                  status: {
                    $ref: '#/components/schemas/Domain.Status.Enum',
                  },
                  email: {
                    type: 'string',
                    format: 'email',
                  },
                },
              },
              isRef: true,
            }),
          ],
          errors: [],
        },
        contentTypes: ['application/json'],
        schemas: [],
        originalSchema: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Pet',
                },
              },
            },
          },
        },
      },
      isExactOptionalPropertyTypes: false,
      queryParams: undefined,
      headers: undefined,
      requestOptions: true,
      hasSignal: true,
      isAngular: false,
      paramsSerializer: undefined,
      paramsSerializerOptions: undefined,
    });
    expect(result).toBe('options');
  });

  it(`should return "responseType: 'text', ...options"`, () => {
    const result = generateAxiosOptions({
      response: {
        imports: [],
        definition: {
          success: 'string',
          errors: 'unknown',
        },
        isBlob: false,
        types: {
          success: [
            buildScalarValue({
              contentType: 'text/plain',
              originalSchema: {
                type: 'string',
                format: 'uuid',
              },
            }),
          ],
          errors: [],
        },
        contentTypes: ['text/plain'],
        schemas: [],
        originalSchema: {
          '200': {
            content: {
              'text/plain': {
                schema: {
                  type: 'string',
                  format: 'uuid',
                },
              },
            },
          },
        },
      },
      isExactOptionalPropertyTypes: false,
      queryParams: undefined,
      headers: undefined,
      requestOptions: true,
      hasSignal: true,
      isAngular: false,
      paramsSerializer: undefined,
      paramsSerializerOptions: undefined,
    });
    expect(result).toBe("\n        responseType: 'text',\n    ...options,");
  });

  describe('hasSignalParam (API param named "signal")', () => {
    const minimalResponse = {
      imports: [],
      definition: { success: 'Pet', errors: 'unknown' },
      isBlob: false,
      types: { success: [], errors: [] },
      contentTypes: ['application/json'],
      schemas: [],
      originalSchema: {},
    };

    it('should return "signal: querySignal" when hasSignalParam is true', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: undefined,
        headers: undefined,
        requestOptions: false,
        hasSignal: true,
        hasSignalParam: true,
        isAngular: false,
      });
      expect(result).toBe('signal: querySignal');
    });

    it('should return "signal" when hasSignalParam is false', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: undefined,
        headers: undefined,
        requestOptions: false,
        hasSignal: true,
        hasSignalParam: false,
        isAngular: false,
      });
      expect(result).toBe('signal');
    });

    it('should use querySignal in spread form with exactOptionalPropertyTypes', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: true,
        queryParams: undefined,
        headers: undefined,
        requestOptions: false,
        hasSignal: true,
        hasSignalParam: true,
        isAngular: false,
      });
      expect(result).toBe('...(querySignal ? { signal: querySignal } : {})');
    });
  });

  describe('Angular params filtering', () => {
    const minimalResponse = {
      imports: [],
      definition: { success: 'Pet', errors: 'unknown' },
      isBlob: false,
      types: { success: [], errors: [] },
      contentTypes: ['application/json'],
      schemas: [],
      originalSchema: {},
    };

    it('should filter null/undefined params (including array entries) for Angular', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain(
        'params: filterParams({...params, ...options?.params}',
      );
      expect(result).toContain('new Set<string>([])');
    });

    it('should apply filtering before paramsSerializer for Angular', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        requiredNullableQueryParamKeys: ['requiredNullableParam'],
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: minimalParamsSerializer,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain('params: paramsSerializerMutator(filterParams(');
      expect(result).toContain('{...params, ...options?.params}');
      expect(result).toContain(
        'new Set<string>(["requiredNullableParam"]), true',
      );
    });

    it('should filter params for Angular when requestOptions is false', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        headers: undefined,
        requestOptions: false,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain(
        'for (const [key, value] of Object.entries(params ?? {}))',
      );
      expect(result).toContain(
        'const filteredParams: Record<string, string | number | boolean | Array<string | number | boolean>> = {};',
      );
      expect(result).not.toContain('false &&');
    });

    it('should preserve required nullable params for Angular serializers when requestOptions is false', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        requiredNullableQueryParamKeys: ['requiredNullableParam'],
        headers: undefined,
        requestOptions: false,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: minimalParamsSerializer,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain('params: paramsSerializerMutator((() => {');
      expect(result).toContain(
        'const filteredParams: Record<string, string | number | boolean | null | Array<string | number | boolean>> = {};',
      );
      expect(result).toContain(
        '} else if (value === null && requiredNullableParamKeys.has(key)) {',
      );
      expect(result).not.toContain('false &&');
    });

    // Issue #3326: schema-declared object/array-of-object query params used to
    // be silently dropped by `filterParams`. With nonPrimitiveQueryParamKeys
    // they are passed through so a downstream paramsSerializer/mutator/
    // paramsFilter can handle them.
    it('passes nonPrimitiveKeys through the shared filter helper when a paramsSerializer is configured', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        nonPrimitiveQueryParamKeys: ['filters'],
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: minimalParamsSerializer,
        paramsSerializerOptions: undefined,
      });

      // The shared helper is invoked with the passthrough set as the fourth
      // argument so `filters` survives filtering.
      expect(result).toContain('new Set<string>(["filters"])');
    });

    it('keeps shared Angular HttpClient params primitive-only without a downstream serializer', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        nonPrimitiveQueryParamKeys: ['filters'],
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).not.toContain('new Set<string>(["filters"])');
    });

    it('keeps inline Angular HttpClient params primitive-only without a downstream serializer', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        nonPrimitiveQueryParamKeys: ['filters'],
        headers: undefined,
        requestOptions: false,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).not.toContain(
        'const passthroughKeys = new Set<string>(["filters"])',
      );
    });

    it('replaces the built-in filter when paramsFilter is configured', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
        paramsFilter: minimalParamsFilter,
      });

      // The user's paramsFilter is the sole filter — `filterParams(...)` is
      // not emitted alongside it.
      expect(result).toContain(
        'params: paramsFilterMutator({...params, ...options?.params})',
      );
      expect(result).not.toContain('filterParams(');
    });

    it('composes paramsSerializer around paramsFilter when both are set', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isAngular: true,
        paramsSerializer: minimalParamsSerializer,
        paramsSerializerOptions: undefined,
        paramsFilter: minimalParamsFilter,
      });

      expect(result).toContain(
        'params: paramsSerializerMutator(paramsFilterMutator({...params, ...options?.params}))',
      );
      expect(result).not.toContain('filterParams(');
    });
  });
});

// Issue #3705: object-typed query params are serialized per their OpenAPI
// `style`/`explode` (form+explode:true -> flatten, form+explode:false ->
// comma, deepObject -> bracketed keys) instead of being silently dropped,
// when no `paramsSerializer`/`paramsFilter` is configured.
describe('Angular object query param serialization (issue #3705)', () => {
  // Hard constraint: the emitted `filterParams` helper MUST stay byte-for-byte
  // identical to its pre-#3705 shape whenever no operation in the file needs
  // the object-serialization overload — this pins the exact string so any
  // accidental drift in the base helper (which would blow up the snapshot
  // blast radius across every Angular/angular-query file) fails loudly here.
  const PRE_3705_HELPER_BODY = `type AngularHttpParamValue = string | number | boolean | Array<string | number | boolean>;
type AngularHttpParamValueWithNullable = AngularHttpParamValue | null;

function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys?: ReadonlySet<string>,
  preserveRequiredNullables?: false,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValue>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: true,
  passthroughKeys?: undefined,
): Record<string, AngularHttpParamValueWithNullable>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> | undefined,
  preserveRequiredNullables: boolean | undefined,
  passthroughKeys: ReadonlySet<string>,
): Record<string, unknown>;
function filterParams(
  params: Record<string, unknown>,
  requiredNullableKeys: ReadonlySet<string> = new Set(),
  preserveRequiredNullables = false,
  passthroughKeys: ReadonlySet<string> = new Set(),
): Record<string, unknown> {
  const filteredParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (passthroughKeys.has(key)) {
      if (value !== undefined) {
        filteredParams[key] = value;
      }
      continue;
    }
    if (Array.isArray(value)) {
      const filtered = value.filter(
        (item) =>
          item != null &&
          (typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'),
      ) as Array<string | number | boolean>;
      if (filtered.length) {
        filteredParams[key] = filtered;
      }
    } else if (
      preserveRequiredNullables &&
      value === null &&
      requiredNullableKeys.has(key)
    ) {
      filteredParams[key] = null;
    } else if (
      value != null &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      filteredParams[key] = value;
    }
  }
  return filteredParams;
}`;

  describe('getAngularFilteredParamsHelperBody byte-identity', () => {
    it('returns the exact pre-#3705 body with no arguments', () => {
      expect(getAngularFilteredParamsHelperBody()).toBe(PRE_3705_HELPER_BODY);
    });

    it('returns the exact pre-#3705 body when hasObjectParams is false', () => {
      expect(
        getAngularFilteredParamsHelperBody({ hasObjectParams: false }),
      ).toBe(PRE_3705_HELPER_BODY);
    });

    it('adds the object-serialization overload only when hasObjectParams is true', () => {
      const body = getAngularFilteredParamsHelperBody({
        hasObjectParams: true,
      });

      expect(body).not.toBe(PRE_3705_HELPER_BODY);
      expect(body).toContain('objectParamStrategies');
      expect(body).toContain("'flatten' | 'comma' | 'deepObject'");
    });
  });

  describe('getAngularFilteredParamsExpression (inline IIFE)', () => {
    it('is byte-identical when no strategies are passed', () => {
      const withoutStrategies = getAngularFilteredParamsExpression(
        'params ?? {}',
        [],
        false,
        [],
      );
      const withEmptyStrategies = getAngularFilteredParamsExpression(
        'params ?? {}',
        [],
        false,
        [],
        {},
      );

      expect(withEmptyStrategies).toBe(withoutStrategies);
      expect(withoutStrategies).not.toContain('objectParamStrategies');
    });

    it('emits the strategies map and branch when provided', () => {
      const result = getAngularFilteredParamsExpression(
        'params ?? {}',
        [],
        false,
        [],
        { arg0: 'flatten' },
      );

      expect(result).toContain(
        `const objectParamStrategies: Readonly<Record<string, 'flatten' | 'comma' | 'deepObject'>> = {"arg0":"flatten"};`,
      );
      expect(result).toContain('Object.hasOwn(objectParamStrategies, key)');
    });
  });

  describe('getAngularFilteredParamsCallExpression', () => {
    it('is byte-identical when no strategies are passed', () => {
      expect(
        getAngularFilteredParamsCallExpression('params', [], false, []),
      ).toBe(
        getAngularFilteredParamsCallExpression('params', [], false, [], {}),
      );
    });

    it('emits a 5-argument call with the strategies literal when provided', () => {
      const result = getAngularFilteredParamsCallExpression(
        'params',
        [],
        false,
        [],
        { arg0: 'flatten' },
      );

      expect(result).toBe(
        `filterParams(params, new Set<string>([]), false, new Set<string>([]), {"arg0":"flatten"} as const)`,
      );
    });
  });

  describe('getAngularObjectParamStrategies gating', () => {
    const objectQueryParams: GetterQueryParam['objectQueryParams'] = [
      { key: 'arg0', strategy: 'flatten' },
    ];

    it('returns the strategy map when nothing suppresses it', () => {
      expect(
        getAngularObjectParamStrategies({
          queryParams: { ...minimalQueryParam, objectQueryParams },
          queryObjectSerialization: 'spec',
        }),
      ).toEqual({ arg0: 'flatten' });
    });

    it('suppresses strategies when queryObjectSerialization is legacy', () => {
      expect(
        getAngularObjectParamStrategies({
          queryParams: { ...minimalQueryParam, objectQueryParams },
          queryObjectSerialization: 'legacy',
        }),
      ).toEqual({});
    });

    it('suppresses strategies when a paramsSerializer is configured', () => {
      expect(
        getAngularObjectParamStrategies({
          queryParams: { ...minimalQueryParam, objectQueryParams },
          paramsSerializer: minimalParamsSerializer,
          queryObjectSerialization: 'spec',
        }),
      ).toEqual({});
    });

    it('suppresses strategies when a paramsFilter is configured', () => {
      expect(
        getAngularObjectParamStrategies({
          queryParams: { ...minimalQueryParam, objectQueryParams },
          paramsFilter: minimalParamsFilter,
          queryObjectSerialization: 'spec',
        }),
      ).toEqual({});
    });

    it('returns an empty map when there are no object query params', () => {
      expect(
        getAngularObjectParamStrategies({
          queryParams: minimalQueryParam,
          queryObjectSerialization: 'spec',
        }),
      ).toEqual({});
    });
  });

  describe('buildAngularParamsFilterExpression threading', () => {
    it('threads objectParamStrategies through the shared-helper call', () => {
      const result = buildAngularParamsFilterExpression({
        paramsExpression: 'params',
        objectParamStrategies: { arg0: 'flatten' },
        useSharedHelper: true,
      });

      expect(result).toContain('{"arg0":"flatten"} as const');
    });

    it('threads objectParamStrategies through the inline IIFE', () => {
      const result = buildAngularParamsFilterExpression({
        paramsExpression: 'params',
        objectParamStrategies: { arg0: 'flatten' },
        useSharedHelper: false,
      });

      expect(result).toContain('objectParamStrategies');
    });

    it('bypasses strategies entirely when a paramsFilter is configured', () => {
      const result = buildAngularParamsFilterExpression({
        paramsExpression: 'params',
        objectParamStrategies: { arg0: 'flatten' },
        paramsFilter: minimalParamsFilter,
        useSharedHelper: true,
      });

      expect(result).toBe('paramsFilterMutator(params)');
    });
  });

  describe('filterParams runtime behavior', () => {
    // Transpiles the emitted helper body (type annotations + overload
    // signatures) down to plain JS so the actual runtime branching can be
    // exercised directly, instead of only asserting on the generated string.
    const loadFilterParams = (
      body: string,
    ): ((
      params: Record<string, unknown>,
      requiredNullableKeys?: ReadonlySet<string>,
      preserveRequiredNullables?: boolean,
      passthroughKeys?: ReadonlySet<string>,
      objectParamStrategies?: Record<string, string>,
    ) => Record<string, unknown>) => {
      const { outputText } = ts.transpileModule(body, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
        },
      });
      const moduleObject: { exports: unknown } = { exports: {} };
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      const factory = new Function(
        'module',
        'exports',
        `${outputText}\nmodule.exports = filterParams;`,
      );
      factory(moduleObject, moduleObject.exports);
      return moduleObject.exports as ReturnType<typeof loadFilterParams>;
    };

    it('flattens a form+explode:true object, dropping nested non-primitives', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        {
          arg0: {
            itemReferences: ['a', 'b', null],
            pageNumber: 1,
            nested: { a: 1 },
            tags: [{ x: 1 }],
          },
        },
        new Set(),
        false,
        new Set(),
        { arg0: 'flatten' },
      );

      expect(result).toEqual({ itemReferences: ['a', 'b'], pageNumber: 1 });
    });

    it('joins a form+explode:false object into a single comma value', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        { filters: { a: 1, b: 'x', nested: { c: 1 } } },
        new Set(),
        false,
        new Set(),
        { filters: 'comma' },
      );

      expect(result).toEqual({ filters: 'a,1,b,x' });
    });

    it('includes primitive array items in the comma-joined value', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        { arg0: { itemReferences: ['a', 'b'], pageNumber: 1 } },
        new Set(),
        false,
        new Set(),
        { arg0: 'comma' },
      );

      expect(result).toEqual({ arg0: 'itemReferences,a,b,pageNumber,1' });
    });

    it('filters null and object items out of comma-joined array values', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        {
          arg0: {
            itemReferences: ['a', null, { x: 1 }, 'b'],
            nested: { c: 1 },
            pageNumber: 1,
          },
        },
        new Set(),
        false,
        new Set(),
        { arg0: 'comma' },
      );

      expect(result).toEqual({ arg0: 'itemReferences,a,b,pageNumber,1' });
    });

    it('emits bracketed keys for deepObject, preserving array values', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        { filters: { a: 1, tags: ['x', 'y'], nested: { c: 1 } } },
        new Set(),
        false,
        new Set(),
        { filters: 'deepObject' },
      );

      expect(result).toEqual({ 'filters[a]': 1, 'filters[tags]': ['x', 'y'] });
    });

    it('leaves non-strategy keys and sibling primitives untouched', () => {
      const filterParams = loadFilterParams(
        getAngularFilteredParamsHelperBody({ hasObjectParams: true }),
      );

      const result = filterParams(
        { arg0: { pageNumber: 1 }, q: 'search' },
        new Set(),
        false,
        new Set(),
        { arg0: 'flatten' },
      );

      expect(result).toEqual({ pageNumber: 1, q: 'search' });
    });
  });
});

describe('generateBodyOptions', () => {
  it('should return formData when form data handling is enabled', () => {
    expect(
      generateBodyOptions(
        { ...minimalBody, formData: 'something' },
        true,
        false,
      ),
    ).toBe('formData');
  });

  it('should return formUrlEncoded when url encoded handling is enabled', () => {
    expect(
      generateBodyOptions(
        { ...minimalBody, formUrlEncoded: 'something' },
        false,
        true,
      ),
    ).toBe('formUrlEncoded');
  });

  it('should return a plain body identifier without formatting', () => {
    expect(
      generateBodyOptions(
        { ...minimalBody, implementation: 'data' },
        false,
        false,
      ),
    ).toBe('data');
  });

  it('should return undefined when no request body is available', () => {
    expect(
      generateBodyOptions(
        {
          ...minimalBody,
          implementation: '',
          formData: '',
          formUrlEncoded: '',
        },
        false,
        false,
      ),
    ).toBeUndefined();
  });
});

describe('generateMutatorConfig', () => {
  const minimalResponse = {
    imports: [],
    definition: { success: 'Pet', errors: 'unknown' },
    isBlob: false,
    types: { success: [], errors: [] },
    contentTypes: ['application/json'],
    schemas: [],
    originalSchema: {},
  };

  describe('hasSignalParam (API param named "signal")', () => {
    it('should output "signal: querySignal" when hasSignalParam is true', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: minimalBody,
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: true,
        hasSignalParam: true,
        isExactOptionalPropertyTypes: false,
      });
      expect(result).toContain('signal: querySignal');
    });

    it('should output "signal" when hasSignalParam is false', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: minimalBody,
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: true,
        hasSignalParam: false,
        isExactOptionalPropertyTypes: false,
      });
      expect(result).toContain(', signal');
      expect(result).not.toContain('querySignal');
    });

    it('should use querySignal in spread form with exactOptionalPropertyTypes', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: minimalBody,
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: true,
        hasSignalParam: true,
        isExactOptionalPropertyTypes: true,
        isAngular: false,
      });
      expect(result).toContain('...(querySignal ? { signal: querySignal }');
    });
  });

  describe('Angular params filtering', () => {
    it('should filter null/undefined params (including array entries) for Angular mutators', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: minimalBody,
        headers: undefined,
        queryParams: minimalQueryParam,
        response: minimalResponse,
        verb: Verbs.GET,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
        isAngular: true,
      });

      expect(result).toContain(
        'for (const [key, value] of Object.entries(params ?? {}))',
      );
      expect(result).toContain(
        'const filteredParams: Record<string, string | number | boolean | Array<string | number | boolean>> = {};',
      );
      expect(result).toContain('Array.isArray(value)');
      expect(result).toContain("typeof item === 'string'");
      expect(result).not.toContain('false &&');
    });
  });

  describe('Content-Type header handling', () => {
    it('should set Content-Type header for application/json', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: { ...minimalBody, contentType: 'application/json' },
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
      });
      expect(result).toContain("'Content-Type': 'application/json'");
    });

    it('should not set Content-Type header for multipart/form-data in Angular', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: { ...minimalBody, contentType: 'multipart/form-data' },
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: true,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
        isAngular: true,
      });
      expect(result).not.toContain('Content-Type');
      expect(result).not.toContain('multipart/form-data');
    });

    it('should set Content-Type header for multipart/form-data when not Angular', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: { ...minimalBody, contentType: 'multipart/form-data' },
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: true,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
        isAngular: false,
      });
      expect(result).toContain("'Content-Type': 'multipart/form-data'");
    });

    it('should skip Content-Type but include headers for multipart/form-data with headers in Angular', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: { ...minimalBody, contentType: 'multipart/form-data' },
        headers: minimalQueryParam,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: true,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
        isAngular: true,
      });
      expect(result).not.toContain('Content-Type');
      expect(result).toContain('headers');
    });

    it('should set Content-Type header for application/x-www-form-urlencoded', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: {
          ...minimalBody,
          contentType: 'application/x-www-form-urlencoded',
        },
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: true,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
      });
      expect(result).toContain(
        "'Content-Type': 'application/x-www-form-urlencoded'",
      );
    });

    it('should not include headers section when contentType is empty and no headers', () => {
      const result = generateMutatorConfig({
        route: '/api/test',
        body: { ...minimalBody, contentType: '' },
        headers: undefined,
        queryParams: undefined,
        response: minimalResponse,
        verb: Verbs.POST,
        isFormData: false,
        isFormUrlEncoded: false,
        hasSignal: false,
        isExactOptionalPropertyTypes: false,
      });
      expect(result).not.toContain('headers');
      expect(result).not.toContain('Content-Type');
    });
  });
});

describe('generateOptions', () => {
  it('should not double-wrap Angular observe object literal options for body verbs', () => {
    const result = generateOptions({
      route: '/pets',
      body: minimalBody,
      response: {
        imports: [],
        definition: { success: 'Pet', errors: 'unknown' },
        isBlob: false,
        types: { success: [], errors: [] },
        contentTypes: ['application/json'],
        schemas: [],
        originalSchema: {},
      },
      verb: Verbs.POST,
      requestOptions: true,
      isFormData: false,
      isFormUrlEncoded: false,
      isAngular: true,
      angularObserve: 'events',
      isExactOptionalPropertyTypes: false,
      hasSignal: false,
    });

    expect(result).toContain('data,');
    expect(result).toContain("observe: 'events'");
    expect(result).not.toContain(',{{');
    expect(result).not.toContain('{\n      data,{{');
  });
});
