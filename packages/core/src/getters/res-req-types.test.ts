import { describe, it, expect } from 'vitest';
import { RequestBodyObject, SchemaObject } from 'openapi3-ts/oas30';
import { getResReqTypes } from './res-req-types';

// Simulates an OpenAPI schema with a readOnly property
const schemaWithReadOnly: SchemaObject = {
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
    },
  },
  specKey: 'spec',
  target: 'spec',
  workspace: '',
  specs: {
    spec: {
      components: { schemas: {} },
    },
  },
};

describe('getResReqTypes (formData, readOnly property)', () => {
  it('should not include readOnly properties in the generated formData', () => {
    const reqBody: [string, RequestBodyObject][] = [
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
    const types = getResReqTypes(reqBody, 'UploadBody', context as any);
    // Get the generated code for formData
    expect(types[0]).toBeDefined();
    expect(typeof types[0].formData).toBe('string');
    const formDataCode = types[0].formData as string;
    // Verify that the readOnly property "id" is NOT present in the generated code
    expect(formDataCode).not.toContain('id');
    // Verify that the non-readOnly fields are present
    expect(formDataCode).toContain('file');
    expect(formDataCode).toContain('kind');
  });
});
