import nodePath from 'node:path';

import type {
  GeneratedSchemaKind,
  GeneratorSchema,
  NormalizedSchemaOptions,
  NamingConvention,
  Tsconfig,
} from '../types';
import { conventionName, getImportExtension, upath } from '../utils';

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
  registerSchema(
    name: string,
    route: SchemaRouteKey,
    scopePath?: string,
  ): string;
  canonicalNameFor(name: string): string;
  importPathFor(importerName: string, targetName: string): string;
  clientImportPath(name: string, relativeSchemasPath: string): string;
  packageImportPath(name: string): string | undefined;
  hasSchema(name: string): boolean;
}

function schemaNameKey(name: string, namingConvention: NamingConvention) {
  return conventionName(name, namingConvention).toLowerCase();
}

function canonicalName(name: string, namingConvention: NamingConvention) {
  return conventionName(name, namingConvention);
}

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

function requireSchemaKind(schema: GeneratorSchema): GeneratedSchemaKind {
  if (!schema.kind) {
    throw new Error(
      `Generated schema "${schema.name}" is missing its kind metadata.`,
    );
  }
  return schema.kind;
}

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

function stripExtension(fileName: string, fileExtension: string) {
  return fileName.endsWith(fileExtension)
    ? fileName.slice(0, -fileExtension.length)
    : fileName;
}

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
