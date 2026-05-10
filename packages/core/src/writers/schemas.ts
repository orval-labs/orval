import nodePath from 'node:path';

import fs from 'fs-extra';
import { groupBy } from 'remeda';

import { generateImports } from '../generators';
import {
  type GeneratorImport,
  type GeneratorSchema,
  NamingConvention,
  type Tsconfig,
} from '../types';
import { conventionName, getImportExtension, upath } from '../utils';
import { writeGeneratedFile } from './file';

type CanonicalInfo = Pick<GeneratorImport, 'importPath' | 'name'>;

/**
 * Patterns to detect operation-derived types (params, bodies, responses).
 * These types are auto-generated from OpenAPI operations, not from component schemas.
 */
const OPERATION_TYPE_PATTERNS = [
  /Params$/i, // GetUserParams, ListUsersParams
  /Body$/, // CreateUserBody, UpdatePostBody (case-sensitive to avoid "Antibody")
  /Body(One|Two|Three|Four|Five|Item)$/, // BodyOne, BodyTwo (union body types)
  /Parameter$/i, // PageParameter, LimitParameter
  /Query$/i, // GetUserQuery
  /Header$/i, // AuthHeader
  /Response\d*$/i, // GetUser200Response, NotFoundResponse
  /^[1-5]\d{2}$/, // 200, 201, 404 (valid HTTP status codes: 1xx-5xx)
  /\d{3}(One|Two|Three|Four|Five|Item)$/i, // 200One, 200Two (union response types)
  /^(get|post|put|patch|delete|head|options)[A-Z].*\d{3}$/, // operation types with status codes (get...200, post...404)
];

/**
 * Check if a schema name matches operation type patterns.
 */
function isOperationType(schemaName: string): boolean {
  return OPERATION_TYPE_PATTERNS.some((pattern) => pattern.test(schemaName));
}

/**
 * Split schemas into regular and operation types.
 */
export function splitSchemasByType(schemas: GeneratorSchema[]): {
  regularSchemas: GeneratorSchema[];
  operationSchemas: GeneratorSchema[];
} {
  const regularSchemas: GeneratorSchema[] = [];
  const operationSchemas: GeneratorSchema[] = [];

  for (const schema of schemas) {
    if (isOperationType(schema.name)) {
      operationSchemas.push(schema);
    } else {
      regularSchemas.push(schema);
    }
  }

  return { regularSchemas, operationSchemas };
}

/**
 * Fix cross-directory imports when schemas reference other schemas in a different directory.
 * Updates import paths to use correct relative paths between directories.
 */
function fixSchemaImports(
  schemas: GeneratorSchema[],
  targetSchemaNames: Set<string>,
  fromPath: string,
  toPath: string,
  namingConvention: NamingConvention,
  fileExtension: string,
  tsconfig?: Tsconfig,
): void {
  const relativePath = upath.relativeSafe(fromPath, toPath);
  const importExtension = getImportExtension(fileExtension, tsconfig);

  for (const schema of schemas) {
    schema.imports = schema.imports.map((imp) => {
      if (targetSchemaNames.has(imp.name)) {
        const fileName = conventionName(imp.name, namingConvention);
        return {
          ...imp,
          importPath: upath.joinSafe(relativePath, fileName) + importExtension,
        };
      }
      return imp;
    });
  }
}

/**
 * Fix imports in operation schemas that reference regular schemas.
 */
export function fixCrossDirectoryImports(
  operationSchemas: GeneratorSchema[],
  regularSchemaNames: Set<string>,
  schemaPath: string,
  operationSchemaPath: string,
  namingConvention: NamingConvention,
  fileExtension: string,
  tsconfig?: Tsconfig,
): void {
  fixSchemaImports(
    operationSchemas,
    regularSchemaNames,
    operationSchemaPath,
    schemaPath,
    namingConvention,
    fileExtension,
    tsconfig,
  );
}

/**
 * Fix imports in regular schemas that reference operation schemas.
 */
export function fixRegularSchemaImports(
  regularSchemas: GeneratorSchema[],
  operationSchemaNames: Set<string>,
  schemaPath: string,
  operationSchemaPath: string,
  namingConvention: NamingConvention,
  fileExtension: string,
  tsconfig?: Tsconfig,
): void {
  fixSchemaImports(
    regularSchemas,
    operationSchemaNames,
    schemaPath,
    operationSchemaPath,
    namingConvention,
    fileExtension,
    tsconfig,
  );
}

function getSchemaKey(
  schemaPath: string,
  schemaName: string,
  namingConvention: NamingConvention,
  fileExtension: string,
) {
  return getPath(
    schemaPath,
    conventionName(schemaName, namingConvention),
    fileExtension,
  )
    .toLowerCase()
    .replaceAll('\\', '/');
}

