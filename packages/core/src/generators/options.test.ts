import { describe, expect, it } from 'vitest';

import {
  type GeneratorMutator,
  type GeneratorSchema,
  type GetterBody,
  type GetterQueryParam,
  type ResReqTypesValue,
  Verbs,
} from '../types';
import { generateAxiosOptions, generateMutatorConfig } from './options';

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
      isVue: false,
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
      isVue: false,
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
      isVue: true,
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
        isVue: false,
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
        isVue: false,
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
        isVue: false,
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
        isVue: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain(
        'Object.entries({...params, ...options?.params}).reduce',
      );
      expect(result).toContain(
        '{} as Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>',
      );
      expect(result).toContain('Array.isArray(value)');
      expect(result).toContain("typeof item === 'string'");
    });

    it('should apply filtering before paramsSerializer for Angular', () => {
      const result = generateAxiosOptions({
        response: minimalResponse,
        isExactOptionalPropertyTypes: false,
        queryParams: minimalSchema,
        headers: undefined,
        requestOptions: true,
        hasSignal: false,
        isVue: false,
        isAngular: true,
        paramsSerializer: minimalParamsSerializer,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain('params: paramsSerializerMutator(');
      expect(result).toContain(
        'Object.entries({...params, ...options?.params}).reduce',
      );
      expect(result).toContain(
        '{} as Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>',
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
        isVue: false,
        isAngular: true,
        paramsSerializer: undefined,
        paramsSerializerOptions: undefined,
      });

      expect(result).toContain('params: Object.entries(params).reduce');
      expect(result).toContain(
        '{} as Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>',
      );
    });
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

      expect(result).toContain('params: Object.entries(params ?? {}).reduce');
      expect(result).toContain(
        '{} as Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>',
      );
      expect(result).toContain('Array.isArray(value)');
      expect(result).toContain("typeof item === 'string'");
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

    it('should not set Content-Type header for multipart/form-data', () => {
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
      });
      expect(result).not.toContain('Content-Type');
      expect(result).not.toContain('multipart/form-data');
    });

    it('should skip Content-Type but include headers for multipart/form-data with headers', () => {
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
