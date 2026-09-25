import { describe, expect, it } from 'vite-plus/test';

import { getFormDataFieldFileType, isBinaryContentType } from './content-type';

describe('isBinaryContentType', () => {
  it('treats image, audio, video and font families as binary', () => {
    expect(isBinaryContentType('image/png')).toBe(true);
    expect(isBinaryContentType('audio/mpeg')).toBe(true);
    expect(isBinaryContentType('video/mp4')).toBe(true);
    expect(isBinaryContentType('font/woff2')).toBe(true);
  });

  it('treats only known application/* types as binary', () => {
    expect(isBinaryContentType('application/octet-stream')).toBe(true);
    expect(isBinaryContentType('application/pdf')).toBe(true);
    expect(isBinaryContentType('application/json')).toBe(false);
  });

  it('ignores media type parameters', () => {
    expect(isBinaryContentType('image/png; charset=binary')).toBe(true);
    expect(isBinaryContentType('text/csv; charset=utf-8')).toBe(false);
  });
});

describe('getFormDataFieldFileType', () => {
  it('classifies a plain string part by its contentMediaType', () => {
    expect(
      getFormDataFieldFileType(
        { type: 'string', contentMediaType: 'application/octet-stream' },
        undefined,
      ),
    ).toBe('binary');
    expect(
      getFormDataFieldFileType(
        { type: 'string', contentMediaType: 'text/csv' },
        undefined,
      ),
    ).toBe('text');
  });

  // `resolveSpec` rewrites `{ type: 'string', nullable: true }` to a type
  // union, so a nullable file part reaches the getters as ['string', 'null'].
  // Rejecting that union made the part fall through to plain `string`. (#4141)
  it('classifies an OAS 3.1 nullable string part the same as a plain one', () => {
    expect(
      getFormDataFieldFileType(
        {
          type: ['string', 'null'],
          contentMediaType: 'application/octet-stream',
        },
        undefined,
      ),
    ).toBe('binary');
    expect(
      getFormDataFieldFileType({ type: ['string', 'null'] }, 'text/csv'),
    ).toBe('text');
  });

  it('lets encoding.contentType win over contentMediaType on a nullable part', () => {
    expect(
      getFormDataFieldFileType(
        {
          type: ['string', 'null'],
          contentMediaType: 'text/csv',
        },
        'image/png',
      ),
    ).toBe('binary');
  });

  it('returns undefined when the part is an encoded string', () => {
    expect(
      getFormDataFieldFileType(
        {
          type: ['string', 'null'],
          contentMediaType: 'application/octet-stream',
          contentEncoding: 'base64',
        },
        undefined,
      ),
    ).toBeUndefined();
  });

  it('returns undefined when the part has no effective content type', () => {
    expect(
      getFormDataFieldFileType({ type: ['string', 'null'] }, undefined),
    ).toBeUndefined();
  });

  it('returns undefined for non-string parts', () => {
    expect(
      getFormDataFieldFileType({ type: 'object' }, 'application/octet-stream'),
    ).toBeUndefined();
    expect(
      getFormDataFieldFileType(
        { type: 'array', items: { type: 'string' } },
        'application/octet-stream',
      ),
    ).toBeUndefined();
  });

  // Mirrors `isBinaryScalarSchema`: a union that also admits a non-string,
  // non-null member is not dispatched as a string by `getScalar`, so it must
  // not be promised file semantics here either.
  it('returns undefined for unions mixing string with other types', () => {
    expect(
      getFormDataFieldFileType(
        {
          type: ['string', 'integer'],
          contentMediaType: 'application/octet-stream',
        },
        undefined,
      ),
    ).toBeUndefined();
  });
});
