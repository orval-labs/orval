import uniq from 'lodash.uniq';
import uniqWith from 'lodash.uniqwith';
import { join } from 'upath';
import {
  GeneratorImport,
  GeneratorMutator,
  GeneratorVerbOptions,
} from '../../types/generator';
import { camel } from '../../utils/case';
import { BODY_TYPE_NAME } from './mutator';

export const generateImports = ({
  imports = [],
  target,
  isRootKey,
  specsName,
}: {
  imports: GeneratorImport[];
  target: string;
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
    .map(({ specKey, name, values, alias }) => {
      if (specKey) {
        const path = specKey !== target ? specsName[specKey] : '';

        if (!isRootKey && specKey) {
          return `import ${!values ? 'type ' : ''}{ ${name}${
            alias ? ` as ${alias}` : ''
          } } from \'../${join(path, camel(name))}\';`;
        }

        return `import ${!values ? 'type ' : ''}{ ${name}${
          alias ? ` as ${alias}` : ''
        } } from \'./${join(path, camel(name))}\';`;
      }

      return `import ${!values ? 'type ' : ''}{ ${name}${
        alias ? ` as ${alias}` : ''
      } } from \'./${camel(name)}\';`;
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
        ? `${mutator.name}${
            mutator.hasErrorType || mutator.bodyTypeName
              ? `, { ${
                  mutator.hasErrorType
                    ? `ErrorType as ${mutator.errorTypeName}`
                    : ''
                }${mutator.hasErrorType && mutator.bodyTypeName ? ',' : ''} ${
                  mutator.bodyTypeName
                    ? `${BODY_TYPE_NAME} as ${mutator.bodyTypeName}`
                    : ''
                } }`
              : ''
          }`
        : `{ ${mutator.name}${
            mutator.hasErrorType ? `, ${mutator.errorTypeName}` : ''
          }${mutator.bodyTypeName ? `, ${mutator.bodyTypeName}` : ''} }`;

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
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
}: {
  implementation: string;
  exports: GeneratorImport[];
  dependency: string;
  specsName: Record<string, string>;
  hasSchemaDir: boolean;
  isAllowSyntheticDefaultImports: boolean;
}) => {
  const toAdds = exports.filter((e) =>
    implementation.includes(e.alias || e.name),
  );

  if (!toAdds.length) {
    return undefined;
  }

  const groupedBySpecKey = toAdds.reduce<
    Record<string, { deps: GeneratorImport[]; values: boolean }>
  >((acc, dep) => {
    const key = hasSchemaDir && dep.specKey ? dep.specKey : 'default';

    acc[key] = {
      values:
        acc[key]?.values ||
        (dep.values &&
          (isAllowSyntheticDefaultImports || !dep.syntheticDefaultImport)) ||
        false,
      deps: [...(acc[key]?.deps || []), dep],
    };

    return acc;
  }, {});

  return Object.entries(groupedBySpecKey)
    .map(([key, { values, deps }]) => {
      const defaultDep = deps.find(
        (e) =>
          e.default &&
          (isAllowSyntheticDefaultImports || !e.syntheticDefaultImport),
      );
      const syntheticDefaultImportDep = !isAllowSyntheticDefaultImports
        ? deps.find((e) => e.syntheticDefaultImport)
        : undefined;

      const depsString = uniq(
        deps
          .filter((e) => !e.default && !e.syntheticDefaultImport)
          .map(({ name, alias }) => (alias ? `${name} as ${alias}` : name)),
      ).join(',\n  ');

      let importString = '';

      const syntheticDefaultImport = syntheticDefaultImportDep
        ? `import * as ${syntheticDefaultImportDep.name} from '${dependency}';`
        : '';

      if (syntheticDefaultImport) {
        if (deps.length === 1) {
          return syntheticDefaultImport;
        }
        importString += `${syntheticDefaultImport}\n`;
      }

      importString += `import ${!values ? 'type ' : ''}${
        defaultDep ? `${defaultDep.name}${depsString ? ',' : ''}` : ''
      }${depsString ? `{\n  ${depsString}\n}` : ''} from '${dependency}${
        key !== 'default' && specsName[key] ? `/${specsName[key]}` : ''
      }'`;

      return importString;
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
  hasSchemaDir: boolean,
  isAllowSyntheticDefaultImports: boolean,
): string => {
  const dependencies = imports
    .map((dep) =>
      addDependency({
        ...dep,
        implementation,
        specsName,
        hasSchemaDir,
        isAllowSyntheticDefaultImports,
      }),
    )
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
  ...(queryParams ? [{ name: queryParams.schema.name }] : []),
  ...params.flatMap<GeneratorImport>(({ imports }) => imports),
];
