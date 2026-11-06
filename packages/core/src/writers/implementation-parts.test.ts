import { describe, expect, it } from 'vite-plus/test';

import type { GeneratorMutator } from '../types';
import type { TargetMutators } from './implementation-parts';
import { generateTargetMutatorImports } from './implementation-parts';

const makeMutator = (name: string): GeneratorMutator => ({
  name,
  path: `../mutators/${name}`,
  default: false,
  hasErrorType: false,
  errorTypeName: 'ErrorType',
  hasSecondArg: false,
  hasThirdArg: false,
  isHook: false,
});

describe('generateTargetMutatorImports', () => {
  // A configured mutator of any kind is attached to every operation whether
  // or not the operation's code calls it, so each kind must follow usage.
  const kinds: (keyof TargetMutators)[] = [
    'mutators',
    'formData',
    'formUrlEncoded',
    'paramsSerializer',
    'paramsFilter',
    'fetchReviver',
  ];

  it.each(kinds)(
    'imports a %s mutator only when the implementation references it',
    (kind) => {
      const target: TargetMutators = { [kind]: [makeMutator('customFn')] };

      expect(
        generateTargetMutatorImports(
          target,
          'export const listPets = () => customFn(url);',
        ),
      ).toBe("import { customFn } from '../mutators/customFn';\n");
      expect(
        generateTargetMutatorImports(
          target,
          'export const listPets = () => fetch(url);',
        ),
      ).toBe('');
    },
  );

  it('keeps the used kinds in declaration order and drops the rest', () => {
    const target: TargetMutators = {
      mutators: [makeMutator('customInstance')],
      formData: [makeMutator('customFormData')],
      paramsSerializer: [makeMutator('customSerializer')],
      fetchReviver: [makeMutator('customReviver')],
    };
    const implementation = `
      export const createPet = (body) =>
        customInstance({ data: customFormData(body) });
      export const getPet = (text) => JSON.parse(text, customReviver);
    `;

    expect(generateTargetMutatorImports(target, implementation)).toBe(
      "import { customInstance } from '../mutators/customInstance';\n" +
        "import { customFormData } from '../mutators/customFormData';\n" +
        "import { customReviver } from '../mutators/customReviver';\n",
    );
  });

  it('imports a function configured for two kinds once', () => {
    const serialize = makeMutator('serialize');
    const target: TargetMutators = {
      paramsSerializer: [serialize],
      paramsFilter: [serialize],
    };

    expect(generateTargetMutatorImports(target, 'serialize(params);')).toBe(
      "import { serialize } from '../mutators/serialize';\n",
    );
  });

  it('prepends ../ to a relative path when oneMore is set', () => {
    expect(
      generateTargetMutatorImports(
        { paramsSerializer: [makeMutator('serialize')] },
        'serialize(params);',
        true,
      ),
    ).toBe("import { serialize } from '../../mutators/serialize';\n");
  });

  it('always imports client mutators', () => {
    // A client may call them from code outside `implementation`: the zod
    // client's params mutator is called from inline component schemas.
    expect(
      generateTargetMutatorImports(
        { clientMutators: [makeMutator('zodParams')] },
        'export const listPets = () => fetch(url);',
      ),
    ).toBe("import { zodParams } from '../mutators/zodParams';\n");
  });
});
