import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiSchemaObject,
} from '../types';
import { getResReqTypes, isBinaryContentType } from './res-req-types';

// Simulates an OpenAPI schema with a readOnly property
const schemaWithReadOnly: OpenApiSchemaObject = {
  type: 'object',
  properties: {
    id: { type: 'integer', readOnly: true },
    file: { type: 'string', format: 'binary' },
    kind: { type: 'string', enum: ['LOGO', 'CONTENT'] },
  },
  required: ['file'],
};

const context: ContextSpec = {
  output: {
    override: {
      formData: { arrayHandling: 'serialize', disabled: false },
      enumGenerationType: 'const',
    },
  },
  target: 'spec',
  workspace: '',
  spec: {
    components: { schemas: {} },
  },
};

describe('getResReqTypes (formData, readOnly property)', () => {
  it('should not include readOnly properties in the generated formData', () => {
    const reqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'multipart/form-data': {
              schema: schemaWithReadOnly,
            },
          },
          required: true,
        },
      ],
    ];
    const types = getResReqTypes(reqBody, 'UploadBody', context);
    // Get the generated code for formData
    expect(types[0]).toBeDefined();
    expect(typeof types[0].formData).toBe('string');
    const formDataCode = types[0].formData!;
    // Verify that the readOnly property "id" is NOT present in the generated code
    expect(formDataCode).not.toContain('id');
    // Verify that the non-readOnly fields are present
    expect(formDataCode).toContain('file');
    expect(formDataCode).toContain('kind');
  });
});

describe('isBinaryContentType', () => {
  it('should return true for binary content types', () => {
    expect(isBinaryContentType('application/octet-stream')).toBe(true);
    expect(isBinaryContentType('image/png')).toBe(true);
    expect(isBinaryContentType('image/jpeg')).toBe(true);
    expect(isBinaryContentType('audio/mp3')).toBe(true);
    expect(isBinaryContentType('video/mp4')).toBe(true);
  });

  it('should return false for text-based content types', () => {
    expect(isBinaryContentType('application/json')).toBe(false);
    expect(isBinaryContentType('text/plain')).toBe(false);
    expect(isBinaryContentType('text/html')).toBe(false);
    expect(isBinaryContentType('application/vnd.api+json')).toBe(false);
    expect(isBinaryContentType('application/xml')).toBe(false);
  });
});

describe('getResReqTypes (content type handling)', () => {
  describe('media key precedence (type generation)', () => {
    it('binary media key → Blob; text/JSON media key ignores contentMediaType', () => {
      // Binary media key overrides schema to Blob
      const binaryReq: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: { 'application/octet-stream': { schema: { type: 'string' } } },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(binaryReq, 'Body', context)[0].value).toBe('Blob');

      // Text/JSON media key ignores contentMediaType (stays string)
      const jsonReq: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'application/json': {
                schema: { type: 'string', contentMediaType: 'image/png' },
              },
            },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(jsonReq, 'Body', context)[0].value).toBe('string');
    });
  });

  describe('FormData generation (comprehensive)', () => {
    // One schema covering all content type combinations
    const reqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  encBinary: { type: 'string' },
                  encText: { type: 'string' },
                  cmtBinary: { type: 'string', contentMediaType: 'image/png' },
                  cmtText: { type: 'string', contentMediaType: 'application/xml' },
                  encOverride: { type: 'string', contentMediaType: 'image/png' },
                  formatBinary: { type: 'string', format: 'binary' },
                  base64Field: {
                    type: 'string',
                    contentMediaType: 'image/png',
                    contentEncoding: 'base64',
                  },
                  metadata: { type: 'object', properties: { name: { type: 'string' } } },
                },
                required: [
                  'encBinary',
                  'encText',
                  'cmtBinary',
                  'cmtText',
                  'encOverride',
                  'formatBinary',
                  'base64Field',
                  'metadata',
                ],
              },
              encoding: {
                encBinary: { contentType: 'image/png' },
                encText: { contentType: 'text/plain' },
                encOverride: { contentType: 'text/csv' },
                metadata: { contentType: 'application/json' },
              },
            },
          },
          required: true,
        },
      ],
    ];

    it('generates correct FormData code for all content type combinations', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData;
      expect(formData).toBe(`const formData = new FormData();
formData.append(\`encBinary\`, bodyRequestBody.encBinary);
formData.append(\`encText\`, bodyRequestBody.encText instanceof Blob ? bodyRequestBody.encText : new Blob([bodyRequestBody.encText], { type: 'text/plain' }));
formData.append(\`cmtBinary\`, bodyRequestBody.cmtBinary);
formData.append(\`cmtText\`, bodyRequestBody.cmtText instanceof Blob ? bodyRequestBody.cmtText : new Blob([bodyRequestBody.cmtText], { type: 'application/xml' }));
formData.append(\`encOverride\`, bodyRequestBody.encOverride instanceof Blob ? bodyRequestBody.encOverride : new Blob([bodyRequestBody.encOverride], { type: 'text/csv' }));
formData.append(\`formatBinary\`, bodyRequestBody.formatBinary);
formData.append(\`base64Field\`, bodyRequestBody.base64Field);
formData.append(\`metadata\`, new Blob([JSON.stringify(bodyRequestBody.metadata)], { type: 'application/json' }));
`);
    });
  });
});
