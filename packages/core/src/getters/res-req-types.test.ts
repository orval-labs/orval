import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  OpenApiReferenceObject,
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

const context = {
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
} as unknown as ContextSpec;

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
    const formData = types[0].formData;
    if (!formData || !isString(formData)) {
      throw new Error('Expected formData to be a defined string');
    }
    const formDataCode = formData;
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
    expect(isBinaryContentType('application/pdf')).toBe(true);
    expect(isBinaryContentType('application/zip')).toBe(true);
    expect(isBinaryContentType('image/png')).toBe(true);
    expect(isBinaryContentType('image/jpeg')).toBe(true);
    expect(isBinaryContentType('audio/mp3')).toBe(true);
    expect(isBinaryContentType('video/mp4')).toBe(true);
  });

  it('should return false for non-binary content types', () => {
    expect(isBinaryContentType('application/json')).toBe(false);
    expect(isBinaryContentType('text/plain')).toBe(false);
    expect(isBinaryContentType('text/html')).toBe(false);
    expect(isBinaryContentType('application/vnd.api+json')).toBe(false);
    expect(isBinaryContentType('application/xml')).toBe(false);
    expect(isBinaryContentType('*/*')).toBe(false);
  });

  it('should strip MIME type parameters before checking', () => {
    expect(isBinaryContentType('application/json; charset=utf-8')).toBe(false);
  });
});

