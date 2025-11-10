import { describe, expect, it } from 'vitest';

import type { GeneratorVerbOptions } from '../types.ts';
import { addDependency, generateVerbImports } from './imports.ts';

describe('imports generator helpers', () => {
  describe('generateVerbImports', () => {
    it('aliases a Zod schema named "Error" when it is required as a runtime value', () => {
      const verbOptions = {
        response: {
          imports: [{ name: 'Error', values: true }],
        },
        body: {
          imports: [],
        },
        queryParams: undefined,
        props: [],
        headers: undefined,
        params: [],
      } as unknown as GeneratorVerbOptions;

      const result = generateVerbImports(verbOptions);

      expect(result).toContainEqual({ name: 'Error', values: undefined });
      expect(result).toContainEqual({
        name: 'Error',
        alias: 'ErrorSchema',
        values: true,
      });
    });

    it('does not re-alias Error when it already has an alias or is type-only', () => {
      const verbOptions = {
        response: {
          imports: [
            { name: 'Error', alias: 'ApiError', values: true },
            { name: 'Error' },
          ],
        },
        body: {
          imports: [],
        },
        queryParams: undefined,
        props: [],
        headers: undefined,
        params: [],
      } as unknown as GeneratorVerbOptions;

      const result = generateVerbImports(verbOptions);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual({
        name: 'Error',
        alias: 'ApiError',
        values: true,
      });
      expect(result).toContainEqual({ name: 'Error' });
    });
  });

  describe('addDependency', () => {
    it('emits both value + type imports when the same symbol is imported under a different alias', () => {
      const implementation = `
const x = ErrorSchema.parse({});
export type MyError = Error;
`;

      const dep = addDependency({
        implementation,
        dependency: '../models/index.zod',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [
          { name: 'Error', alias: 'ErrorSchema', values: true },
          { name: 'Error' },
        ],
      });

      expect(dep).toBe(
        "import {\n  Error as ErrorSchema\n} from '../models/index.zod';\n" +
          "import type {\n  Error\n} from '../models/index.zod';\n",
      );
    });
  });
});