function getSchemaGroups(
  schemaPath: string,
  schemas: GeneratorSchema[],
  namingConvention: NamingConvention,
  fileExtension: string,
) {
  return groupBy(schemas, (schema) =>
    getSchemaKey(schemaPath, schema.name, namingConvention, fileExtension),
  );
}

function getCanonicalMap(
  schemaGroups: Record<string, GeneratorSchema[]>,
  schemaPath: string,
  namingConvention: NamingConvention,
  fileExtension: string,
) {
  const canonicalPathMap = new Map<string, CanonicalInfo>();
  const canonicalNameMap = new Map<string, CanonicalInfo>();

  for (const [key, groupSchemas] of Object.entries(schemaGroups)) {
    const canonicalPath = getPath(
      schemaPath,
      conventionName(groupSchemas[0].name, namingConvention),
      fileExtension,
    );

    const canonicalInfo = {
      importPath: canonicalPath,
      name: groupSchemas[0].name,
    };

    canonicalPathMap.set(key, canonicalInfo);
    for (const schema of groupSchemas) {
      canonicalNameMap.set(schema.name, canonicalInfo);
    }
  }

  return {
    canonicalPathMap,
    canonicalNameMap,
  };
}

function normalizeCanonicalImportPaths(
  schemas: GeneratorSchema[],
  canonicalPathMap: Map<string, CanonicalInfo>,
  canonicalNameMap: Map<string, CanonicalInfo>,
  schemaPath: string,
  namingConvention: NamingConvention,
  fileExtension: string,
  tsconfig?: Tsconfig,
  factoryOutputDirectory?: string,
) {
  const importExtension = getImportExtension(fileExtension, tsconfig);
  const factoryDir = factoryOutputDirectory ?? schemaPath;

  for (const schema of schemas) {
    schema.imports = schema.imports.map((imp) => {
      const canonicalByName = canonicalNameMap.get(imp.name);

      const resolvedImportKey = resolveImportKey(
        schemaPath,
        imp.importPath ?? `./${conventionName(imp.name, namingConvention)}`,
        fileExtension,
      );
      const canonicalByPath = canonicalPathMap.get(resolvedImportKey);
      const canonical = canonicalByName ?? canonicalByPath;
      if (!canonical?.importPath) return imp;

      const relative = upath.relativeSafe(
        schemaPath,
        canonical.importPath.replaceAll('\\', '/'),
      );
      // `relative` derives from canonical.importPath (built via getPath) so it
      // normally ends with `fileExtension`; the `.ts$` branch is a defensive
      // fallback for legacy/hardcoded `.ts` paths that don't match the
      // configured fileExtension (e.g. `.gen.ts`).
      const withoutFileExtension = relative.endsWith(fileExtension)
        ? relative.slice(0, -fileExtension.length)
        : relative.replace(/\.ts$/, '');
      const importPath = `${withoutFileExtension}${importExtension}`;

      return { ...imp, importPath };
    });

    if (schema.factoryImports) {
      schema.factoryImports = schema.factoryImports.map((imp) => {
        const canonicalByName = canonicalNameMap.get(imp.name);

        const resolvedImportKey = resolveImportKey(
          factoryDir,
          imp.importPath ?? `./${conventionName(imp.name, namingConvention)}`,
          fileExtension,
        );
        const canonicalByPath = canonicalPathMap.get(resolvedImportKey);
        const canonical = canonicalByName ?? canonicalByPath;
        if (!canonical?.importPath) return imp;

        const relative = upath.relativeSafe(
          factoryDir,
          canonical.importPath.replaceAll('\\', '/'),
        );
        const withoutFileExtension = relative.endsWith(fileExtension)
          ? relative.slice(0, -fileExtension.length)
          : relative.replace(/\.ts$/, '');
        const importPath = `${withoutFileExtension}${importExtension}`;

        return { ...imp, importPath };
      });
    }
  }
}

function mergeSchemaGroup(schemas: GeneratorSchema[]): GeneratorSchema {
  const baseSchemaName = schemas[0].name;
  const baseSchema = schemas[0].schema;
  const mergedImports = [
    ...new Map(
      schemas
        .flatMap((schema) => schema.imports)
        .map((imp) => [JSON.stringify(imp), imp]),
    ).values(),
  ];
  const mergedDependencies = [
    ...new Set(schemas.flatMap((schema) => schema.dependencies ?? [])),
  ];

  const mergedFactory = schemas
    .map((s) => s.factory)
    .filter(Boolean)
    .join('\n');
  const mergedFactoryImports = [
    ...new Map(
      schemas
        .flatMap((schema) => schema.factoryImports ?? [])
        .map((imp) => [JSON.stringify(imp), imp] as [string, GeneratorImport]),
    ).values(),
  ];

  return {
    name: baseSchemaName,
    schema: baseSchema,
    model: schemas.map((schema) => schema.model).join('\n'),
    imports: mergedImports,
    dependencies: mergedDependencies,
    factory: mergedFactory || undefined,
    factoryImports: mergedFactoryImports,
    factoryMode: schemas[0].factoryMode,
  };
}

