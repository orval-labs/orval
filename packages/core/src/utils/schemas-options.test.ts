import { describe, expect, it } from 'vitest';

import { getSchemasImportPath } from './schemas-options';

describe('getSchemasImportPath', () => {
  it('returns importPath when schemas is an object with importPath', () => {
    expect(
      getSchemasImportPath({
        path: '/libs/models',
        type: 'typescript',
        importPath: '@acme/models',
        splitByTags: false,
      }),
    ).toBe('@acme/models');
  });

  it('returns undefined when schemas is an object without importPath', () => {
    expect(
      getSchemasImportPath({
        path: '/libs/models',
        type: 'typescript',
        splitByTags: false,
      }),
    ).toBeUndefined();
  });

  it('returns undefined when schemas is a string', () => {
    expect(getSchemasImportPath('./models')).toBeUndefined();
  });

  it('returns undefined when schemas is undefined', () => {
    expect(getSchemasImportPath()).toBeUndefined();
  });

  it('returns undefined when schemas is false', () => {
    expect(getSchemasImportPath(false)).toBeUndefined();
  });
});
