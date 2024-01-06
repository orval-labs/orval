import uniq from 'lodash.uniq';
import uniqWith from 'lodash.uniqwith';
import {
  GeneratorImport,
  GeneratorMutator,
  GeneratorVerbOptions,
  GetterPropType,
} from '../types';
import { camel, upath } from '../utils';

export const generateImports = ({
  imports = [],
  target,
  isRootKey,
  specsName,
  specKey: currentSpecKey,
}: {
  imports: GeneratorImport[];
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  specKey: string;
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
      const isSameSpecKey = currentSpecKey === specKey;
      if (specKey && !isSameSpecKey) {
        const path = specKey !== target ? specsName[specKey] : '';

        if (!isRootKey && specKey) {
          return `import ${!values ? 'type ' : ''}{ ${name}${
            alias ? ` as ${alias}` : ''
          } } from \'../${upath.join(path, camel(name))}\';`;
        }

        return `import ${!values ? 'type ' : ''}{ ${name}${
          alias ? ` as ${alias}` : ''
        } } from \'./${upath.join(path, camel(name))}\';`;
      }

      return `import ${!values ? 'type ' : ''}{ ${name}${
        alias ? ` as ${alias}` : ''
      } } from \'./${camel(name)}\';`;
    })
    .join('\n');
};

export const generateMutatorImports = ({
  mutators,
  implementation,
  oneMore,
}: {
  mutators: GeneratorMutator[];
  implementation?: string;
  oneMore?: boolean;
}) => {
  const imports = uniqWith(
    mutators,
    (a, b) => a.name === b.name && a.default === b.default,
  ).reduce((acc, mutator) => {
    const path = `${oneMore ? '../' : ''}${mutator.path}`;
    const importDefault = mutator.default
      ? mutator.name
      : `{ ${mutator.name} }`;

    acc += `import ${importDefault} from '${path}';`;
    acc += '\n';

    if (implementation && (mutator.hasErrorType || mutator.bodyTypeName)) {
      let errorImportName = '';
      if (
        mutator.hasErrorType &&
        implementation.includes(mutator.errorTypeName) &&
        !acc.includes(mutator.errorTypeName)
      ) {
        errorImportName = mutator.default
          ? `ErrorType as ${mutator.errorTypeName}`
          : mutator.errorTypeName;
      }

      let bodyImportName = '';
      if (
        mutator.bodyTypeName &&
        implementation.includes(mutator.bodyTypeName) &&
        !acc.includes(mutator.bodyTypeName)
      ) {
        bodyImportName = mutator.default
          ? `BodyType as ${mutator.bodyTypeName}`
          : mutator.bodyTypeName;
      }

      if (bodyImportName || errorImportName) {
        acc += `import type { ${errorImportName}${
          errorImportName && bodyImportName ? ', ' : ''
        }${bodyImportName} } from '${path}';`;
        acc += '\n';
      }
    }

    return acc;
  }, '');

  return imports;
};

const generateDependency = ({
  deps,
  isAllowSyntheticDefaultImports,
  dependency,
  specsName,
  key,
  onlyTypes,
}: {
  key: string;
  deps: GeneratorImport[];
  dependency: string;
  specsName: Record<string, string>;
  isAllowSyntheticDefaultImports: boolean;
  onlyTypes: boolean;
}) => {
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
  )
    .sort()
    .join(',\n  ');

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

  importString += `import ${onlyTypes ? 'type ' : ''}${
    defaultDep ? `${defaultDep.name}${depsString ? ',' : ''}` : ''
  }${depsString ? `{\n  ${depsString}\n}` : ''} from '${dependency}${
    key !== 'default' && specsName[key] ? `/${specsName[key]}` : ''
  }'`;

  return importString;
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
  const toAdds = exports.filter((e) => {
    const searchWords = [e.alias, e.name].filter((p) => p?.length).join('|');
    const pattern = new RegExp(`\\b(${searchWords})\\b`, 'g');

    return implementation.match(pattern);
  });

  if (!toAdds.length) {
    return undefined;
  }

  const groupedBySpecKey = toAdds.reduce<
    Record<string, { types: GeneratorImport[]; values: GeneratorImport[] }>
  >((acc, dep) => {
    const key = hasSchemaDir && dep.specKey ? dep.specKey : 'default';

    if (
      dep.values &&
      (isAllowSyntheticDefaultImports || !dep.syntheticDefaultImport)
    ) {
      acc[key] = {
        ...acc[key],
        values: [...(acc[key]?.values ?? []), dep],
      };

      return acc;
    }

    acc[key] = {
      ...acc[key],
      types: [...(acc[key]?.types ?? []), dep],
    };

    return acc;
  }, {});

  return Object.entries(groupedBySpecKey)
    .map(([key, { values, types }]) => {
      let dep = '';

      if (values) {
        dep += generateDependency({
          deps: values,
          isAllowSyntheticDefaultImports,
          dependency,
          specsName,
          key,
          onlyTypes: false,
        });
      }

      if (types) {
        if (values) {
          dep += '\n';
        }
        dep += generateDependency({
          deps: types,
          isAllowSyntheticDefaultImports,
          dependency,
          specsName,
          key,
          onlyTypes: true,
        });
      }

      return dep;
    })
    .join('\n');
};

const getLibName = (code: string) => {
  const splitString = code.split(' from ');
  return splitString[splitString.length - 1].split(';')[0].trim();
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
    .sort((a, b) => {
      const aLib = getLibName(a!);
      const bLib = getLibName(b!);

      if (aLib === bLib) {
        return 0;
      }

      if (aLib.startsWith("'.") && !bLib.startsWith("'.")) {
        return 1;
      }
      return aLib < bLib ? -1 : 1;
    })
    .join('\n');

  return dependencies ? dependencies + '\n' : '';
};

export const generateVerbImports = ({
  response,
  body,
  queryParams,
  props,
  headers,
  params,
}: GeneratorVerbOptions): GeneratorImport[] => [
  ...response.imports,
  ...body.imports,
  ...props.flatMap((prop) =>
    prop.type === GetterPropType.NAMED_PATH_PARAMS
      ? [{ name: prop.schema.name }]
      : [],
  ),
  ...(queryParams ? [{ name: queryParams.schema.name }] : []),
  ...(headers ? [{ name: headers.schema.name }] : []),
  ...params.flatMap<GeneratorImport>(({ imports }) => imports),
];
