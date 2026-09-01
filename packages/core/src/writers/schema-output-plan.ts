import nodePath from 'node:path';

import type {
  GeneratedSchemaKind,
  GeneratorSchema,
  NormalizedOutputOptions,
  NormalizedSchemaOptions,
  NamingConvention,
  Tsconfig,
} from '../types';
import { conventionName, getImportExtension, isString, upath } from '../utils';

/** Detects enum definitions used to select the configured schema route. */
function isOpenApiEnumSchema(schema: GeneratorSchema['schema']): boolean {
  return (
    !!schema &&
    typeof schema === 'object' &&
    Array.isArray((schema as { enum?: unknown }).enum)
  );
}

export type SchemaRouteKey = 'default' | 'enum';

export interface SchemaOutputPlanOptions {
  basePath: string;
  schemas: GeneratorSchema[];
  routes: NonNullable<NormalizedSchemaOptions['routes']>;
  namingConvention: NamingConvention;
  fileExtension: string;
  indexFiles: boolean;
  importPath?: string;
  tsconfig?: Tsconfig;
  schemaTagMap?: ReadonlyMap<string, string>;
}

// Shared by schema writers and client import generation.
export interface SchemaOutputPlan {
  basePath: string;
  canonicalSchemas: GeneratorSchema[];
  canonicalNameByAlias: Map<string, string>;
  routeKeyByName: Map<string, SchemaRouteKey>;
  routePathByName: Map<string, string>;
  scopePathByName: Map<string, string>;
  filePathByName: Map<string, string>;
  importPathByName: Map<string, string>;
  routePathByKey: Record<SchemaRouteKey, string>;
  routeDirectories: string[];
  usesTagRouting: boolean;
  rootIndexPath?: string;
  /** Registers a schema path that is discovered after the initial plan. */
  registerSchema(
    name: string,
    route: SchemaRouteKey,
    scopePath?: string,
  ): string;
  /** Returns the canonical generated identifier for a schema alias. */
  canonicalNameFor(name: string): string;
  /** Computes a relative import from one planned schema to another. */
  importPathFor(importerName: string, targetName: string): string;
  /** Computes a client import path for a planned schema. */
  clientImportPath(name: string, relativeSchemasPath: string): string;
  /** Computes a package import path for a planned schema when applicable. */
  packageImportPath(name: string): string | undefined;
  /** Reports whether a name or alias is present in the plan. */
  hasSchema(name: string): boolean;
}

/** Normalizes a schema name for grouping names that generate the same file. */
function schemaNameKey(name: string, namingConvention: NamingConvention) {
  return conventionName(name, namingConvention).toLowerCase();
}

/** Converts a schema name to the configured output naming convention. */
function canonicalName(name: string, namingConvention: NamingConvention) {
  return conventionName(name, namingConvention);
}

/** Merges generated schemas that share the same original name. */
function mergeSchemas(schemas: GeneratorSchema[]): GeneratorSchema {
  const first = schemas[0];
  const kinds = new Set(schemas.map((schema) => requireSchemaKind(schema)));
  if (kinds.size > 1) {
    throw new Error(
      `Conflicting generated schema kinds for canonical schema "${first.name}".`,
    );
  }

  return {
    ...first,
    model: schemas.map((schema) => schema.model).join('\n'),
    imports: [
      ...new Map(
        schemas
          .flatMap((schema) => schema.imports)
          .map((imp) => [JSON.stringify(imp), imp]),
      ).values(),
    ],
    dependencies: [
      ...new Set(schemas.flatMap((schema) => schema.dependencies ?? [])),
    ],
    kind: requireSchemaKind(first),
  };
}

/** Returns schema kind metadata or fails when route planning lacks it. */
function requireSchemaKind(schema: GeneratorSchema): GeneratedSchemaKind {
  if (!schema.kind) {
    throw new Error(
      `Generated schema "${schema.name}" is missing its kind metadata.`,
    );
  }
  return schema.kind;
}

/** Serializes schema values with sorted keys for order-independent comparison. */
function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }
  if (typeof value !== 'object') return JSON.stringify(value);

  return `{${Object.entries(value as Record<string, unknown>)
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`;
}

/** Checks whether two generated schemas have the same kind and definition. */
function hasSameSchemaDefinition(
  left: GeneratorSchema,
  right: GeneratorSchema,
): boolean {
  return (
    left.kind === right.kind &&
    left.schema !== undefined &&
    right.schema !== undefined &&
    stableSerialize(left.schema) === stableSerialize(right.schema)
  );
}

