import { describe, expect, it } from 'vitest';

import type { GeneratorMutator, GeneratorVerbOptions } from '../types';
import {
  addDependency,
  generateMutatorImports,
  generateVerbImports,
} from './imports';

const makeMutator = (path: string): GeneratorMutator => ({
  name: 'customInstance',
  path,
  default: false,
  hasErrorType: false,
  errorTypeName: 'ErrorType',
  hasSecondArg: false,
  hasThirdArg: false,
  isHook: false,
});

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
        dependency: '../models',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [
          { name: 'Error', alias: 'ErrorSchema', values: true },
          { name: 'Error' },
        ],
      });

      expect(dep).toBe(
        "import {\n  Error as ErrorSchema\n} from '../models';\n" +
          "import type {\n  Error\n} from '../models';\n",
      );
    });

    it('does not emit an empty type-only import when all types are already covered by value imports', () => {
      const implementation = 'const status = MyEnum.Active;';

      const dep = addDependency({
        implementation,
        dependency: './types',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'MyEnum', values: true }],
      });

      expect(dep).toBe("import {\n  MyEnum\n} from './types';\n");
      expect(dep).not.toContain('import type');
    });

    it('does not emit an empty type-only import when enum $ref types are filtered out by value imports', () => {
      const implementation = 'const val = MyEnum.Foo;';

      const dep = addDependency({
        implementation,
        dependency: './types',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'MyEnum', values: true }, { name: 'MyEnum' }],
      });

      // Should only have the value import, not an empty "import type  from './types';"
      expect(dep).toBe("import {\n  MyEnum\n} from './types';\n");
      expect(dep).not.toMatch(/import type\s+from/);
    });

    it('escapes regex metacharacters when matching referenced imports', () => {
      const dep = addDependency({
        implementation: 'const value = schema$Value.parse(data);',
        dependency: '../models',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'schema$Value', values: true }],
      });

      expect(dep).toBe("import {\n  schema$Value\n} from '../models';\n");
    });
  });

  // `oneMore` is set only by the tags-split writer (split-tags-mode.ts),
  // where generated files live one directory deeper than the output root.
  describe('generateMutatorImports', () => {
    it('prepends ../ to a relative mutator path when oneMore is set', () => {
      const imports = generateMutatorImports({
        mutators: [makeMutator('../api/mutator/custom-instance')],
        oneMore: true,
      });

      expect(imports).toBe(
        "import { customInstance } from '../../api/mutator/custom-instance';\n",
      );
    });

    it('does not prepend ../ to a scoped package mutator path when oneMore is set', () => {
      const imports = generateMutatorImports({
        mutators: [makeMutator('@scope/axios')],
        oneMore: true,
      });

      expect(imports).toBe("import { customInstance } from '@scope/axios';\n");
    });

    it('does not prepend ../ to a bare package mutator path when oneMore is set', () => {
      const imports = generateMutatorImports({
        mutators: [makeMutator('axios')],
        oneMore: true,
      });

      expect(imports).toBe("import { customInstance } from 'axios';\n");
    });

    it('leaves a package mutator path untouched when oneMore is not set', () => {
      const imports = generateMutatorImports({
        mutators: [makeMutator('@scope/axios')],
      });

      expect(imports).toBe("import { customInstance } from '@scope/axios';\n");
    });
  });
});
