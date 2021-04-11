import uniq from 'lodash.uniq';
import uniqWith from 'lodash.uniqwith';
import { join } from 'upath';
import {
  GeneratorImport,
  GeneratorMutator,
  GeneratorVerbOptions,
} from '../../types/generator';
import { camel } from '../../utils/case';

export const generateImports = ({
  imports = [],
  rootSpecKey,
  isRootKey,
  specsName,
}: {
  imports: GeneratorImport[];
  rootSpecKey: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
}) => {
  if (!imports.length) {
    return '';
  }

  return uniqWith(
    imports,
    (a, b) =>
      a.name === b.name && a.default === b.default && a.specKey === b.specKey,
  )
    .sort()
    .map(({ specKey, name }) => {
      if (specKey) {
        const path = specKey !== rootSpecKey ? specsName[specKey] : '';

        if (!isRootKey && specKey) {
          return `import type { ${name} } from \'../${join(
            path,
            camel(name),
          )}\';`;
        }

        return `import type { ${name} } from \'./${join(path, camel(name))}\';`;
      }

      return `import type { ${name} } from \'./${camel(name)}\';`;
    })
    .join('\n');
};

export const generateMutatorImports = (
  mutators: GeneratorMutator[],
  oneMore?: boolean,
) => {
  const imports = uniqWith(
    mutators,
    (a, b) => a.name === b.name && a.default === b.default,
  )
    .map((mutator) => {
      const importDefault = mutator.default
        ? mutator.name
        : `{ ${mutator.name} }`;

      return `import ${importDefault} from '${oneMore ? '../' : ''}${
        mutator.path
      }'`;
    })
    .join('\n');

  return imports ? imports + '\n' : '';
};

export const addDependency = ({
  implementation,
  exports,
  dependency,
  specsName,
}: {
  implementation: string;
  exports: GeneratorImport[];
  dependency: string;
  specsName: Record<string, string>;
}) => {
  const toAdds = exports.filter((e) => implementation.includes(e.name));

  if (!toAdds.length) {
    return undefined;
  }

  const groupedBySpecKey = toAdds.reduce<
    Record<string, { deps: GeneratorImport[]; values: boolean }>
  >((acc, dep) => {
    const key = dep.specKey || 'default';

    return {
      ...acc,
      [key]: {
        values: acc[key]?.values || dep.values || false,
        deps: [...(acc[key]?.deps || []), dep],
      },
    };
  }, {});

  return Object.entries(groupedBySpecKey)
    .map(([key, { values, deps }]) => {
      const defaultDep = deps.find((e) => e.default);

      const depsString = uniq(
        deps.filter((e) => !e.default).map(({ name }) => name),
      ).join(',\n  ');

      return `import ${!values ? 'type ' : ''}${
        defaultDep ? `${defaultDep.name}${depsString ? ',' : ''}` : ''
      }${depsString ? `{\n  ${depsString}\n}` : ''} from '${dependency}${
        key !== 'default' && specsName[key] ? `/${specsName[key]}` : ''
      }'`;
    })
    .join('\n');
};

export const generateDependencyImports = (
  implementation: string,
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[],
  specsName: Record<string, string>,
): string => {
  const dependencies = imports
    .map((dep) => addDependency({ ...dep, implementation, specsName }))
    .filter(Boolean)
    .join('\n');

  return dependencies ? dependencies + '\n' : '';
};

export const generateVerbImports = ({
  response,
  body,
  queryParams,
  params,
}: GeneratorVerbOptions): GeneratorImport[] => [
  ...response.imports,
  ...body.imports,
  ...params.reduce<GeneratorImport[]>(
    (acc, param) => [...acc, ...param.imports],
    [],
  ),
  ...(queryParams ? [{ name: queryParams.schema.name }] : []),
];
