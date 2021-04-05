import { uniq, uniqWith } from 'lodash';
import { join } from 'path';
import { GeneratorImport, GeneratorMutator } from '../../types/generator';
import { camel } from '../../utils/case';
import { useContext } from '../../utils/context';

export const generateImports = (
  imports: GeneratorImport[] = [],
  refSpec: boolean,
) => {
  if (!imports.length) {
    return '';
  }

  const [context] = useContext();
  return uniqWith(
    imports,
    (a, b) =>
      a.name === b.name && a.default === b.default && a.specKey === b.specKey,
  )
    .sort()
    .map(({ specKey, name }) => {
      if (specKey) {
        const path =
          specKey !== context.rootSpec
            ? context.specs[specKey].basePath.slice(1).split('/').join('-')
            : '';

        if (refSpec && specKey) {
          return `import { ${name} } from \'../${join(path, camel(name))}\';`;
        }

        return `import { ${name} } from \'./${join(path, camel(name))}\';`;
      }

      return `import { ${name} } from \'./${camel(name)}\';`;
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
}: {
  implementation: string;
  exports: GeneratorImport[];
  dependency: string;
}) => {
  const toAdds = exports.filter((e) => implementation.includes(e.name));

  if (!toAdds.length) {
    return undefined;
  }

  const groupedBySpecKey = toAdds.reduce<
    Record<string, { name: string; default?: boolean }[]>
  >(
    (acc, { specKey, ...rest }) => ({
      ...acc,
      [specKey || 'default']: [...(acc[specKey || 'default'] || []), rest],
    }),
    {},
  );

  return Object.entries(groupedBySpecKey)
    .map(([key, values]) => {
      const defaultDep = values.find((e) => e.default);

      const deps = uniq(
        values.filter((e) => !e.default).map(({ name }) => name),
      ).join(',\n  ');

      return `import ${
        defaultDep ? `${defaultDep.name}${deps ? ',' : ''}` : ''
      }${deps ? `{\n  ${deps}\n}` : ''} from '${dependency}${
        key !== 'default' ? `/${key}` : ''
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
): string => {
  const dependencies = imports
    .map((dep) => addDependency({ ...dep, implementation }))
    .filter(Boolean)
    .join('\n');

  return dependencies ? dependencies + '\n' : '';
};
