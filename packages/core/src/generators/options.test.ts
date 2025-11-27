import { describe, expect, it } from 'vitest';

import { generateAxiosOptions } from './options';

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
});
