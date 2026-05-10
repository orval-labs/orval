import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GeneratorImport,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { PropertySortOrder } from '../types';
import {
  conventionName,
  getFileInfo,
  isString,
  logWarning,
  pascal,
  upath,
} from '../utils';

const circularRefCache = new WeakMap<ContextSpec, Map<string, boolean>>();

function getSchemasPath(context: ContextSpec): string {
  const { schemas, target } = context.output;
  if (schemas) {
    const schemasPath = isString(schemas) ? schemas : schemas.path;
    return upath.normalizeSafe(schemasPath);
  }
  const { dirname, filename } = getFileInfo(target);
  return upath.joinSafe(dirname, filename + '.schemas');
}

function getSchemaImportPath(
  refName: string,
  context: ContextSpec,
): string | undefined {
  if (context.output.factoryMethods.mode === 'inline-with-schema') {
    return undefined;
  }
  let outputDir = context.output.factoryMethods.outputDirectory;
  let schemasPath = getSchemasPath(context);

  if (context.output.workspace) {
    if (outputDir && !upath.isAbsolute(outputDir)) {
      outputDir = upath.resolve(context.output.workspace, outputDir);
    }
    if (schemasPath && !upath.isAbsolute(schemasPath)) {
      schemasPath = upath.resolve(context.output.workspace, schemasPath);
    }
  }

  const relativePath = outputDir
    ? upath.relativeSafe(outputDir, schemasPath)
    : './';
  const baseName = conventionName(refName, context.output.namingConvention);
  return upath.joinSafe(relativePath, baseName);
}

type SchemaArray = (OpenApiSchemaObject | OpenApiReferenceObject)[];

interface ResolvedRef {
  imports: GeneratorImport[];
  schema: OpenApiSchemaObject;
}

function isReference(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
): schema is OpenApiReferenceObject {
  return '$ref' in schema;
}

function getResolvedRef(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
): ResolvedRef {
  return resolveRef(schema, context) as ResolvedRef;
}

function getProperties(
  schema: OpenApiSchemaObject,
): Record<string, OpenApiSchemaObject | OpenApiReferenceObject> {
  return (
    (schema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined) ?? {}
  );
}

function getItems(
  schema: OpenApiSchemaObject,
): OpenApiSchemaObject | OpenApiReferenceObject | undefined {
  return schema.items as
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined;
}

function getAdditionalProperties(
  schema: OpenApiSchemaObject,
): OpenApiSchemaObject | OpenApiReferenceObject | boolean | undefined {
  return schema.additionalProperties as
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | boolean
    | undefined;
}

function getSchemas(schemas: unknown): SchemaArray | undefined {
  return schemas as SchemaArray | undefined;
}

function getExtendedProps(schema: OpenApiSchemaObject): {
  constValue: unknown;
  prefixItems: SchemaArray | undefined;
  minItems: number | undefined;
} {
  const extended = schema as OpenApiSchemaObject & {
    const?: unknown;
    prefixItems?: SchemaArray;
    minItems?: number;
  };
  return {
    constValue: extended.const,
    prefixItems: extended.prefixItems,
    minItems: extended.minItems,
  };
}

export function generateFactory(
  schema: OpenApiSchemaObject,
  name: string,
  context: ContextSpec,
): { model: string; imports: GeneratorImport[] } | undefined {
  if (!canGenerateSchema(schema)) return undefined;

  const { functionNamePrefix, mode } = context.output.factoryMethods;
  const factoryName = `${functionNamePrefix}${pascal(name)}`;
  const imports: GeneratorImport[] = [];
  const payload = buildPayload(schema, context, [name], imports);

  if (mode !== 'inline-with-schema') {
    const schemaImportPath = getSchemaImportPath(name, context);
    imports.push({ name, importPath: schemaImportPath });
  }

  return {
    model: `export function ${factoryName}(): ${name} {\n  return ${payload};\n}\n`,
    imports,
  };
}

function canGenerateSchema(schema: OpenApiSchemaObject): boolean {
  return (
    schema.type === 'object' ||
    schema.type === 'array' ||
    !!schema.properties ||
    !!schema.allOf ||
    !!schema.oneOf ||
    !!schema.anyOf ||
    !!schema.items ||
    !!schema.enum
  );
}

