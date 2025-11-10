import { groupBy, unique, uniqueWith } from 'remeda';

import {
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorVerbOptions,
  GetterPropType,
  NamingConvention,
} from '../types.ts';
import { conventionName } from '../utils/index.ts';

interface GenerateImportsOptions {
  imports: readonly GeneratorImport[];
  target: string;
  namingConvention?: NamingConvention;
}

export function generateImports({
  imports,
  namingConvention = NamingConvention.CAMEL_CASE,
}: GenerateImportsOptions) {
  if (imports.length === 0) {
    return '';
  }

  const normalized = uniqueWith(
    imports,
    (a, b) =>
      a.name === b.name &&
      a.default === b.default &&
      a.alias === b.alias &&
      a.values === b.values &&
      a.isConstant === b.isConstant &&
      a.namespaceImport === b.namespaceImport &&
      a.syntheticDefaultImport === b.syntheticDefaultImport &&
      a.importPath === b.importPath,
  ).map((imp) => ({
    ...imp,
    importPath:
      imp.importPath ?? `./${conventionName(imp.name, namingConvention)}`,
  }));

  const grouped = groupBy(normalized, (imp) =>
    !imp.default &&
    !imp.namespaceImport &&
    !imp.syntheticDefaultImport &&
    !imp.values &&
    !imp.isConstant
      ? `aggregate|${imp.importPath}`
      : `single|${imp.importPath}|${imp.name}|${imp.alias ?? ''}|${String(
          imp.default,
        )}|${String(imp.namespaceImport)}|${String(imp.syntheticDefaultImport)}|${String(
          imp.values,
        )}|${String(imp.isConstant)}`,
  );

  return Object.entries(grouped)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([, group]) => {
      const sample = group[0];
      const canAggregate =
        !sample.default &&
        !sample.namespaceImport &&
        !sample.syntheticDefaultImport &&
        !sample.values &&
        !sample.isConstant;

      if (canAggregate) {
        const names = [
          ...new Set(
            group.map(
              ({ name, alias }) => `${name}${alias ? ` as ${alias}` : ''}`,
            ),
          ),
        ]
          .toSorted()
          .join(', ');

        return `import type { ${names} } from '${sample.importPath}';`;
      }

      const { name, values, alias, isConstant, importPath } = sample;
      return `import ${!values && !isConstant ? 'type ' : ''}{ ${name}${
        alias ? ` as ${alias}` : ''
      } } from '${importPath}';`;
    })
    .join('\n');
}

interface GenerateMutatorImportsOptions {
  mutators: GeneratorMutator[];
  implementation?: string;
  oneMore?: boolean;
}

export function generateMutatorImports({
  mutators,
  implementation,
  oneMore,
}: GenerateMutatorImportsOptions) {
  let imports = '';
  for (const mutator of uniqueWith(
    mutators,
    (a, b) => a.name === b.name && a.default === b.default,
  )) {
    const path = `${oneMore ? '../' : ''}${mutator.path}`;
    const importDefault = mutator.default
      ? mutator.name
      : `{ ${mutator.name} }`;

    imports += `import ${importDefault} from '${path}';`;
    imports += '\n';

    if (implementation && (mutator.hasErrorType || mutator.bodyTypeName)) {
      let errorImportName = '';
      const targetErrorImportName = mutator.default
        ? `ErrorType as ${mutator.errorTypeName}`
        : mutator.errorTypeName;
      if (
        mutator.hasErrorType &&
        implementation.includes(mutator.errorTypeName) &&
        !imports.includes(`{ ${targetErrorImportName} `)
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
        !imports.includes(` ${targetBodyImportName} }`)
      ) {
        bodyImportName = targetBodyImportName ?? '';
      }

      if (bodyImportName || errorImportName) {
        imports += `import type { ${errorImportName}${
          errorImportName && bodyImportName ? ' , ' : ''
        }${bodyImportName} } from '${path}';`;
        imports += '\n';
      }
    }
  }

  return imports;
}

interface GenerateDependencyOptions {
  key: string;
  deps: readonly GeneratorImport[];
  dependency: string;
  projectName?: string;
  isAllowSyntheticDefaultImports: boolean;
  onlyTypes: boolean;
}

