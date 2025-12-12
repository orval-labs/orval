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
  describe('media key precedence', () => {
    it('binary media key overrides schema to Blob', () => {
      const reqBody: [string, OpenApiRequestBodyObject][] = [
        [
          'requestBody',
          {
            content: { 'application/octet-stream': { schema: { type: 'string' } } },
            required: true,
          },
        ],
      ];
      expect(getResReqTypes(reqBody, 'Body', context)[0].value).toBe('Blob');
    });

    it('text/JSON media key ignores contentMediaType', () => {
      const reqBody: [string, OpenApiRequestBodyObject][] = [
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
      expect(getResReqTypes(reqBody, 'Body', context)[0].value).toBe('string');
    });
  });

  describe('FormData: encoding.contentType vs contentMediaType', () => {
    // Comprehensive test: one schema with all combinations
    const reqBody: [string, OpenApiRequestBodyObject][] = [
      [
        'requestBody',
        {
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  // encoding.contentType takes precedence (binary → append directly)
                  encBinary: { type: 'string' },
                  // encoding.contentType takes precedence (text → instanceof check)
                  encText: { type: 'string' },
                  // No encoding, contentMediaType applies (binary → append directly)
                  cmtBinary: { type: 'string', contentMediaType: 'image/png' },
                  // No encoding, contentMediaType applies (text → instanceof check)
                  cmtText: { type: 'string', contentMediaType: 'application/xml' },
                  // encoding overrides conflicting contentMediaType
                  encOverride: { type: 'string', contentMediaType: 'image/png' },
                  // format:binary (no encoding needed)
                  formatBinary: { type: 'string', format: 'binary' },
                  // Object with encoding → JSON.stringify + Blob wrap
                  metadata: { type: 'object', properties: { name: { type: 'string' } } },
                },
                required: [
                  'encBinary',
                  'encText',
                  'cmtBinary',
                  'cmtText',
                  'encOverride',
                  'formatBinary',
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

    it('binary encoding.contentType appends directly', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/\.encBinary\)/);
      expect(formData).not.toMatch(/encBinary.*instanceof/);
    });

    it('text encoding.contentType generates instanceof Blob check', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/encText.*instanceof Blob/);
      expect(formData).toContain("type: 'text/plain'");
    });

    it('binary contentMediaType (no encoding) appends directly', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/\.cmtBinary\)/);
      expect(formData).not.toMatch(/cmtBinary.*instanceof/);
    });

    it('text contentMediaType (no encoding) generates instanceof Blob check', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/cmtText.*instanceof Blob/);
      expect(formData).toContain("type: 'application/xml'");
    });

    it('encoding.contentType overrides contentMediaType', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      // encOverride: contentMediaType=image/png but encoding=text/csv
      // text/csv wins → instanceof check with text/csv
      expect(formData).toMatch(/encOverride.*instanceof Blob/);
      expect(formData).toContain("type: 'text/csv'");
      expect(formData).not.toMatch(/encOverride.*image\/png/);
    });

    it('format:binary appends directly', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/\.formatBinary\)/);
      expect(formData).not.toMatch(/formatBinary.*instanceof/);
    });

    it('object with encoding wraps in Blob with JSON.stringify', () => {
      const formData = getResReqTypes(reqBody, 'Body', context)[0].formData!;
      expect(formData).toMatch(/new Blob\(\[JSON\.stringify\(.*metadata/);
      expect(formData).toContain("type: 'application/json'");
    });
  });
});
