import { describe, expect, it } from 'vitest';

import { type ClientMockBuilder, OutputMockType } from '../types';
import {
  getMockDir,
  hasAnyMockPath,
  resolveMockSchemasPath,
} from './mock-utils';

describe('resolveMockSchemasPath', () => {
  it('keeps the .schemas suffix when output.schemas is unset', () => {
    // mockFilePath is one level deep; the implicit schemas target is the
    // sibling `index.schemas` (no real file extension). Without treating
    // `.schemas` as a logical marker, the relative-import computation
    // strips it as if it were a file extension, yielding `../index`.
    const mockFilePath = '/workspace/generated/mock/default/default.faker.ts';
    const schemasTarget = '/workspace/generated/mock/index.schemas';

    const result = resolveMockSchemasPath(mockFilePath, schemasTarget);

    expect(result).toBe('../index.schemas');
  });

  it('strips the real .ts extension when present on the target', () => {
    const mockFilePath = '/workspace/generated/mock/default/default.faker.ts';
    const schemasTarget = '/workspace/generated/mock/index.schemas.ts';

    const result = resolveMockSchemasPath(mockFilePath, schemasTarget);

    expect(result).toBe('../index.schemas');
  });

  it('returns a directory relative import when output.schemas is a dir', () => {
    const mockFilePath = '/workspace/dist/mocks/pet/pet.msw.ts';
    const schemasTarget = '/workspace/dist/schemas';

    const result = resolveMockSchemasPath(mockFilePath, schemasTarget);

    expect(result).toBe('../../schemas');
  });
});

describe('getMockDir', () => {
  it("returns the entry's per-generator path when set", () => {
    const entry = {
      type: OutputMockType.MSW,
      path: '../generated/mock/per-generator/msw',
    };
    const mockConfig = {
      indexMockFiles: false,
      path: '../generated/mock/per-generator/shared',
      generators: [entry, { type: OutputMockType.FAKER }],
    };

    expect(getMockDir(entry, mockConfig)).toBe(
      '../generated/mock/per-generator/msw',
    );
  });

  it('falls back to mockConfig.path when the entry has no path', () => {
    const entry = { type: OutputMockType.MSW };
    const mockConfig = {
      indexMockFiles: false,
      path: '../generated/mock/shared/mocks',
      generators: [entry, { type: OutputMockType.FAKER }],
    };

    expect(getMockDir(entry, mockConfig)).toBe(
      '../generated/mock/shared/mocks',
    );
  });

  it('returns undefined when neither the entry nor the shared config has a path', () => {
    const entry = { type: OutputMockType.FAKER };
    const mockConfig = {
      indexMockFiles: false,
      generators: [
        { type: OutputMockType.MSW, path: '../generated/mock/mixed/msw' },
        entry,
      ],
    };

    expect(getMockDir(entry, mockConfig)).toBeUndefined();
  });

  it('returns undefined for a function-form generator (ClientMockBuilder)', () => {
    const entry: ClientMockBuilder = () => ({
      imports: [],
      implementation: { function: '', handlerName: 'x', handler: '' },
    });
    const mockConfig = {
      indexMockFiles: false,
      generators: [entry],
    };

    expect(getMockDir(entry, mockConfig)).toBeUndefined();
  });
});

describe('hasAnyMockPath', () => {
  it('returns true when only the shared mockConfig.path is set', () => {
    const mockConfig = {
      indexMockFiles: false,
      path: '../generated/mock/shared/mocks',
      generators: [
        { type: OutputMockType.MSW },
        { type: OutputMockType.FAKER },
      ],
    };

    expect(hasAnyMockPath(mockConfig)).toBe(true);
  });

  it('returns true when only a per-generator path is set', () => {
    const mockConfig = {
      indexMockFiles: false,
      generators: [
        { type: OutputMockType.MSW, path: '../generated/mock/per-gen/msw' },
        { type: OutputMockType.FAKER },
      ],
    };

    expect(hasAnyMockPath(mockConfig)).toBe(true);
  });

  it('returns false when neither shared nor any generator has a path', () => {
    const mockConfig = {
      indexMockFiles: false,
      generators: [
        { type: OutputMockType.MSW },
        { type: OutputMockType.FAKER },
      ],
    };

    expect(hasAnyMockPath(mockConfig)).toBe(false);
  });

  it('ignores function-form generators when checking for a path', () => {
    const entry: ClientMockBuilder = () => ({
      imports: [],
      implementation: { function: '', handlerName: 'x', handler: '' },
    });
    const mockConfig = {
      indexMockFiles: false,
      generators: [
        { type: OutputMockType.MSW, path: '../generated/mock/x/msw' },
        entry,
      ],
    };

    expect(hasAnyMockPath(mockConfig)).toBe(true);
  });
});