function generateDependency({
  deps,
  isAllowSyntheticDefaultImports,
  dependency,
  projectName,
  key,
  onlyTypes,
}: GenerateDependencyOptions) {
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
  const namespaceImportString = namespaceImportDep
    ? `import * as ${namespaceImportDep.name} from '${dependency}';`
    : '';

  if (namespaceImportString) {
    if (deps.length === 1) {
      // only namespace import, return it directly
      return namespaceImportString;
    }
    importString += `${namespaceImportString}\n`;
  }

  importString += `import ${onlyTypes ? 'type ' : ''}${
    defaultDep ? `${defaultDep.name}${depsString ? ',' : ''}` : ''
  }${depsString ? `{\n  ${depsString}\n}` : ''} from '${dependency}${
    key !== 'default' && projectName ? `/${projectName}` : ''
  }';`;

  return importString;
}

interface AddDependencyOptions {
  implementation: string;
  exports: readonly GeneratorImport[];
  dependency: string;
  projectName?: string;
  hasSchemaDir: boolean;
  isAllowSyntheticDefaultImports: boolean;
}

export function addDependency({
  implementation,
  exports,
  dependency,
  projectName,
  isAllowSyntheticDefaultImports,
}: AddDependencyOptions) {
  const toAdds = exports.filter((e) => {
    const searchWords = [e.alias, e.name].filter((p) => p?.length).join('|');
    const pattern = new RegExp(String.raw`\b(${searchWords})\b`, 'g');

    return implementation.match(pattern);
  });

  if (toAdds.length === 0) {
    return;
  }

  const groupedBySpecKey: Record<
    string,
    { types: GeneratorImport[]; values: GeneratorImport[] }
  > = { default: { types: [], values: [] } };
  for (const dep of toAdds) {
    const key = 'default';

    if (
      dep.values &&
      (isAllowSyntheticDefaultImports || !dep.syntheticDefaultImport)
    ) {
      groupedBySpecKey[key].values.push(dep);
    } else {
      groupedBySpecKey[key].types.push(dep);
    }
  }

  return (
    Object.entries(groupedBySpecKey)
      .map(([key, { values, types }]) => {
        let dep = '';

        if (values.length > 0) {
          dep += generateDependency({
            deps: values,
            isAllowSyntheticDefaultImports,
            dependency,
            projectName,
            key,
            onlyTypes: false,
          });
        }

        if (types.length > 0) {
          let uniqueTypes = types;
          if (values.length > 0) {
            uniqueTypes = types.filter(
              (t) =>
                !values.some(
                  (v) =>
                    v.name === t.name && (v.alias ?? '') === (t.alias ?? ''),
                ),
            );
            dep += '\n';
          }
          dep += generateDependency({
            deps: uniqueTypes,
            isAllowSyntheticDefaultImports,
            dependency,
            projectName,
            key,
            onlyTypes: true,
          });
        }

        return dep;
      })
      .join('\n') + '\n'
  );
}

function getLibName(code: string) {
  const splitString = code.split(' from ');
  return splitString[splitString.length - 1].split(';')[0].trim();
}

export function generateDependencyImports(
  implementation: string,
  imports: {
    exports: readonly GeneratorImport[];
    dependency: string;
  }[],
  projectName: string | undefined,
  hasSchemaDir: boolean,
  isAllowSyntheticDefaultImports: boolean,
): string {
  const dependencies = imports
    .map((dep) =>
      addDependency({
        ...dep,
        implementation,
        projectName,
        hasSchemaDir,
        isAllowSyntheticDefaultImports,
      }),
    )
    // eslint-disable-next-line unicorn/prefer-native-coercion-functions -- type predicate (x is string) required for narrowing
    .filter((x): x is string => Boolean(x))
    .toSorted((a, b) => {
      const aLib = getLibName(a);
      const bLib = getLibName(b);

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
}

export function generateVerbImports({
  response,
  body,
  queryParams,
  props,
  headers,
  params,
}: GeneratorVerbOptions): GeneratorImport[] {
  const imports: GeneratorImport[] = [
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

  // Zod schema named `Error` is a common collision with the global `Error` value.
  // If we need it as a runtime value (e.g. `.parse()`), alias the value import to
  // `ErrorSchema` while keeping the `Error` type available.
  return imports.flatMap((imp) => {
    if (imp.name !== 'Error' || !imp.values || imp.alias) {
      return [imp];
    }

    return [
      // Type-only import keeps `Error` usable as a type.
      { ...imp, values: undefined },
      // Value import is aliased to avoid shadowing `globalThis.Error`.
      { ...imp, alias: 'ErrorSchema', values: true },
    ];
  });
}
