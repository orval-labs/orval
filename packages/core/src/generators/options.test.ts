import { describe, expect, it } from 'vitest';

import { generateAxiosOptions, generateMutatorConfig } from './options';
import { Verbs } from '../types';

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
            {
              value: 'string',
              isEnum: false,
              type: 'string',
              imports: [],
              schemas: [],
              isRef: false,
              hasReadonlyProps: false,
              example: undefined,
              examples: undefined,
              originalSchema: {
                type: 'string',
                format: 'uuid',
              },
              contentType: 'application/json',
              key: '200',
            },
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
            {
              value: 'Pet',
              imports: [
                {
                  name: 'Pet',
                  schemaName: 'Pet',
                },
              ],
              type: 'object',
              schemas: [],
              isEnum: false,
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
              hasReadonlyProps: false,
              isRef: true,
              contentType: 'application/json',
              example: undefined,
              examples: undefined,
              key: '200',
            },
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
            {
              value: 'string',
              isEnum: false,
              type: 'string',
              imports: [],
              schemas: [],
              isRef: false,
              hasReadonlyProps: false,
              example: undefined,
              examples: undefined,
              originalSchema: {
                type: 'string',
                format: 'uuid',
              },
              contentType: 'text/plain',
              key: '200',
            },
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
});

describe('generateMutatorConfig', () => {
  const minimalBody = {
    originalSchema: {},
    definition: '',
    implementation: 'data',
    default: false,
    required: false,
    formData: undefined,
    formUrlEncoded: undefined,
    contentType: 'application/json',
  };

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
      });
      expect(result).toContain('...(querySignal ? { signal: querySignal }');
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
        headers: 'headers',
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
