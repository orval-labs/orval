import { describe, it, expect, vi } from 'vitest';
import { generateMSWImports } from './index';
import { OutputMockType } from '@orval/core';

// Mock the generateDependencyImports function
vi.mock('@orval/core', async () => {
  const actual =
    await vi.importActual<typeof import('@orval/core')>('@orval/core');
  return {
    ...actual,
    generateDependencyImports: vi.fn(
      () =>
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";',
    ),
  };
});

describe('generateMSWImports', () => {
  const mockParams = {
    implementation: 'mock-implementation',
    imports: [],
    specsName: { test: 'test-specs' },
    hasSchemaDir: false,
    isAllowSyntheticDefaultImports: false,
  };

  describe('faker seed functionality', () => {
    it('should return import block without seed when seed is undefined', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";',
      );
    });

    it('should add faker.seed call with numeric seed', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW, seed: 12345 },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";\nfaker.seed(12345);\n\n',
      );
    });

    it('should add faker.seed call with array seed', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW, seed: [123, 456, 789] },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";\nfaker.seed([123, 456, 789]);\n\n',
      );
    });

    it('should add faker.seed call with single element array', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW, seed: [42] },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";\nfaker.seed([42]);\n\n',
      );
    });

    it('should add faker.seed call with zero seed', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW, seed: 0 },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";\nfaker.seed(0);\n\n',
      );
    });

    it('should not add seed when array is empty', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: { type: OutputMockType.MSW, seed: [] },
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";',
      );
    });

    it('should not add seed when options is undefined', () => {
      const result = generateMSWImports({
        ...mockParams,
        options: undefined,
      });

      expect(result).toBe(
        'import { http, HttpResponse } from "msw";\nimport { faker } from "@faker-js/faker";',
      );
    });
  });
});
