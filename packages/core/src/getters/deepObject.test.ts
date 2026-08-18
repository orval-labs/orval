import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
  ReadonlyRequestBodiesMode,
} from '../types';
import { getResReqTypes } from './res-req-types';

const createContext = (
  preserveReadonlyRequestBodies: ReadonlyRequestBodiesMode = 'strip',
): ContextSpec =>
  ({
    output: {
      override: {
        formData: { arrayHandling: 'serialize', disabled: true },
        formUrlEncoded: true,
        namingConvention: {},
        enumGenerationType: 'const',
        preserveReadonlyRequestBodies,
        components: {
          schemas: { suffix: '', itemSuffix: 'Item' },
          responses: { suffix: '' },
          parameters: { suffix: '' },
          requestBodies: { suffix: 'Body' },
        },
      },
    },
    target: 'spec',
    workspace: '',
    spec: {
      openapi: '3.1.0',
      info: { title: 'Spec', version: '1.0.0' },
      paths: {},
      components: { schemas: {} },
    },
  }) as ContextSpec;

describe('deepObject encoding for url-encoded bodies (#3803)', () => {
  const context = createContext();

  it('generates bracketed keys for deepObject-style nested object properties', () => {
    const deepObjectBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  metadata: {
                    type: 'object',
                    properties: {
                      order_id: { type: 'string', example: '6735' },
                    },
                  },
                },
              },
              encoding: {
                metadata: {
                  style: 'deepObject',
                  explode: true,
                },
              },
            },
          },
        },
      ],
    ];

    const result = getResReqTypes(deepObjectBody, 'PostAccounts', context)[0];

    const formUrlEncoded = result.formUrlEncoded;
    expect(formUrlEncoded).toBeDefined();

    // Must generate bracketed key access, not JSON.stringify on the whole object
    expect(formUrlEncoded).toContain('metadata');
    expect(formUrlEncoded).toContain('Object.entries(');
    expect(formUrlEncoded).toContain('metadata[${k}]');
    expect(formUrlEncoded).not.toMatch(
      /append\(`metadata`,\s*postAccountsRequestBody\.metadata\)/,
    );
  });

  it('falls back to JSON.stringify when style is not deepObject', () => {
    const plainBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  metadata: {
                    type: 'object',
                    properties: {
                      order_id: { type: 'string' },
                    },
                  },
                },
              },
              encoding: {
                metadata: {
                  style: 'form',
                  explode: true,
                },
              },
            },
          },
        },
      ],
    ];

    const result = getResReqTypes(plainBody, 'PostAccounts', context)[0];

    const formUrlEncoded = result.formUrlEncoded;
    expect(formUrlEncoded).toBeDefined();

    // Non-deepObject should still use JSON.stringify
    expect(formUrlEncoded).toContain('JSON.stringify(');
  });

  it('falls back to JSON.stringify when no encoding is specified', () => {
    const noEncodingBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  metadata: {
                    type: 'object',
                    properties: {
                      order_id: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      ],
    ];

    const result = getResReqTypes(noEncodingBody, 'PostAccounts', context)[0];

    const formUrlEncoded = result.formUrlEncoded;
    expect(formUrlEncoded).toBeDefined();

    // No encoding → JSON.stringify on the object value
    expect(formUrlEncoded).toContain('JSON.stringify(');
  });

  it('handles deeply nested objects with deepObject style recursively', () => {
    const deepNestedBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  data: {
                    type: 'object',
                    properties: {
                      nested: {
                        type: 'object',
                        properties: {
                          value: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
              encoding: {
                data: {
                  style: 'deepObject',
                  explode: true,
                },
              },
            },
          },
        },
      ],
    ];

    const result = getResReqTypes(deepNestedBody, 'SubmitData', context)[0];

    const formUrlEncoded = result.formUrlEncoded;
    expect(formUrlEncoded).toBeDefined();

    // At top level, deepObject should generate Object.entries for the 'data' field
    expect(formUrlEncoded).toContain('Object.entries(');
    expect(formUrlEncoded).toContain('data[${k}]');
  });
});