function resolveImportKey(
  schemaPath: string,
  importPath: string,
  fileExtension: string,
) {
  return upath
    .join(schemaPath, `${importPath}${fileExtension}`)
    .toLowerCase()
    .replaceAll('\\', '/');
}

interface GetSchemaOptions {
  schema: GeneratorSchema;
  target: string;
  header: string;
  namingConvention?: NamingConvention;
  importExtension?: string;
}

function getSchema({
  schema: { imports, model },
  header,
  namingConvention = NamingConvention.CAMEL_CASE,
  importExtension,
}: GetSchemaOptions): string {
  let file = header;
  file += generateImports({
    imports: imports.filter(
      (imp) =>
        !model.includes(`type ${imp.alias ?? imp.name} =`) &&
        !model.includes(`interface ${imp.alias ?? imp.name} {`),
    ),
    namingConvention,
    importExtension,
  });
  file += imports.length > 0 ? '\n\n' : '\n';
  file += model;
  return file;
}

function getPath(path: string, name: string, fileExtension: string): string {
  return nodePath.join(path, `${name}${fileExtension}`);
}

export function writeModelInline(acc: string, model: string): string {
  return acc + `${model}\n`;
}

export function writeModelsInline(array: GeneratorSchema[]): string {
  let acc = '';
  for (const { model } of array) {
    acc = writeModelInline(acc, model);
  }
  return acc;
}

interface WriteSchemaOptions {
  path: string;
  schema: GeneratorSchema;
  target: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  header: string;
  tsconfig?: Tsconfig;
}

export async function writeSchema({
  path,
  schema,
  target,
  namingConvention,
  fileExtension,
  header,
  tsconfig,
}: WriteSchemaOptions) {
  const name = conventionName(schema.name, namingConvention);

  try {
    await writeGeneratedFile(
      getPath(path, name, fileExtension),
      getSchema({
        schema,
        target,
        header,
        namingConvention,
        importExtension: getImportExtension(fileExtension, tsconfig),
      }),
    );
  } catch (error) {
    throw new Error(
      `Oups... 🍻. An Error occurred while writing schema ${name} => ${String(error)}`,
      { cause: error },
    );
  }
}

interface WriteSchemasOptions {
  schemaPath: string;
  schemas: GeneratorSchema[];
  target: string;
  namingConvention: NamingConvention;
  fileExtension: string;
  header: string;
  indexFiles: boolean;
  tsconfig?: Tsconfig;
  factoryOutputDirectory?: string;
}

async function emitFactoryForSchema(
  schema: GeneratorSchema,
  namingConvention: NamingConvention,
  header: string,
  factoryDir: string,
  fileExtension: string,
  helpers: {
    separateFactoryNames: string[];
    combinedFactoryContent: { value: string };
    combinedFactoryImports: GeneratorImport[];
    isCombined: { value: boolean };
  },
) {
  if (schema.factory && schema.factoryMode) {
    const mode = schema.factoryMode;
    if (mode === 'separate-file') {
      const baseName = conventionName(schema.name, namingConvention);
      const factoryName = `${baseName}.factory`;
      helpers.separateFactoryNames.push(factoryName);
      const factoryImportsStr = generateImports({
        imports: schema.factoryImports ?? [],
        namingConvention,
      });
      const factoryFile = `${header}\n${factoryImportsStr}\n\n${schema.factory}`;
      await writeGeneratedFile(
        getPath(factoryDir, factoryName, fileExtension),
        factoryFile,
      );
    } else if (mode === 'combined-separate-file') {
      helpers.isCombined.value = true;
      helpers.combinedFactoryContent.value += `${schema.factory}\n`;
      helpers.combinedFactoryImports.push(...(schema.factoryImports ?? []));
    }
  }
}

