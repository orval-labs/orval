import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiResponseObject,
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
    expect(isBinaryContentType('*/*')).toBe(true); // Unknown type - using Blob for now since it handles both text and binary
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
      // Binary media key overrides schema to Blob (request)
      const binaryReq: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'application/octet-stream': { schema: { type: 'string' } },
            },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(binaryReq, 'Body', context)[0].value).toBe('Blob');

      // Binary media key overrides schema to Blob (response)
      const binaryRes: [string, OpenApiResponseObject][] = [
        [
          '200',
          {
            content: {
              'application/octet-stream': { schema: { type: 'string' } },
            },
          },
        ],
      ];
      expect(getResReqTypes(binaryRes, 'Response', context)[0].value).toBe(
        'Blob',
      );

      // Text/JSON media key ignores contentMediaType (request)
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

      // Text/JSON media key ignores contentMediaType (response)
      const jsonRes: [string, OpenApiResponseObject][] = [
        [
          '200',
          {
            content: {
              'application/json': {
                schema: { type: 'string', contentMediaType: 'image/png' },
              },
            },
          },
        ],
      ];
      expect(getResReqTypes(jsonRes, 'Response', context)[0].value).toBe(
        'string',
      );
    });

    it('wildcard */* media → Blob for both request and response', () => {
      // Wildcard accepts any content type, generates Blob
      const reqWithCmt: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              '*/*': {
                schema: { type: 'string', contentMediaType: '*/*' },
              },
            },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(reqWithCmt, 'Body', context)[0].value).toBe('Blob');

      // Response
      const resWithCmt: [string, OpenApiResponseObject][] = [
        [
          '200',
          {
            content: {
              '*/*': {
                schema: { type: 'string', contentMediaType: '*/*' },
              },
            },
          },
        ],
      ];
      expect(getResReqTypes(resWithCmt, 'Response', context)[0].value).toBe(
        'Blob',
      );
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
                  cmtText: {
                    type: 'string',
                    contentMediaType: 'application/xml',
                  },
                  encOverride: {
                    type: 'string',
                    contentMediaType: 'image/png',
                  },
                  formatBinary: { type: 'string', format: 'binary' },
                  base64Field: {
                    type: 'string',
                    contentMediaType: 'image/png',
                    contentEncoding: 'base64',
                  },
                  metadata: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                  wildcardFile: { type: 'string', contentMediaType: '*/*' },
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
                  'wildcardFile',
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

    it('generates correct types and FormData for all content type combinations', () => {
      const result = getResReqTypes(reqBody, 'Body', context)[0];

      // The value should be the type alias name (not inline type)
      // This ensures consistent behavior with resolveObject
      expect(result.value).toBe('BodyRequestBody');

      // The schema should contain the type definition with the inline type
      // encBinary/cmtBinary/formatBinary/wildcardFile: Blob (binary)
      // encText/cmtText/encOverride: Blob | string (text file)
      // base64Field: string (contentEncoding means not a file)
      // metadata: object (named type)
      const bodySchema = result.schemas.find(
        (s) => s.name === 'BodyRequestBody',
      );
      expect(bodySchema).toBeDefined();
      expect(bodySchema?.model).toContain('export type BodyRequestBody = {');
      expect(bodySchema?.model).toContain('encBinary: Blob;');
      expect(bodySchema?.model).toContain('encText: Blob | string;');
      expect(bodySchema?.model).toContain('cmtBinary: Blob;');
      expect(bodySchema?.model).toContain('cmtText: Blob | string;');
      expect(bodySchema?.model).toContain('encOverride: Blob | string;');
      expect(bodySchema?.model).toContain('formatBinary: Blob;');
      expect(bodySchema?.model).toContain('base64Field: string;');
      expect(bodySchema?.model).toContain('metadata: BodyRequestBodyMetadata;');
      expect(bodySchema?.model).toContain('wildcardFile: Blob;');

      expect(result.formData).toBe(`const formData = new FormData();
formData.append(\`encBinary\`, bodyRequestBody.encBinary);
formData.append(\`encText\`, bodyRequestBody.encText instanceof Blob ? bodyRequestBody.encText : new Blob([bodyRequestBody.encText], { type: 'text/plain' }));
formData.append(\`cmtBinary\`, bodyRequestBody.cmtBinary);
formData.append(\`cmtText\`, bodyRequestBody.cmtText instanceof Blob ? bodyRequestBody.cmtText : new Blob([bodyRequestBody.cmtText], { type: 'application/xml' }));
formData.append(\`encOverride\`, bodyRequestBody.encOverride instanceof Blob ? bodyRequestBody.encOverride : new Blob([bodyRequestBody.encOverride], { type: 'text/csv' }));
formData.append(\`formatBinary\`, bodyRequestBody.formatBinary);
formData.append(\`base64Field\`, bodyRequestBody.base64Field);
formData.append(\`metadata\`, new Blob([JSON.stringify(bodyRequestBody.metadata)], { type: 'application/json' }));
formData.append(\`wildcardFile\`, bodyRequestBody.wildcardFile);
`);
    });
  });
});
