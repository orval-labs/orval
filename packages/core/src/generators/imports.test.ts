import { describe, expect, it, vi } from 'vite-plus/test';

import type { GeneratorMutator, GeneratorVerbOptions } from '../types';
import {
  addDependency,
  generateDependencyImports,
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

    it('does not add an import when the name only appears inside another identifier', () => {
      const dep = addDependency({
        implementation: 'const value = MySchemaExtra.parse(data);',
        dependency: '../models',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'MySchema', values: true }],
      });

      expect(dep).toBeUndefined();
    });

    // Regression for #3695: an aliased import is referenced by its alias only
    // (rendered `name as alias`), so a bare occurrence of the pre-alias name in
    // generated code (e.g. a path param `z` colliding with `z as zod`) must not
    // pull the dependency in.
    it('does not add an aliased import when only its pre-alias name appears', () => {
      const dep = addDependency({
        implementation: 'export const getUrl = (z: string) => `/${z}`;',
        dependency: 'zod',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'z', alias: 'zod', values: true }],
      });

      expect(dep).toBeUndefined();
    });

    it('adds an aliased import when its alias appears', () => {
      const dep = addDependency({
        implementation: 'const schema = zod.string();',
        dependency: 'zod',
        projectName: undefined,
        hasSchemaDir: true,
        isAllowSyntheticDefaultImports: true,
        exports: [{ name: 'z', alias: 'zod', values: true }],
      });

      expect(dep).toBe("import {\n  z as zod\n} from 'zod';\n");
    });
  });

  describe('generateDependencyImports', () => {
    it('indexes referenced identifiers once for all dependency groups', () => {
      const matchAll = vi.spyOn(String.prototype, 'matchAll');

      try {
        const result = generateDependencyImports(
          'const foo = Foo.parse(data); const bar = Bar.parse(data);',
          [
            {
              dependency: 'foo',
              exports: [{ name: 'Foo', values: true }],
            },
            {
              dependency: 'bar',
              exports: [{ name: 'Bar', values: true }],
            },
          ],
          undefined,
          true,
          true,
        );

        expect(result).toContain("{\n  Foo\n} from 'foo';");
        expect(result).toContain("{\n  Bar\n} from 'bar';");
        expect(matchAll).toHaveBeenCalledTimes(1);
      } finally {
        matchAll.mockRestore();
      }
    });

    // A name after a dot is a property of the object on its left, never the
    // imported binding: code that really uses an import names it bare
    // somewhere. Reading a member name as a reference kept imports alive that
    // nothing used (#4143).
    describe('member names are not references', () => {
      const importMap = (implementation: string) =>
        generateDependencyImports(
          implementation,
          [{ dependency: 'rxjs', exports: [{ name: 'map', values: true }] }],
          undefined,
          true,
          true,
        );

      it('does not import a name used only as a method call', () => {
        expect(importMap('const out = items.map((item) => item);')).toBe('');
      });

      it('does not import a name used only through optional chaining', () => {
        expect(importMap('const out = items?.map((item) => item);')).toBe('');
      });

      it('does not import a name reached across a line break', () => {
        expect(importMap('const out = items\n  .map((item) => item);')).toBe(
          '',
        );
      });

      it('does not import a name used only as a qualified type', () => {
        expect(importMap('let value: Operators.map;')).toBe('');
      });

      it('imports a name called bare', () => {
        expect(importMap('source.pipe(map((data) => data));')).toContain(
          "from 'rxjs'",
        );
      });

      it('imports a name used in shorthand', () => {
        expect(importMap('const operators = { map };')).toContain(
          "from 'rxjs'",
        );
      });

      it('imports a name that is spread, despite the leading dots', () => {
        // `...map` is a reference; the `.` in front of it belongs to the
        // spread token, not to a member access.
        expect(importMap('const all = [...map];')).toContain("from 'rxjs'");
      });

      it('imports a name that is both spread and a member elsewhere', () => {
        expect(
          importMap('const all = [...map, ...items.map(Number)];'),
        ).toContain("from 'rxjs'");
      });

      it('does not import a name read off a numeric literal', () => {
        // `1..map` is valid: the first dot ends the numeric literal `1.` and
        // the second is the member access. Only the third dot of `...map`
        // makes a preceding dot a spread token.
        expect(importMap('const out = 1..map;')).toBe('');
      });
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

    it('skips a mutator the implementation does not reference', () => {
      const imports = generateMutatorImports({
        mutators: [makeMutator('@scope/axios')],
        implementation: 'export const listPets = () => fetch("/pets");',
      });

      expect(imports).toBe('');
    });

    it('matches the mutator name as a whole identifier', () => {
      const mutator = { ...makeMutator('@scope/axios'), name: 'custom' };

      expect(
        generateMutatorImports({
          mutators: [mutator],
          implementation: 'export const customizePet = () => custom();',
        }),
      ).toBe("import { custom } from '@scope/axios';\n");
      expect(
        generateMutatorImports({
          mutators: [mutator],
          implementation: 'export const customizePet = () => customizePet();',
        }),
      ).toBe('');
    });
  });
});