export async function writeSchemas({
  schemaPath,
  schemas,
  target,
  namingConvention,
  fileExtension,
  header,
  indexFiles,
  tsconfig,
  factoryOutputDirectory,
}: WriteSchemasOptions) {
  const schemaGroups = getSchemaGroups(
    schemaPath,
    schemas,
    namingConvention,
    fileExtension,
  );

  const { canonicalPathMap, canonicalNameMap } = getCanonicalMap(
    schemaGroups,
    schemaPath,
    namingConvention,
    fileExtension,
  );

  normalizeCanonicalImportPaths(
    schemas,
    canonicalPathMap,
    canonicalNameMap,
    schemaPath,
    namingConvention,
    fileExtension,
    tsconfig,
    factoryOutputDirectory,
  );

  const factoryDir = factoryOutputDirectory ?? schemaPath;

  const combinedFactoryContent = { value: '' };
  const combinedFactoryImports: GeneratorImport[] = [];
  const isCombined = { value: false };
  const separateFactoryNames: string[] = [];

  const factoryHelpers = {
    separateFactoryNames,
    combinedFactoryContent,
    combinedFactoryImports,
    isCombined,
  };

  for (const groupSchemas of Object.values(schemaGroups)) {
    if (groupSchemas.length === 1) {
      await writeSchema({
        path: schemaPath,
        schema: groupSchemas[0],
        target,
        namingConvention,
        fileExtension,
        header,
        tsconfig,
      });

      const singleSchema = groupSchemas[0];
      await emitFactoryForSchema(
        singleSchema,
        namingConvention,
        header,
        factoryDir,
        fileExtension,
        factoryHelpers,
      );
      continue;
    }

    const mergedSchema = mergeSchemaGroup(groupSchemas);

    await writeSchema({
      path: schemaPath,
      schema: mergedSchema,
      target,
      namingConvention,
      fileExtension,
      header,
      tsconfig,
    });

    await emitFactoryForSchema(
      mergedSchema,
      namingConvention,
      header,
      factoryDir,
      fileExtension,
      factoryHelpers,
    );
  }

  if (isCombined.value) {
    const factoryFileName = conventionName('factoryMethods', namingConvention);
    const factoryFileImports = generateImports({
      imports: combinedFactoryImports,
      namingConvention,
    });
    const factoryFile = `${header}\n${factoryFileImports}\n\n${combinedFactoryContent.value}`;
    await writeGeneratedFile(
      getPath(factoryDir, factoryFileName, fileExtension),
      factoryFile,
    );
  }

  if (indexFiles) {
    const schemaFilePath = nodePath.join(schemaPath, `index.ts`);
    await fs.ensureFile(schemaFilePath);

    // Ensure separate files are used for parallel schema writing.
    // Throw an exception if duplicates are detected (using convention names)
    const ext = getImportExtension(fileExtension, tsconfig);
    const conventionNamesSet = new Set(
      Object.values(schemaGroups).map((group) =>
        conventionName(group[0].name, namingConvention),
      ),
    );

    try {
      // Create unique export statements from schemas (deduplicate by schema name)
      const uniqueSchemaNames = [...conventionNamesSet];

      // Create export statements
      const currentExports = uniqueSchemaNames.map(
        (schemaName) => `export * from './${schemaName}${ext}';`,
      );

      if (
        factoryOutputDirectory &&
        upath.normalizeSafe(factoryOutputDirectory) !==
          upath.normalizeSafe(schemaPath) &&
        (isCombined.value || separateFactoryNames.length > 0)
      ) {
        const factoryIndexFilePath = nodePath.join(
          factoryOutputDirectory,
          `index.ts`,
        );
        await fs.ensureFile(factoryIndexFilePath);
        const factoryExports: string[] = [];
        if (isCombined.value) {
          const factoryFileName = conventionName(
            'factoryMethods',
            namingConvention,
          );
          factoryExports.push(`export * from './${factoryFileName}${ext}';`);
        }
        for (const fName of separateFactoryNames) {
          factoryExports.push(`export * from './${fName}${ext}';`);
        }
        const content = `${header}\n${factoryExports.join('\n')}\n`;
        await writeGeneratedFile(factoryIndexFilePath, content);
      } else {
        if (isCombined.value) {
          const factoryFileName = conventionName(
            'factoryMethods',
            namingConvention,
          );
          currentExports.push(`export * from './${factoryFileName}${ext}';`);
        }
        for (const fName of separateFactoryNames) {
          currentExports.push(`export * from './${fName}${ext}';`);
        }
      }

      const exports = [...new Set(currentExports)]
        .toSorted((a, b) => a.localeCompare(b, 'en', { numeric: true }))
        .join('\n');

      const fileContent = `${header}\n${exports}\n`;

      await writeGeneratedFile(schemaFilePath, fileContent);
    } catch (error) {
      throw new Error(
        `Oups... 🍻. An Error occurred while writing schema index file ${schemaFilePath} => ${String(error)}`,
        { cause: error },
      );
    }
  }
}