/** Rejects generated-file collisions between incompatible schema definitions. */
function assertNoConflictingCanonicalSchema(
  schemas: GeneratorSchema[],
  namingConvention: NamingConvention,
): void {
  const canonical = schemas[0];
  const aliases = schemas.filter((schema) => schema.name !== canonical.name);
  const conflictingAlias = aliases.find(
    (schema) => !hasSameSchemaDefinition(canonical, schema),
  );
  if (aliases.length > 0 && conflictingAlias) {
    const generatedName = conventionName(canonical.name, namingConvention);
    throw new Error(
      `Schemas "${canonical.name}" and "${conflictingAlias.name}" produce the same generated file "${generatedName}" but have different definitions. Rename one schema or change the naming convention.`,
    );
  }
}

/** Removes the configured extension from a generated file name. */
function stripExtension(fileName: string, fileExtension: string) {
  return fileName.endsWith(fileExtension)
    ? fileName.slice(0, -fileExtension.length)
    : fileName;
}

/** Builds the output plan used to route generated schemas and their imports. */
export function createSchemaOutputPlan({
  basePath,
  schemas,
  routes,
  namingConvention,
  fileExtension,
  indexFiles,
  importPath,
  tsconfig,
  schemaTagMap,
}: SchemaOutputPlanOptions): SchemaOutputPlan {
  const grouped = new Map<string, GeneratorSchema[]>();
  for (const schema of schemas) {
    const key = schemaNameKey(schema.name, namingConvention);
    const group = grouped.get(key);
    if (group) group.push(schema);
    else grouped.set(key, [schema]);
  }

  const canonicalNameByAlias = new Map<string, string>();
  const canonicalSchemas = [...grouped.values()].map((group) => {
    assertNoConflictingCanonicalSchema(group, namingConvention);

    const canonical = group[0];
    for (const schema of group) {
      canonicalNameByAlias.set(schema.name, canonical.name);
    }

    // Keep one definition for equivalent aliases and resolve imports to it.
    return group.length === 1 ||
      group.some((schema) => schema.name !== canonical.name)
      ? { ...canonical, kind: requireSchemaKind(canonical) }
      : mergeSchemas(group);
  });
  const routeKeyByName = new Map<string, SchemaRouteKey>();
  const routePathByName = new Map<string, string>();
  const scopePathByName = new Map<string, string>();
  const filePathByName = new Map<string, string>();
  const importPathByName = new Map<string, string>();
  const routePathByKey: Record<SchemaRouteKey, string> = {
    default: nodePath.join(basePath, routes.default),
    enum: nodePath.join(basePath, routes.enum ?? routes.default),
  };
  const routeDirectories = [
    ...new Set(
      canonicalSchemas.map((schema) => {
        const routeKey: SchemaRouteKey =
          schema.kind === 'enum' && routes.enum ? 'enum' : 'default';
        const routePath = routePathByKey[routeKey];
        // '.' marks schemas shared across tag scopes.
        const tag = schemaTagMap?.get(schema.name);
        const directory = schemaTagMap
          ? nodePath.join(routePath, tag === '.' ? 'shared' : (tag ?? 'shared'))
          : routePath;
        const key = schema.name;
        const fileName = `${conventionName(schema.name, namingConvention)}${fileExtension}`;
        const filePath = nodePath.join(directory, fileName);
        routeKeyByName.set(key, routeKey);
        routePathByName.set(key, directory);
        scopePathByName.set(key, directory);
        filePathByName.set(key, filePath);
        importPathByName.set(
          key,
          `./${upath.toUnix(
            stripExtension(
              nodePath.relative(basePath, filePath),
              fileExtension,
            ),
          )}`,
        );
        return directory;
      }),
    ),
  ];

  const findKey = (name: string) => {
    const alias = canonicalNameByAlias.get(name);
    if (alias && filePathByName.has(alias)) return alias;
    if (filePathByName.has(name)) return name;
    const converted = canonicalName(name, namingConvention);
    if (filePathByName.has(converted)) return converted;
    return (
      [...filePathByName.keys()].find(
        (key) => key.toLowerCase() === name.toLowerCase(),
      ) ?? name
    );
  };

  return {
    basePath,
    canonicalSchemas,
    canonicalNameByAlias,
    routeKeyByName,
    routePathByName,
    scopePathByName,
    filePathByName,
    importPathByName,
    routePathByKey,
    routeDirectories,
    usesTagRouting: !!schemaTagMap,
    rootIndexPath: indexFiles ? nodePath.join(basePath, 'index.ts') : undefined,
    registerSchema(name, route, scopePath = routePathByKey[route]) {
      const existing = filePathByName.get(name);
      if (existing) return existing;

      const filePath = nodePath.join(
        scopePath,
        `${conventionName(name, namingConvention)}${fileExtension}`,
      );
      routeKeyByName.set(name, route);
      routePathByName.set(name, scopePath);
      scopePathByName.set(name, scopePath);
      filePathByName.set(name, filePath);
      importPathByName.set(
        name,
        `./${upath.toUnix(
          stripExtension(nodePath.relative(basePath, filePath), fileExtension),
        )}`,
      );
      if (!routeDirectories.includes(scopePath)) {
        routeDirectories.push(scopePath);
      }
      return filePath;
    },
    canonicalNameFor(name) {
      return canonicalNameByAlias.get(name) ?? name;
    },
    importPathFor(importerName, targetName) {
      const importerPath = filePathByName.get(findKey(importerName));
      const targetPath = filePathByName.get(findKey(targetName));
      if (!importerPath || !targetPath) return `./${targetName}`;

      const extension = getImportExtension(fileExtension, tsconfig);
      const relative = upath.relativeSafe(
        nodePath.dirname(importerPath),
        stripExtension(targetPath, fileExtension),
      );
      return `${relative}${extension}`;
    },
    clientImportPath(name, relativeSchemasPath) {
      if (indexFiles) return relativeSchemasPath;
      const key = findKey(name);
      const importPath = key ? importPathByName.get(key) : undefined;
      if (!importPath) return upath.joinSafe(relativeSchemasPath, name);
      const extension = getImportExtension(fileExtension, tsconfig);
      return `${upath.joinSafe(relativeSchemasPath, importPath.slice(2))}${extension}`;
    },
    packageImportPath(name) {
      if (!importPath || indexFiles) return importPath;
      const key = findKey(name);
      const routeImportPath = key ? importPathByName.get(key) : undefined;
      return routeImportPath
        ? upath.joinSafe(importPath, routeImportPath.slice(2))
        : undefined;
    },
    hasSchema(name) {
      return filePathByName.has(findKey(name));
    },
  };
}

