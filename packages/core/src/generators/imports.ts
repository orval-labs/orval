import { unique, uniqueWith } from 'remeda';

import {
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorVerbOptions,
  GetterPropType,
  NamingConvention,
} from '../types';
import { conventionName, upath } from '../utils';

export const generateImports = ({
  imports = [],
  target,
  isRootKey,
  specsName,
  specKey: currentSpecKey,
  namingConvention = NamingConvention.CAMEL_CASE,
}: {
  imports: GeneratorImport[];
  target: string;
  isRootKey: boolean;
  specsName: Record<string, string>;
  specKey: string;
  namingConvention?: NamingConvention;
}) => {
  if (imports.length === 0) {
    return '';
  }

  return uniqueWith(
    imports,
    (a, b) =>
      a.name === b.name && a.default === b.default && a.specKey === b.specKey,
  )
    .sort()
    .map(({ specKey, name, values, alias, isConstant }) => {
      const isSameSpecKey = currentSpecKey === specKey;

      const fileName = conventionName(name, namingConvention);

      if (specKey && !isSameSpecKey) {
        const path = specKey === target ? '' : specsName[specKey];

        if (!isRootKey && specKey) {
          return `import ${!values && !isConstant ? 'type ' : ''}{ ${name}${
            alias ? ` as ${alias}` : ''
          } } from \'../${upath.join(path, fileName)}\';`;
        }

        return `import ${!values && !isConstant ? 'type ' : ''}{ ${name}${
          alias ? ` as ${alias}` : ''
        } } from \'./${upath.join(path, fileName)}\';`;
      }

      return `import ${!values && !isConstant ? 'type ' : ''}{ ${name}${
        alias ? ` as ${alias}` : ''
      } } from \'./${fileName}\';`;
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
  const imports = uniqueWith(
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
      const targetErrorImportName = mutator.default
        ? `ErrorType as ${mutator.errorTypeName}`
        : mutator.errorTypeName;
      if (
        mutator.hasErrorType &&
        implementation.includes(mutator.errorTypeName) &&
        !acc.includes(`{ ${targetErrorImportName} `)
      ) {
        errorImportName = targetErrorImportName;
      }

      let bodyImportName = '';
      const targetBodyImportName = mutator.default
        ? `BodyType as ${mutator.bodyTypeName}`
        : mutator.bodyTypeName;
      if (
        mutator.bodyTypeName &&
        implementation.includes(mutator.bodyTypeName) &&
        !acc.includes(` ${targetBodyImportName} }`)
      ) {
        bodyImportName = targetBodyImportName!;
      }

      if (bodyImportName || errorImportName) {
        acc += `import type { ${errorImportName}${
          errorImportName && bodyImportName ? ' , ' : ''
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
  // find default import if dependency either is not a synthetic import or synthetic imports are allowed
  const defaultDep = deps.find(
    (e) =>
      e.default &&
      (isAllowSyntheticDefaultImports || !e.syntheticDefaultImport),
  );

  // if default dependency could not be created, check for namespace import or a synthetic import that is not allowed
  const namespaceImportDep = defaultDep
    ? undefined
    : deps.find(
        (e) =>
          !!e.namespaceImport ||
          (!isAllowSyntheticDefaultImports && e.syntheticDefaultImport),
      );

  // find all named imports
  const depsString = unique(
    deps
      .filter(
        (e) => !e.default && !e.syntheticDefaultImport && !e.namespaceImport,
      )
      .map(({ name, alias }) => (alias ? `${name} as ${alias}` : name)),
  )
    .toSorted()
    .join(',\n  ');

  let importString = '';

  // generate namespace import string
  // For zod imports (relative paths), use the dependency path directly
  const isZodImportForNamespace =
    dependency.startsWith('./') || dependency.startsWith('../');
  const namespaceImportPath =
    isZodImportForNamespace && dependency === key
      ? dependency // Use the relative path directly for Zod files
      : dependency;
  const namespaceImportString = namespaceImportDep
    ? `import * as ${namespaceImportDep.name} from '${namespaceImportPath}';`
    : '';

  if (namespaceImportString) {
    if (deps.length === 1) {
      // only namespace import, return it directly
      return namespaceImportString;
    }
    importString += `${namespaceImportString}\n`;
  }

  // Check if dependency is a relative path (starts with './' or '../') - this indicates a Zod file import
  // In this case, use the dependency directly as the import path (dependency should equal key for zod imports)
  const isZodImport =
    dependency.startsWith('./') || dependency.startsWith('../');
  const importPath =
    isZodImport && dependency === key
      ? dependency // Use the relative path directly for Zod files
      : `${dependency}${key !== 'default' && specsName[key] ? `/${specsName[key]}` : ''}`;

  importString += `import ${onlyTypes ? 'type ' : ''}${
    defaultDep ? `${defaultDep.name}${depsString ? ',' : ''}` : ''
  }${depsString ? `{\n  ${depsString}\n}` : ''} from '${importPath}';`;

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
  // For Zod imports (relative paths), always include all exports
  // since they are needed for types and schemas even if not explicitly used in runtime code
  const isZodImport =
    dependency.startsWith('./') || dependency.startsWith('../');

  const toAdds = isZodImport
    ? exports // Include all exports for Zod imports
    : exports.filter((e) => {
        const searchWords = [e.alias, e.name]
          .filter((p) => p?.length)
          .join('|');
        const pattern = new RegExp(`\\b(${searchWords})\\b`, 'g');

        return implementation.match(pattern);
      });

  if (toAdds.length === 0) {
    return;
  }

  const groupedBySpecKey = toAdds.reduce<
    Record<string, { types: GeneratorImport[]; values: GeneratorImport[] }>
  >((acc, dep) => {
    // If specKey is a relative path (starts with './' or '../'), use it directly
    // Otherwise, use the standard logic with hasSchemaDir
    const key =
      dep.specKey &&
      (dep.specKey.startsWith('./') || dep.specKey.startsWith('../'))
        ? dep.specKey
        : hasSchemaDir && dep.specKey
          ? dep.specKey
          : 'default';

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

  return (
    Object.entries(groupedBySpecKey)
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
          let uniqueTypes = types;
          if (values) {
            uniqueTypes = types.filter(
              (t) => !values.some((v) => v.name === t.name),
            );
            dep += '\n';
          }
          dep += generateDependency({
            deps: uniqueTypes,
            isAllowSyntheticDefaultImports,
            dependency,
            specsName,
            key,
            onlyTypes: true,
          });
        }

        return dep;
      })
      .join('\n') + '\n'
  );
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
  // Use queryParams.schema.imports if available (for zod model style), otherwise use schema.name
  ...(queryParams
    ? queryParams.schema.imports && queryParams.schema.imports.length > 0
      ? queryParams.schema.imports
      : [{ name: queryParams.schema.name }]
    : []),
  // Use headers.schema.imports if available, otherwise use schema.name
  ...(headers
    ? headers.schema.imports && headers.schema.imports.length > 0
      ? headers.schema.imports
      : [{ name: headers.schema.name }]
    : []),
  ...params.flatMap<GeneratorImport>(({ imports }) => imports),
];