function hasCircularReference(
  target: OpenApiSchemaObject | OpenApiReferenceObject,
  sourceName: string,
  context: ContextSpec,
  visited = new Set<string>(),
): boolean {
  if (isReference(target)) {
    const { imports, schema } = getResolvedRef(target, context);
    const refName = imports[0]?.name;
    if (refName === sourceName) return true;
    if (refName && visited.has(refName)) return false;
    if (refName) visited.add(refName);

    let cache = circularRefCache.get(context);
    if (!cache) {
      cache = new Map<string, boolean>();
      circularRefCache.set(context, cache);
    }
    const cacheKey = refName ? `${sourceName}::${refName}` : undefined;
    if (cacheKey) {
      const cached = cache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    const result = hasCircularReference(schema, sourceName, context, visited);

    if (cacheKey) {
      cache.set(cacheKey, result);
    }
    return result;
  }

  const check = (schemas?: SchemaArray): boolean =>
    schemas?.some((s) =>
      hasCircularReference(s, sourceName, context, visited),
    ) ?? false;

  const items = getItems(target);
  const additionalProperties = getAdditionalProperties(target);

  return (
    check(getSchemas(target.allOf)) ||
    check(getSchemas(target.oneOf)) ||
    check(getSchemas(target.anyOf)) ||
    Object.values(getProperties(target)).some((s) =>
      hasCircularReference(s, sourceName, context, visited),
    ) ||
    (!!items && hasCircularReference(items, sourceName, context, visited)) ||
    (typeof additionalProperties === 'object' &&
      hasCircularReference(additionalProperties, sourceName, context, visited))
  );
}

function buildPayload(
  target: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  if (isReference(target)) {
    return buildRefPayload(target, context, parents, imports);
  }

  const schema = target;

  if (schema.allOf)
    return buildAllOfPayload(
      getSchemas(schema.allOf) ?? [],
      context,
      parents,
      imports,
    );
  if (schema.oneOf)
    return buildFirstOfPayload(
      getSchemas(schema.oneOf) ?? [],
      context,
      parents,
      imports,
    );
  if (schema.anyOf)
    return buildFirstOfPayload(
      getSchemas(schema.anyOf) ?? [],
      context,
      parents,
      imports,
    );

  const { constValue } = getExtendedProps(schema);
  if (constValue !== undefined) return formatValue(constValue);
  if (schema.default !== undefined) return buildDefaultPayload(schema, context);

  const schemaType = inferSchemaType(schema);

  if (schemaType === 'object' || schema.properties)
    return buildObjectPayload(schema, context, parents, imports);
  if (schemaType === 'array')
    return buildArrayPayload(schema, context, parents, imports);

  return buildPrimitivePayload(schema, schemaType, context);
}

function buildRefPayload(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  const { schema: resolved, imports: refImports } = getResolvedRef(
    schema,
    context,
  );
  const refName = refImports[0]?.name;

  if (!refName) return '{}';

  if (
    parents.includes(refName) ||
    hasCircularReference(resolved, parents[0], context)
  ) {
    imports.push({
      name: refName,
      importPath: getSchemaImportPath(refName, context),
    });
    return `{} as ${refName}`;
  }

  const { functionNamePrefix, mode } = context.output.factoryMethods;
  const refFactoryName = `${functionNamePrefix}${pascal(refName)}`;

  if (mode !== 'combined-separate-file') {
    const importPath = resolveImportPath(mode, refName, context);
    imports.push({ name: refFactoryName, importPath, isConstant: true });
  }

  imports.push({
    name: refName,
    importPath: getSchemaImportPath(refName, context),
  });

  return `${refFactoryName}()`;
}

function resolveImportPath(
  mode: string,
  refName: string,
  context: ContextSpec,
): string | undefined {
  const baseName = conventionName(refName, context.output.namingConvention);
  switch (mode) {
    case 'separate-file': {
      return `./${baseName}.factory`;
    }
    case 'combined-separate-file': {
      return `./${conventionName('factoryMethods', context.output.namingConvention)}`;
    }
    case 'inline-with-schema': {
      return `./${baseName}`;
    }
  }
}

function buildAllOfPayload(
  allOf: SchemaArray,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  const payloads = allOf.map((s) => buildPayload(s, context, parents, imports));
  return payloads.length > 0
    ? `Object.assign({}, ${payloads.join(', ')})`
    : '{}';
}

function buildFirstOfPayload(
  schemas: SchemaArray,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  const first = schemas[0];
  return first ? buildPayload(first, context, parents, imports) : '{}';
}

function buildObjectPayload(
  schema: OpenApiSchemaObject,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  const { optionalPropertyStrategy } = context.output.factoryMethods;
  const props = getProperties(schema);
  const requiredProps: string[] =
    (schema.required as string[] | undefined) ?? [];
  const entries = Object.entries(props);

  if (context.output.propertySortOrder === PropertySortOrder.ALPHABETICAL) {
    entries.sort(([a], [b]) => a.localeCompare(b));
  }

  const includeOptional = optionalPropertyStrategy === 'include';
  const lines: string[] = [];

  for (const [key, prop] of entries) {
    const isRequired = requiredProps.includes(key);
    const resolved = isReference(prop)
      ? getResolvedRef(prop, context).schema
      : prop;

    const isReadOnly =
      !!(prop as OpenApiSchemaObject).readOnly || !!resolved.readOnly;
    const isWriteOnly =
      !!(prop as OpenApiSchemaObject).writeOnly || !!resolved.writeOnly;

    if (!isRequired) {
      if (isReadOnly) continue;
      if (!isWriteOnly && !includeOptional) continue;
    }

    const payload = buildPayload(prop, context, parents, imports);
    const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
      ? key
      : JSON.stringify(key);
    lines.push(`${safeKey}: ${payload}`);
  }

  return `{\n    ${lines.join(',\n    ')}\n  }`;
}

function buildArrayPayload(
  schema: OpenApiSchemaObject,
  context: ContextSpec,
  parents: string[],
  imports: GeneratorImport[],
): string {
  const { prefixItems, minItems } = getExtendedProps(schema);
  const items = getItems(schema);

  if (prefixItems && prefixItems.length > 0) {
    const payloads = prefixItems.map((item) =>
      buildPayload(item, context, parents, imports),
    );
    return `[${payloads.join(', ')}]`;
  }

  if (minItems && items) {
    const MAX_MIN_ITEMS = 50;
    if (minItems > MAX_MIN_ITEMS) {
      logWarning(
        `Warning: minItems is ${minItems}, capping at ${MAX_MIN_ITEMS} to prevent massive payload.`,
      );
    }
    const count = Math.min(minItems, MAX_MIN_ITEMS);
    const itemPayload = buildPayload(items, context, parents, imports);
    return `[${Array.from<string>({ length: count })
      .fill(itemPayload)
      .join(', ')}]`;
  }

  return '[]';
}

function inferSchemaType(schema: OpenApiSchemaObject): string | undefined {
  let type = schema.type as string | string[] | undefined;

  if (Array.isArray(type)) {
    const nonNull = type.filter((t) => t !== 'null');
    type = nonNull.length > 0 ? nonNull[0] : 'null';
  }

  if (!type && schema.items) return 'array';

  if (!type && schema.enum) {
    const first = (schema.enum as unknown[])[0];
    if (typeof first === 'number') return 'number';
    if (typeof first === 'boolean') return 'boolean';
    return 'string';
  }

  return type;
}

function buildDefaultPayload(
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): string {
  if (
    context.output.override.useDates &&
    typeof schema.default === 'string' &&
    (schema.format === 'date' || schema.format === 'date-time')
  ) {
    return `new Date('${schema.default}')`;
  }
  return formatValue(schema.default);
}

function buildPrimitivePayload(
  schema: OpenApiSchemaObject,
  schemaType: string | undefined,
  context: ContextSpec,
): string {
  if (schemaType === 'null') return 'null';

  const enumValues = schema.enum as unknown[] | undefined;

  if (schemaType === 'boolean') {
    return enumValues && enumValues.length > 0
      ? String(enumValues[0])
      : 'false';
  }

  if (schemaType === 'number' || schemaType === 'integer') {
    return enumValues && enumValues.length > 0 ? String(enumValues[0]) : '0';
  }

  if (schemaType === 'string') {
    if (enumValues && enumValues.length > 0) {
      const first = enumValues[0];
      return typeof first === 'string' ? JSON.stringify(first) : String(first);
    }
    if (schema.format === 'date' || schema.format === 'date-time') {
      return context.output.override.useDates
        ? 'new Date(0)'
        : `'${new Date(0).toISOString()}'`;
    }
    return "''";
  }

  return 'undefined as unknown';
}

function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (typeof val === 'string') return JSON.stringify(val);
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val as number | boolean);
}