/**
 * The plan for an output, or `undefined` when `schemas.routes` is not set.
 *
 * @remarks
 * Built once during API building and carried on `WriteSpecBuilder`, because
 * client extra files (Angular's `*.resource.ts`) are rendered before any mode
 * writer runs. Both sides therefore read one plan instead of deriving the
 * layout twice — a rule derived twice is a rule that can drift.
 *
 * The file extension follows the same split the schema writers use: Zod
 * schemas are named from `schemaFileExtension`, everything else from
 * `fileExtension`.
 */
export function createSchemaOutputPlanForOutput(
  schemas: GeneratorSchema[],
  output: NormalizedOutputOptions,
  schemaTagMap?: ReadonlyMap<string, string>,
): SchemaOutputPlan | undefined {
  const schemaOptions = output.schemas;
  if (!schemaOptions || isString(schemaOptions) || !schemaOptions.routes) {
    return undefined;
  }

  // Mirrors `writeSpecs`: a string `schemas:` is promoted to the Zod writer
  // when the client is zod and reusable schemas are on, but never when the
  // user asked for `{ type: 'typescript' }`. A routed plan always has an
  // object `schemas`, so only the explicit type matters here.
  const isZodSchemas = schemaOptions.type === 'zod';

  return createSchemaOutputPlan({
    basePath: schemaOptions.path,
    schemas: schemas.map((schema) => ({
      ...schema,
      kind:
        schema.kind ?? (isOpenApiEnumSchema(schema.schema) ? 'enum' : 'schema'),
    })),
    routes: schemaOptions.routes,
    namingConvention: output.namingConvention,
    fileExtension: isZodSchemas
      ? output.schemaFileExtension
      : output.fileExtension || '.ts',
    indexFiles: output.indexFiles,
    importPath: schemaOptions.importPath,
    tsconfig: output.tsconfig,
    schemaTagMap,
  });
}