describe('getResReqTypes (content type handling)', () => {
  describe('content type precedence (type generation)', () => {
    it('known binary content type overrides schema to Blob', () => {
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
    });

    it('non-binary content type uses schema type', () => {
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

    it('wildcard */* content type uses schema type', () => {
      const reqWithCmt: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              '*/*': {
                schema: { type: 'string' },
              },
            },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(reqWithCmt, 'Body', context)[0].value).toBe(
        'string',
      );

      // Response
      const resWithCmt: [string, OpenApiResponseObject][] = [
        [
          '200',
          {
            content: {
              '*/*': {
                schema: { type: 'string' },
              },
            },
          },
        ],
      ];
      expect(getResReqTypes(resWithCmt, 'Response', context)[0].value).toBe(
        'string',
      );
    });

    it('wildcard */* with object schema uses schema type', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              UserProfile: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string' },
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
              '*/*': {
                schema: { $ref: '#/components/schemas/UserProfile' },
              },
            },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(reqBody, 'Body', ctx)[0].value).toBe('UserProfile');

      const responses: [string, OpenApiResponseObject][] = [
        [
          '200',
          {
            content: {
              '*/*': {
                schema: { $ref: '#/components/schemas/UserProfile' },
              },
            },
          },
        ],
      ];
      expect(getResReqTypes(responses, 'GetUserProfile', ctx)[0].value).toBe(
        'UserProfile',
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
                  // wildcard → Blob | string (text file, not binary)
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
      expect(bodySchema?.model).toContain('wildcardFile: Blob | string;');

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
formData.append(\`metadata\`, JSON.stringify(bodyRequestBody.metadata));
formData.append(\`wildcardFile\`, bodyRequestBody.wildcardFile instanceof Blob ? bodyRequestBody.wildcardFile : new Blob([bodyRequestBody.wildcardFile], { type: '*/*' }));
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

    // Regression tests for #3242: multipart/form-data with oneOf/anyOf
    // at the root of a request body (common with @nestjs/swagger or
    // zod-to-openapi for versioned request schemas).
    it('oneOf with a single $ref: FormData variable derives from the DTO name', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              ClientUpdateDto: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  logo: { type: 'string', format: 'binary' },
                },
                required: ['name', 'logo'],
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
                  oneOf: [{ $ref: '#/components/schemas/ClientUpdateDto' }],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // Without the fix, effectivePropName fell back to the controller-derived
      // name and the generated code referenced a variable that was never
      // declared (e.g. uploadRequestBody).
      expect(formData).toContain('clientUpdateDto');
      expect(formData).not.toContain('uploadRequestBody');
    });

    it('oneOf with 2 $refs: FormData uses a runtime Object.entries loop', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              UploadDtoV1: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  metadata: { type: 'string' },
                },
                required: ['file'],
              },
              UploadDtoV2: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                  metadata: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                  },
                },
                required: ['file'],
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
                  oneOf: [
                    { $ref: '#/components/schemas/UploadDtoV1' },
                    { $ref: '#/components/schemas/UploadDtoV2' },
                  ],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // Shared fields used to be appended once per variant because TypeScript
      // casts are erased at runtime. The runtime loop appends each key once.
      expect(formData).toContain('Object.entries(');
      expect(formData).not.toMatch(/as UploadDtoV[12]/);
      // Guard against a future refactor reintroducing the per-variant
      // appends keyed off the shared field.
      expect(formData).not.toContain('uploadDtoV1.file');
      expect(formData).not.toContain('uploadDtoV2.file');

      // Variant types are still imported so they remain referenceable.
      const importNames = result.imports.map((i) => i.name);
      expect(importNames).toContain('UploadDtoV1');
      expect(importNames).toContain('UploadDtoV2');
    });

    it('allOf: FormData still emits per-field appends (no regression)', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              BaseDto: {
                type: 'object',
                properties: { name: { type: 'string' } },
                required: ['name'],
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
                  allOf: [
                    { $ref: '#/components/schemas/BaseDto' },
                    {
                      type: 'object',
                      properties: {
                        logo: { type: 'string', format: 'binary' },
                      },
                      required: ['logo'],
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
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      expect(formData).not.toContain('Object.entries(');
      expect(formData).toContain(
        'formData.append(`name`, uploadRequestBody.name)',
      );
      expect(formData).toContain(
        'formData.append(`logo`, uploadRequestBody.logo)',
      );
    });

    it('oneOf alongside direct properties: loop skips direct keys to avoid duplicate appends', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              VariantA: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['a'] },
                  extraA: { type: 'string' },
                },
                required: ['kind'],
              },
              VariantB: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['b'] },
                  extraB: { type: 'string' },
                },
                required: ['kind'],
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
                  type: 'object',
                  oneOf: [
                    { $ref: '#/components/schemas/VariantA' },
                    { $ref: '#/components/schemas/VariantB' },
                  ],
                  properties: {
                    name: { type: 'string' },
                    owner: { type: 'string' },
                  },
                  required: ['name'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // The Object.entries loop skips keys that the direct-properties branch
      // already appends (`name`, `owner`), so those fields are not appended
      // twice at runtime.
      expect(formData).toContain('Object.entries(');
      expect(formData).toContain('["name", "owner"].includes(key)');
      const nameAppendCount = (
        formData.match(/formData\.append\(`name`/g) ?? []
      ).length;
      const ownerAppendCount = (
        formData.match(/formData\.append\(`owner`/g) ?? []
      ).length;
      expect(nameAppendCount).toBe(1);
      expect(ownerAppendCount).toBe(1);
    });

    it('oneOf with an optional body: FormData guards against undefined', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              OptionalBodyDto: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
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
                  oneOf: [{ $ref: '#/components/schemas/OptionalBodyDto' }],
                },
              },
            },
            required: false,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // The runtime loop must defend against an undefined body so callers can
      // safely pass nothing when the body is optional.
      expect(formData).toMatch(/Object\.entries\([^)]*\?\?\s*\{\}\)/);
    });

    it('oneOf with an array of binary files: FormData appends Blob items directly', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              MultiUploadV1: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                },
              },
              MultiUploadV2: {
                type: 'object',
                properties: {
                  files: {
                    type: 'array',
                    items: { type: 'string', format: 'binary' },
                  },
                  tag: { type: 'string' },
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
                  oneOf: [
                    { $ref: '#/components/schemas/MultiUploadV1' },
                    { $ref: '#/components/schemas/MultiUploadV2' },
                  ],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'Upload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // Array elements that are files must be appended directly. Without the
      // per-element Blob/File/Buffer check, each binary item would have been
      // serialized to "{}" via JSON.stringify.
      expect(formData).toContain('value.forEach');
      expect(formData).toContain('v instanceof Blob');
    });
  });
});

describe('getResReqTypes ($ref response without content)', () => {
  it('should not crash when a $ref response has no content property', () => {
    const ctxWithResponses: ContextSpec = {
      ...context,
      spec: {
        components: {
          schemas: {},
          responses: {
            OK: {
              description: 'OK',
            },
          },
        },
      },
    };

    const responses: [
      string,
      OpenApiReferenceObject | OpenApiResponseObject,
    ][] = [['200', { $ref: '#/components/responses/OK' }]];

    const result = getResReqTypes(responses, 'Response', ctxWithResponses);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe('Ok');
    expect(result[0].isRef).toBe(true);
    expect(result[0].originalSchema).toBeUndefined();
  });
});
