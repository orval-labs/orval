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

  const canonicalSchemas = [...grouped.values()].map((group) =>
    group.length === 1
      ? { ...group[0], kind: requireSchemaKind(group[0]) }
      : mergeSchemas(group),
  );
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
