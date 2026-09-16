import { describe, expect, it } from 'vite-plus/test';

import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OpenApiResponseObject,
  OpenApiSchemaObject,
} from '../types';
import { isString } from '../utils';
import { isBinaryContentType } from '../utils/content-type';
import {
  collectPropertiesThroughAllOf,
  collectRequiredThroughAllOf,
  getResReqTypes,
  isEffectivelyObjectSchema,
} from './res-req-types';

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

      // Binary files → Blob | File (filename preserved in multipart, #3662)
      expect(bodySchema?.model).toContain('encBinary: Blob | File;');
      expect(bodySchema?.model).toContain('cmtBinary: Blob | File;');
      expect(bodySchema?.model).toContain('formatBinary: Blob | File;');
      expect(bodySchema?.model).toContain(
        'wildcardFile: Blob | File | string;',
      );

      // Text files → Blob | File | string
      expect(bodySchema?.model).toContain('encText: Blob | File | string;');
      expect(bodySchema?.model).toContain('cmtText: Blob | File | string;');
      expect(bodySchema?.model).toContain('encOverride: Blob | File | string;'); // encoding precedence

      // base64 encoded → string (not file)
      expect(bodySchema?.model).toContain('base64Field: string;');

      // Object field → named type
      expect(bodySchema?.model).toContain('metadata: BodyRequestBodyMetadata;');

      // Array of files → (Blob | File)[]
      expect(bodySchema?.model).toContain('photos: (Blob | File)[];');

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

  // application/x-www-form-urlencoded is a text-only serialization built with
  // URLSearchParams, whose append() only accepts strings. Binary fields must
  // therefore be typed and appended as strings, not Blob (#1624).
  describe('x-www-form-urlencoded with binary fields (#1624)', () => {
    const urlEncodedReqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'application/x-www-form-urlencoded': {
              schema: {
                type: 'object',
                properties: {
                  // format: binary → would be Blob under multipart
                  content_file: { type: 'string', format: 'binary' },
                  // contentMediaType text file → Blob | string under multipart
                  content_xml: {
                    type: 'string',
                    contentMediaType: 'application/xml',
                  },
                  content_string: { type: 'string' },
                  // enum unions must survive the url-encoded handling
                  kind: { type: 'string', enum: ['LOGO', 'CONTENT'] },
                },
              },
            },
          },
          required: true,
        },
      ],
    ];

    it('types binary and file url-encoded fields as string, not Blob', () => {
      const result = getResReqTypes(urlEncodedReqBody, 'Asset', context)[0];

      const bodySchema = result.schemas.find(
        (s) => s.name === 'AssetRequestBody',
      );
      expect(bodySchema).toBeDefined();
      expect(bodySchema?.model).toContain('content_file?: string;');
      expect(bodySchema?.model).toContain('content_xml?: string;');
      expect(bodySchema?.model).not.toContain('Blob');
    });

    it('preserves enum unions on url-encoded string fields', () => {
      const result = getResReqTypes(urlEncodedReqBody, 'Asset', context)[0];

      // url-encoded handling must not flatten enums down to `string`: the enum
      // is still extracted to its own type with the literal union intact.
      const bodySchema = result.schemas.find(
        (s) => s.name === 'AssetRequestBody',
      );
      expect(bodySchema?.model).toContain('kind?: AssetRequestBodyKind;');
      expect(bodySchema?.model).not.toContain('kind?: string;');

      const kindSchema = result.schemas.find(
        (s) => s.name === 'AssetRequestBodyKind',
      );
      expect(kindSchema?.model).toContain("'LOGO'");
      expect(kindSchema?.model).toContain("'CONTENT'");
    });

    it('appends binary and file url-encoded fields directly as strings', () => {
      const result = getResReqTypes(urlEncodedReqBody, 'Asset', context)[0];

      expect(result.formUrlEncoded).toContain(
        'formUrlEncoded.append(`content_file`, assetRequestBody.content_file)',
      );
      expect(result.formUrlEncoded).toContain(
        'formUrlEncoded.append(`content_xml`, assetRequestBody.content_xml)',
      );
      expect(result.formUrlEncoded).not.toContain('Blob');
    });

    it('generates forEach for nullable array property (type: ["array","null"] — post-3.1 upgrade)', () => {
      // After @scalar/openapi-upgrader converts a 3.0 spec, nullable arrays
      // become `type: ["array", "null"]`. The type check must handle arrays.
      const reqBodyNullableArray: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  type: 'object',
                  required: ['petId'],
                  properties: {
                    petId: { type: 'string' },
                    tags: {
                      type: ['array', 'null'] as unknown as 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        required: ['tagId', 'label'],
                        properties: {
                          tagId: { type: 'string' },
                          label: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(
        reqBodyNullableArray,
        'UpdatePet',
        context,
      )[0];

      const formUrlEncoded = result.formUrlEncoded;
      if (!formUrlEncoded || !isString(formUrlEncoded)) {
        throw new Error('Expected formUrlEncoded to be a defined string');
      }

      // Must generate a forEach loop, not a bare append of the whole array
      expect(formUrlEncoded).toContain('forEach');
      expect(formUrlEncoded).not.toMatch(
        /append\(`tags`,\s*updatePetRequestBody\.tags\)/,
      );
    });

    it('uses a string-only runtime loop for oneOf/anyOf url-encoded bodies', () => {
      const oneOfReqBody: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'application/x-www-form-urlencoded': {
                schema: {
                  oneOf: [
                    {
                      type: 'object',
                      properties: {
                        content_file: { type: 'string', format: 'binary' },
                      },
                    },
                    {
                      type: 'object',
                      properties: { other: { type: 'string' } },
                    },
                  ],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(oneOfReqBody, 'Asset', context)[0];

      // URLSearchParams holds strings only — no File/Blob/Buffer branches
      expect(result.formUrlEncoded).toContain('formUrlEncoded.append(key,');
      expect(result.formUrlEncoded).not.toContain('Blob');
      expect(result.formUrlEncoded).not.toContain('Buffer');
      expect(result.formUrlEncoded).not.toContain('instanceof File');
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

      // File fields → Blob | File (filename preserved in multipart, #3662)
      expect(schema?.model).toContain('avatar?: Blob | File');
      expect(schema?.model).toContain(
        'fileOrFiles?: Blob | File | (Blob | File)[]',
      );
      expect(schema?.model).toContain('mixedFiles?: (Blob | File)[]'); // array of oneOf
      expect(schema?.model).toContain('documents?: (Blob | File)[]');
      expect(schema?.model).toContain('logo?: Blob | File'); // allOf branch (#2873)

      // allOf with $ref: intersection type (not union)
      expect(schema?.model).toContain('ClientUpdateDto & ({');
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

    it('nested allOf property ($ref -> allOf -> $ref -> allOf, no explicit type: object): still JSON.stringifies the field', () => {
      // Reproduces a real-world case: a multipart field ("a") whose
      // schema is a $ref to a wrapper that itself is only `allOf: [$ref]`
      // one level deeper than the already-covered "allOf: FormData still
      // emits per-field appends" case above.
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              C: {
                type: 'object',
                properties: { title: { type: 'string' } },
                required: ['title'],
              },
              // No explicit `type: object` here
              B: {
                allOf: [{ $ref: '#/components/schemas/C' }],
              },
              // Same: no explicit `type: object`, just wraps B.
              A: {
                allOf: [{ $ref: '#/components/schemas/B' }],
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
                  properties: {
                    a: { $ref: '#/components/schemas/A' },
                  },
                  required: ['a'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreateA', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      expect(formData).toContain(
        'formData.append(`a`, JSON.stringify(createARequestBody.a))',
      );
      expect(formData).not.toContain(
        'formData.append(`a`, createARequestBody.a);',
      );
    });

    it('nested allOf property ($ref -> allOf -> $ref -> allOf string): doesnt JSON.stringifies the field', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              C: { type: 'string' },
              // No explicit `type: object` here
              B: {
                allOf: [{ $ref: '#/components/schemas/C' }],
              },
              // Same: no explicit `type: object`, just wraps B.
              A: {
                allOf: [{ $ref: '#/components/schemas/B' }],
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
                  properties: {
                    a: { $ref: '#/components/schemas/A' },
                  },
                  required: ['a'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreateA', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      expect(formData).toContain('formData.append(`a`, createARequestBody.a);');
      expect(formData).not.toContain('JSON.stringify(createARequestBody.a)');
    });

    it('array property whose items are a pure allOf wrapper (no explicit type: object): JSON.stringifies each item', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              Tag: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
              // No explicit `type: object`, only an allOf wrapper.
              TagRef: {
                allOf: [{ $ref: '#/components/schemas/Tag' }],
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
                  properties: {
                    tags: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TagRef' },
                    },
                  },
                  required: ['tags'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreateTags', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      expect(formData).toContain(
        'createTagsRequestBody.tags.forEach(value => formData.append(`tags`, JSON.stringify(value)));',
      );
    });

    it('array property whose items are a pure allOf wrapper, EXPLODE arrayHandling: appends the nested item properties', () => {
      const ctx: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            formData: { arrayHandling: 'explode', disabled: false },
          },
        },
        spec: {
          components: {
            schemas: {
              Tag: {
                type: 'object',
                properties: { name: { type: 'string' } },
              },
              TagRef: {
                allOf: [{ $ref: '#/components/schemas/Tag' }],
              },
            },
          },
        },
      } as unknown as ContextSpec;

      const reqBody: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    tags: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/TagRef' },
                    },
                  },
                  required: ['tags'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreateTags', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      expect(formData).toContain('formData.append(`tags[${index}].name`');
      expect(formData).not.toContain(
        'formData.append(`tags[${index}]`, value)',
      );
    });

    it('allOf wrapping a non-object schema: must not JSON.stringify a scalar value', () => {
      const ctx: ContextSpec = {
        ...context,
        spec: {
          components: {
            schemas: {
              StringLeaf: { type: 'string' },
              // No explicit `type: string` here — purely a composition
              // wrapper around a scalar, same shape as the object wrapper
              // case above, but resolving to a non-object.
              WrappedString: {
                allOf: [{ $ref: '#/components/schemas/StringLeaf' }],
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
                  properties: {
                    note: { $ref: '#/components/schemas/WrappedString' },
                  },
                  required: ['note'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreateNote', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // The resolved schema is a string, so the raw value must be appended
      // as-is — never JSON.stringify'd, which would wire up `"foo"`
      // (quoted) instead of `foo`.
      expect(formData).toContain(
        'formData.append(`note`, createNoteRequestBody.note);',
      );
      expect(formData).not.toContain(
        'JSON.stringify(createNoteRequestBody.note)',
      );
    });

    it('allOf-wrapped object with EXPLODE arrayHandling: nested properties behind allOf must still be appended', () => {
      // Review note: "For an object wrapper with EXPLODE, recursion reads
      // only direct properties. The wrapper has none, so no multipart
      // field is appended." Even once object-detection correctly resolves
      // through allOf, the EXPLODE recursion branch
      // (resolveSchemaPropertiesToFormData -> getSchemaProperties(schema))
      // must also traverse into the allOf branches to find the actual
      // properties — a wrapper schema that is *only* `allOf: [$ref]` has
      // no properties of its own, so naively recursing on it directly
      // silently drops the whole field instead of emitting its nested keys.
      const ctx: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            formData: { arrayHandling: 'explode', disabled: false },
          },
        },
        spec: {
          components: {
            schemas: {
              Leaf: {
                type: 'object',
                properties: { x: { type: 'string' } },
                required: ['x'],
              },
              // No own `properties` or `type: object` — the only way to
              // reach `x` is by resolving through `allOf`.
              WrapperNoOwnProps: {
                allOf: [{ $ref: '#/components/schemas/Leaf' }],
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
                  properties: {
                    payload: {
                      $ref: '#/components/schemas/WrapperNoOwnProps',
                    },
                  },
                  required: ['payload'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreatePayload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // `x` is required on `Leaf`, and that required-ness must survive
      // being merged through the allOf wrapper too — otherwise it's
      // wrongly emitted behind an `if (... !== undefined)` guard.
      expect(formData).toContain(
        'formData.append(`payload.x`, createPayloadRequestBody.payload.x);',
      );
      expect(formData).not.toContain('!== undefined');
    });

    it('allOf-wrapped object with EXPLODE arrayHandling: properties across a multi-level allOf chain must all be appended', () => {
      // Mirrors the real fixture that surfaced this exact bug in
      // production (AllOfPet -> Pet -> NestedPet -> DoublyNestedPet,
      // tests/specifications/all-of.yaml): a chain of THREE pure allOf
      // wrapper hops, each contributing its own properties (some via
      // their own allOf member, some directly), plus a mix of required
      // and optional fields at different levels. The single-hop EXPLODE
      // test above doesn't exercise recursion depth or required-merging
      // together; this one does, for the arrayHandling mode most likely
      // to expose a shallow (non-recursive) properties/required read.
      const ctx: ContextSpec = {
        ...context,
        output: {
          ...context.output,
          override: {
            ...context.output.override,
            formData: { arrayHandling: 'explode', disabled: false },
          },
        },
        spec: {
          components: {
            schemas: {
              DoublyNestedLeaf: {
                type: 'object',
                properties: { doubleNest: { type: 'number' } },
              },
              // Level 2: own `nest` (optional) + allOf-inherited `doubleNest`.
              NestedWrapper: {
                allOf: [
                  { $ref: '#/components/schemas/DoublyNestedLeaf' },
                  { type: 'object', properties: { nest: { type: 'number' } } },
                ],
              },
              // Level 1: own `id`/`name` (required) + everything inherited
              // from NestedWrapper (nest, doubleNest).
              MidWrapper: {
                allOf: [
                  { $ref: '#/components/schemas/NestedWrapper' },
                  {
                    type: 'object',
                    required: ['id', 'name'],
                    properties: {
                      id: { type: 'integer' },
                      name: { type: 'string' },
                    },
                  },
                ],
              },
              PetDetailLeaf: {
                type: 'object',
                required: ['tag'],
                properties: { tag: { type: 'string' } },
              },
              // Root: pure allOf wrapper, no own properties at all —
              // everything comes from two further levels of composition.
              AllOfPayload: {
                allOf: [
                  { $ref: '#/components/schemas/MidWrapper' },
                  { $ref: '#/components/schemas/PetDetailLeaf' },
                ],
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
                  properties: {
                    payload: { $ref: '#/components/schemas/AllOfPayload' },
                  },
                  required: ['payload'],
                },
              },
            },
            required: true,
          },
        ],
      ];

      const result = getResReqTypes(reqBody, 'CreatePayload', ctx)[0];
      const formData = result.formData;
      if (!formData || !isString(formData)) {
        throw new Error('Expected formData to be a defined string');
      }

      // Optional, two allOf-hops deep: guarded.
      expect(formData).toContain(
        'if(createPayloadRequestBody.payload.doubleNest !== undefined) {',
      );
      expect(formData).toContain(
        'formData.append(`payload.doubleNest`, createPayloadRequestBody.payload.doubleNest.toString())',
      );
      // Optional, one allOf-hop deep: guarded.
      expect(formData).toContain(
        'if(createPayloadRequestBody.payload.nest !== undefined) {',
      );
      expect(formData).toContain(
        'formData.append(`payload.nest`, createPayloadRequestBody.payload.nest.toString())',
      );
      // Required, one allOf-hop deep: unguarded.
      expect(formData).toContain(
        'formData.append(`payload.id`, createPayloadRequestBody.payload.id.toString())',
      );
      expect(formData).toContain(
        'formData.append(`payload.name`, createPayloadRequestBody.payload.name);',
      );
      // Required, sibling allOf branch at the root: unguarded.
      expect(formData).toContain(
        'formData.append(`payload.tag`, createPayloadRequestBody.payload.tag);',
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

describe('getResReqTypes (form-data part content type escaping)', () => {
  it('escapes single quotes in an encoding content type', () => {
    const reqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  note: { type: 'string' },
                },
                required: ['note'],
              },
              encoding: {
                note: { contentType: "text/plain', evil: 'injected" },
              },
            },
          },
          required: true,
        },
      ],
    ];

    const result = getResReqTypes(reqBody, 'Body', context)[0];

    expect(result.formData).toContain(
      String.raw`new Blob([bodyRequestBody.note], { type: 'text/plain\', evil: \'injected' })`,
    );
    expect(result.formData).not.toContain("evil: 'injected'");
  });
});

describe('allOf resolution helpers (isEffectivelyObjectSchema / collectPropertiesThroughAllOf / collectRequiredThroughAllOf)', () => {
  const StringLeaf: OpenApiSchemaObject = { type: 'string' };
  const ObjectLeaf: OpenApiSchemaObject = {
    type: 'object',
    properties: { x: { type: 'string' } },
    required: ['x'],
  };
  const NoOwnType: OpenApiSchemaObject = {
    properties: { y: { type: 'number' } },
  };

  const ctxWith = (schemas: Record<string, OpenApiSchemaObject>): ContextSpec =>
    ({
      ...context,
      spec: { components: { schemas } },
    }) as unknown as ContextSpec;

  describe('isEffectivelyObjectSchema', () => {
    it('true for an explicit type: object', () => {
      expect(isEffectivelyObjectSchema({ type: 'object' }, context)).toBe(true);
    });

    it('true for a type array that includes object', () => {
      expect(
        isEffectivelyObjectSchema(
          { type: ['object', 'null'] as unknown as 'object' },
          context,
        ),
      ).toBe(true);
    });

    it('true when properties are present without an explicit type', () => {
      expect(isEffectivelyObjectSchema(NoOwnType, context)).toBe(true);
    });

    it('true when only additionalProperties is present', () => {
      expect(
        isEffectivelyObjectSchema(
          { additionalProperties: { type: 'string' } },
          context,
        ),
      ).toBe(true);
    });

    it('false for a plain scalar schema', () => {
      expect(isEffectivelyObjectSchema(StringLeaf, context)).toBe(false);
    });

    it('false for an empty/unknown schema (never defaults to true)', () => {
      expect(isEffectivelyObjectSchema({}, context)).toBe(false);
    });

    it('true for a single-level allOf wrapping an object $ref', () => {
      const ctx = ctxWith({ ObjectLeaf });
      expect(
        isEffectivelyObjectSchema(
          { allOf: [{ $ref: '#/components/schemas/ObjectLeaf' }] },
          ctx,
        ),
      ).toBe(true);
    });

    it('false for a single-level allOf wrapping a scalar $ref', () => {
      const ctx = ctxWith({ StringLeaf });
      expect(
        isEffectivelyObjectSchema(
          { allOf: [{ $ref: '#/components/schemas/StringLeaf' }] },
          ctx,
        ),
      ).toBe(false);
    });

    it('true through a two-level allOf -> $ref -> allOf -> $ref chain', () => {
      const ctx = ctxWith({
        ObjectLeaf,
        Core: { allOf: [{ $ref: '#/components/schemas/ObjectLeaf' }] },
      });
      expect(
        isEffectivelyObjectSchema(
          { allOf: [{ $ref: '#/components/schemas/Core' }] },
          ctx,
        ),
      ).toBe(true);
    });

    it('false through a two-level allOf -> $ref -> allOf -> $ref chain wrapping a scalar', () => {
      const ctx = ctxWith({
        StringLeaf,
        Core: { allOf: [{ $ref: '#/components/schemas/StringLeaf' }] },
      });
      expect(
        isEffectivelyObjectSchema(
          { allOf: [{ $ref: '#/components/schemas/Core' }] },
          ctx,
        ),
      ).toBe(false);
    });

    it('does not stack-overflow or infinite-loop on a self-referential allOf chain', () => {
      const ctx = ctxWith({
        SelfRef: { allOf: [{ $ref: '#/components/schemas/SelfRef' }] },
      });
      expect(() =>
        isEffectivelyObjectSchema(
          ctx.spec.components!.schemas!.SelfRef as OpenApiSchemaObject,
          ctx,
        ),
      ).not.toThrow();
      expect(
        isEffectivelyObjectSchema(
          ctx.spec.components!.schemas!.SelfRef as OpenApiSchemaObject,
          ctx,
        ),
      ).toBe(false);
    });
  });

  describe('collectPropertiesThroughAllOf', () => {
    it('returns own properties unchanged when there is no allOf', () => {
      expect(collectPropertiesThroughAllOf(ObjectLeaf, context)).toEqual({
        x: { type: 'string' },
      });
    });

    it('returns {} for a schema with neither properties nor allOf', () => {
      expect(
        collectPropertiesThroughAllOf({ type: 'object' }, context),
      ).toEqual({});
    });

    it('pulls in properties through a single allOf -> $ref hop', () => {
      const ctx = ctxWith({ ObjectLeaf });
      const wrapper: OpenApiSchemaObject = {
        allOf: [{ $ref: '#/components/schemas/ObjectLeaf' }],
      };
      expect(collectPropertiesThroughAllOf(wrapper, ctx)).toEqual({
        x: { type: 'string' },
      });
    });

    it('pulls in properties through a two-level allOf -> $ref -> allOf -> $ref chain', () => {
      const ctx = ctxWith({
        ObjectLeaf,
        Core: { allOf: [{ $ref: '#/components/schemas/ObjectLeaf' }] },
      });
      const wrapper: OpenApiSchemaObject = {
        allOf: [{ $ref: '#/components/schemas/Core' }],
      };
      expect(collectPropertiesThroughAllOf(wrapper, ctx)).toEqual({
        x: { type: 'string' },
      });
    });

    it('merges properties contributed by multiple allOf members', () => {
      const A: OpenApiSchemaObject = { properties: { a: { type: 'string' } } };
      const B: OpenApiSchemaObject = { properties: { b: { type: 'number' } } };
      const ctx = ctxWith({ A, B });
      const wrapper: OpenApiSchemaObject = {
        allOf: [
          { $ref: '#/components/schemas/A' },
          { $ref: '#/components/schemas/B' },
        ],
      };
      expect(collectPropertiesThroughAllOf(wrapper, ctx)).toEqual({
        a: { type: 'string' },
        b: { type: 'number' },
      });
    });

    it('own properties take precedence over allOf-inherited ones on key conflicts', () => {
      const Base: OpenApiSchemaObject = {
        properties: { a: { type: 'string', description: 'base' } },
      };
      const ctx = ctxWith({ Base });
      const wrapper: OpenApiSchemaObject = {
        allOf: [{ $ref: '#/components/schemas/Base' }],
        properties: { a: { type: 'string', description: 'override' } },
      };
      expect(
        (collectPropertiesThroughAllOf(wrapper, ctx).a as OpenApiSchemaObject)
          .description,
      ).toBe('override');
    });

    it('does not stack-overflow or infinite-loop on a self-referential allOf chain', () => {
      const ctx = ctxWith({
        SelfRef: { allOf: [{ $ref: '#/components/schemas/SelfRef' }] },
      });
      expect(() =>
        collectPropertiesThroughAllOf(
          ctx.spec.components!.schemas!.SelfRef as OpenApiSchemaObject,
          ctx,
        ),
      ).not.toThrow();
    });
  });

  describe('collectRequiredThroughAllOf', () => {
    it('returns own required array unchanged when there is no allOf', () => {
      expect(collectRequiredThroughAllOf(ObjectLeaf, context)).toEqual(['x']);
    });

    it('returns [] for a schema with neither required nor allOf', () => {
      expect(collectRequiredThroughAllOf({ type: 'object' }, context)).toEqual(
        [],
      );
    });

    it('pulls in required through a single allOf -> $ref hop', () => {
      const ctx = ctxWith({ ObjectLeaf });
      const wrapper: OpenApiSchemaObject = {
        allOf: [{ $ref: '#/components/schemas/ObjectLeaf' }],
      };
      expect(collectRequiredThroughAllOf(wrapper, ctx)).toEqual(['x']);
    });

    it('merges required contributed by multiple allOf members plus its own', () => {
      const A: OpenApiSchemaObject = {
        properties: { a: { type: 'string' } },
        required: ['a'],
      };
      const B: OpenApiSchemaObject = {
        properties: { b: { type: 'number' } },
        required: ['b'],
      };
      const ctx = ctxWith({ A, B });
      const wrapper: OpenApiSchemaObject = {
        allOf: [
          { $ref: '#/components/schemas/A' },
          { $ref: '#/components/schemas/B' },
        ],
        required: ['c'],
        properties: { c: { type: 'boolean' } },
      };
      const required = collectRequiredThroughAllOf(wrapper, ctx);
      expect(required).toContain('a');
      expect(required).toContain('b');
      expect(required).toContain('c');
    });

    it('does not stack-overflow or infinite-loop on a self-referential allOf chain', () => {
      const ctx = ctxWith({
        SelfRef: { allOf: [{ $ref: '#/components/schemas/SelfRef' }] },
      });
      expect(() =>
        collectRequiredThroughAllOf(
          ctx.spec.components!.schemas!.SelfRef as OpenApiSchemaObject,
          ctx,
        ),
      ).not.toThrow();
    });
  });
});
