import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiRequestBodyObject,
  OpenApiResponseObject,
  OpenApiSchemaObject,
} from '../types';
import { isString } from '../utils';
import { isBinaryContentType } from '../utils/content-type';
import { getResReqTypes } from './res-req-types';

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
      namingConvention: {},
      components: {
        schemas: { suffix: '', itemSuffix: 'Item' },
        responses: { suffix: '' },
        parameters: { suffix: '' },
        requestBodies: { suffix: 'RequestBody' },
      },
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
    expect(isString(types[0].formData)).toBe(true);
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
    // Context with $ref schemas
    const ctxWithSchemas: ContextSpec = {
      ...context,
      spec: {
        components: {
          schemas: {
            FileUpload: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  contentMediaType: 'application/octet-stream',
                },
              },
            },
          },
        },
      },
    };

    // Comprehensive schema covering: encoding, contentMediaType, format binary,
    // base64, object fields, wildcard, arrays, nested properties, $ref
    const reqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  // encoding.contentType → Blob (binary)
                  encBinary: { type: 'string' },
                  // encoding.contentType → Blob | string (text)
                  encText: { type: 'string' },
                  // contentMediaType → Blob (binary)
                  cmtBinary: { type: 'string', contentMediaType: 'image/png' },
                  // contentMediaType → Blob | string (text)
                  cmtText: {
                    type: 'string',
                    contentMediaType: 'application/xml',
                  },
                  // encoding overrides contentMediaType: image/png → text/csv
                  encOverride: {
                    type: 'string',
                    contentMediaType: 'image/png',
                  },
                  // format: binary → Blob
                  formatBinary: { type: 'string', format: 'binary' },
                  // contentEncoding means base64 string, not file
                  base64Field: {
                    type: 'string',
                    contentMediaType: 'image/png',
                    contentEncoding: 'base64',
                  },
                  // Object field with nested contentMediaType (should be ignored - JSON)
                  metadata: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      // Nested contentMediaType should NOT make this Blob
                      thumbnailData: {
                        type: 'string',
                        contentMediaType: 'image/png',
                      },
                    },
                  },
                  // wildcard → Blob
                  wildcardFile: { type: 'string', contentMediaType: '*/*' },
                  // Array of files → Blob[]
                  photos: {
                    type: 'array',
                    items: {
                      type: 'string',
                      contentMediaType: 'application/octet-stream',
                    },
                  },
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
                  'photos',
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

    it('generates correct types for all content type combinations', () => {
      const result = getResReqTypes(reqBody, 'Body', context)[0];

      expect(result.value).toBe('BodyRequestBody');

      const bodySchema = result.schemas.find(
        (s) => s.name === 'BodyRequestBody',
      );
      expect(bodySchema).toBeDefined();
      expect(bodySchema?.model).toContain('export type BodyRequestBody = {');

      // Binary files → Blob
      expect(bodySchema?.model).toContain('encBinary: Blob;');
      expect(bodySchema?.model).toContain('cmtBinary: Blob;');
      expect(bodySchema?.model).toContain('formatBinary: Blob;');
      expect(bodySchema?.model).toContain('wildcardFile: Blob;');

      // Text files → Blob | string
      expect(bodySchema?.model).toContain('encText: Blob | string;');
      expect(bodySchema?.model).toContain('cmtText: Blob | string;');
      expect(bodySchema?.model).toContain('encOverride: Blob | string;'); // encoding precedence

      // base64 encoded → string (not file)
      expect(bodySchema?.model).toContain('base64Field: string;');

      // Object field → named type
      expect(bodySchema?.model).toContain('metadata: BodyRequestBodyMetadata;');

      // Array of files → Blob[]
      expect(bodySchema?.model).toContain('photos: Blob[];');

      // Nested contentMediaType should be ignored (JSON serialization)
      const metadataSchema = result.schemas.find(
        (s) => s.name === 'BodyRequestBodyMetadata',
      );
      expect(metadataSchema?.model).toContain('thumbnailData?: string;');
      expect(metadataSchema?.model).not.toContain('Blob');
    });

    it('generates correct FormData append code', () => {
      const result = getResReqTypes(reqBody, 'Body', context)[0];

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
bodyRequestBody.photos.forEach(value => formData.append(\`photos\`, value));
`);
    });

    it('$ref schema uses schema name for formData variable', () => {
      const refReqBody: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'multipart/form-data': {
                schema: { $ref: '#/components/schemas/FileUpload' },
              },
            },
          },
        ],
      ];

      const result = getResReqTypes(refReqBody, 'Upload', ctxWithSchemas)[0];

      // Schema name 'FileUpload' → param 'fileUpload' (not 'uploadRequestBody')
      expect(result.formData).toContain('fileUpload.file');
    });
  });

  describe('FormData with schema composition (oneOf/anyOf/allOf)', () => {
    // Covers: anyOf at root, nested oneOf, allOf with $ref (#2873)
    it('anyOf at root with scalar, array, oneOf, and allOf branches', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              ClientUpdateDto: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
              },
            },
          },
        },
      };

      const reqBody: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'multipart/form-data': {
                schema: {
                  anyOf: [
                    {
                      type: 'object',
                      properties: {
                        // Scalar file field
                        avatar: {
                          type: 'string',
                          contentMediaType: 'image/png',
                        },
                        // Field that can be single file or array (nested oneOf)
                        fileOrFiles: {
                          oneOf: [
                            { type: 'string', contentMediaType: 'image/png' },
                            {
                              type: 'array',
                              items: {
                                type: 'string',
                                contentMediaType: 'image/png',
                              },
                            },
                          ],
                        },
                        // Array of oneOf files
                        mixedFiles: {
                          type: 'array',
                          items: {
                            oneOf: [
                              { type: 'string', contentMediaType: 'image/png' },
                              {
                                type: 'string',
                                contentMediaType: 'application/pdf',
                              },
                            ],
                          },
                        },
                      },
                    },
                    {
                      type: 'object',
                      properties: {
                        // Array of files
                        documents: {
                          type: 'array',
                          items: {
                            type: 'string',
                            contentMediaType: 'application/pdf',
                          },
                        },
                      },
                    },
                    // allOf with $ref (#2873)
                    {
                      allOf: [
                        { $ref: '#/components/schemas/ClientUpdateDto' },
                        {
                          type: 'object',
                          properties: {
                            logo: {
                              type: 'string',
                              contentMediaType: 'application/octet-stream',
                            },
                          },
                        },
                      ],
                    },
                  ],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const schema = result.schemas.find((s) => s.name === 'UploadRequestBody');

      // Result references the schema type
      expect(result.value).toBe('UploadRequestBody');

      // File fields → Blob (not string)
      expect(schema?.model).toContain('avatar?: Blob');
      expect(schema?.model).toContain('fileOrFiles?: Blob | Blob[]');
      expect(schema?.model).toContain('mixedFiles?: Blob[]'); // array of oneOf
      expect(schema?.model).toContain('documents?: Blob[]');
      expect(schema?.model).toContain('logo?: Blob'); // allOf branch (#2873)

      // allOf with $ref: intersection type (not union)
      expect(schema?.model).toContain('ClientUpdateDto & {');
    });
  });
});
