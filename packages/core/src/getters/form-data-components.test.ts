import { describe, expect, it } from 'vite-plus/test';

import type { ContextSpec, OpenApiDocument } from '../types';
import { getFormDataComponentContexts } from './form-data-components';

const makeContext = (spec: OpenApiDocument): ContextSpec =>
  ({
    target: 'spec.yaml',
    workspace: '.',
    spec,
    output: { override: {} },
  }) as unknown as ContextSpec;

describe('getFormDataComponentContexts', () => {
  it('returns a form-data context for a schema used as a multipart body', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/upload' },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toEqual({
      atPart: false,
      encoding: {},
    });
  });

  it('carries the media type encoding of the multipart body', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/upload' },
                  encoding: { report: { contentType: 'text/csv' } },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toEqual({
      atPart: false,
      encoding: { report: { contentType: 'text/csv' } },
    });
  });

  it('resolves request bodies declared under components.requestBodies', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: { requestBody: { $ref: '#/components/requestBodies/Upload' } },
        },
      },
      components: {
        requestBodies: {
          Upload: {
            content: {
              'multipart/form-data': {
                schema: { $ref: '#/components/schemas/upload' },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toEqual({
      atPart: false,
      encoding: {},
    });
  });

  it('merges the encodings of every multipart usage, first one wins', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/upload' },
                  encoding: { report: { contentType: 'text/csv' } },
                },
              },
            },
          },
        },
        '/bar': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { $ref: '#/components/schemas/upload' },
                  encoding: {
                    report: { contentType: 'application/pdf' },
                    avatar: { contentType: 'image/png' },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toEqual({
      atPart: false,
      encoding: {
        report: { contentType: 'text/csv' },
        avatar: { contentType: 'image/png' },
      },
    });
  });

  it('returns undefined for schemas that are not multipart bodies', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/upload' },
                },
              },
            },
          },
          get: {
            responses: {
              '200': {
                content: {
                  'multipart/form-data': {
                    schema: { $ref: '#/components/schemas/download' },
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toBeUndefined();
    expect(
      getFormDataComponentContexts(context).get('download'),
    ).toBeUndefined();
  });

  it('ignores url-encoded bodies so shared schemas keep their Blob fields', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'application/x-www-form-urlencoded': {
                  schema: { $ref: '#/components/schemas/upload' },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toBeUndefined();
  });

  it('ignores inline multipart body schemas', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  schema: { type: 'object', properties: {} },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).get('upload')).toBeUndefined();
  });

  it('ignores refs that only start at a component schema', () => {
    const context = makeContext({
      paths: {
        '/foo': {
          post: {
            requestBody: {
              content: {
                'multipart/form-data': {
                  // Names the last token `upload`, but points at a property of
                  // `Wrapper` — not at `components.schemas.upload`.
                  schema: {
                    $ref: '#/components/schemas/Wrapper/properties/upload',
                  },
                },
              },
            },
          },
        },
      },
    } as unknown as OpenApiDocument);

    expect(getFormDataComponentContexts(context).size).toBe(0);
  });
});
