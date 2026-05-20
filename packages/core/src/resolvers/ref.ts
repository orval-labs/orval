import { isDereferenced } from '@scalar/openapi-types/helpers';
import { prop } from 'remeda';

import { getRefInfo, isComponentRef, type RefInfo } from '../getters/ref';
import type {
  ContextSpec,
  DynamicScopeEntry,
  GeneratorImport,
  OpenApiComponentsObject,
  OpenApiExampleObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { isObject, isReference, sanitize } from '../utils';

/** Convert a `$dynamicAnchor` name to a valid TypeScript generic parameter identifier. */
export function dynamicAnchorToParamName(anchor: string): string {
  return sanitize(anchor, {
    underscore: '_',
    whitespace: '_',
    dash: '_',
    es5keyword: true,
    es5IdentifierName: true,
  });
}

type Example = OpenApiExampleObject | OpenApiReferenceObject;
type ResolvedExample = unknown;
type Examples =
  | Example[]
  | Record<string, Example>
  | ResolvedExample[]
  | Record<string, ResolvedExample>
  | undefined;

interface WithOptionalExamples {
  examples?: Examples;
}

const REF_NOT_FOUND_PREFIX = 'Oops... 🍻. Ref not found';

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- TSchema constrains return type for callers (e.g. resolveRef<OpenApiExampleObject>) */

/**
 * Recursively resolves a `$ref` in an OpenAPI document, following
 * nested schema refs and collecting imports along the way.
 *
 * Always returns a **fully dereferenced** schema — never a reference
 * object. Callers can rely on the returned `schema` being the concrete
 * target, not an intermediate `$ref`.
 *
 * Handles OpenAPI 3.0 `nullable` and 3.1 type-array hints on direct refs.
 *
 * @see https://spec.openapis.org/oas/v3.0.3#reference-object
 * @see https://spec.openapis.org/oas/v3.1.0#reference-object
 */
export function resolveRef<TSchema extends object = OpenApiComponentsObject>(
  schema: OpenApiComponentsObject | OpenApiReferenceObject,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): {
  schema: TSchema;
  imports: GeneratorImport[];
} {
  const refPath = '$ref' in schema ? schema.$ref : undefined;
  const nestedSchema =
    'schema' in schema ? (schema as { schema?: unknown }).schema : undefined;

  // the schema is referring to another object
  if (
    isObject(nestedSchema) &&
    isReference(nestedSchema) &&
    typeof nestedSchema.$ref === 'string'
  ) {
    const resolvedRef = resolveRef<TSchema>(nestedSchema, context, imports);

    if ('examples' in schema) {
      const schemaWithExamples = schema as WithOptionalExamples;
      schemaWithExamples.examples = resolveExampleRefs(
        schemaWithExamples.examples,
        context,
      );
    }

    if ('examples' in resolvedRef.schema) {
      const resolvedWithExamples = resolvedRef.schema as WithOptionalExamples;
      resolvedWithExamples.examples = resolveExampleRefs(
        resolvedWithExamples.examples,
        context,
      );
    }

    return {
      schema: {
        ...schema,
        schema: resolvedRef.schema,
      } as TSchema,
      imports: resolvedRef.imports,
    };
  }

  if (isDereferenced(schema)) {
    if ('examples' in schema) {
      const schemaWithExamples = schema as WithOptionalExamples;
      schemaWithExamples.examples = resolveExampleRefs(
        schemaWithExamples.examples,
        context,
      );
    }
    return { schema: schema as TSchema, imports };
  }

  if (!refPath) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: missing $ref`);
  }

  const {
    currentSchema,
    refInfo: { name, originalName },
  } = getSchema(schema, context);

  if (!currentSchema) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: ${refPath}`);
  }

  return resolveRef<TSchema>(currentSchema, { ...context }, [
    ...imports,
    { name, schemaName: originalName },
  ]);
}

/**
 * Looks up a schema by its `$ref` path in the spec, applying suffix resolution.
 *
 * Preserves OpenAPI 3.0 `nullable` and 3.1 type-array (`["object", "null"]`)
 * hints from the referencing schema onto the resolved target.
 *
 * @see https://spec.openapis.org/oas/v3.0.3#fixed-fields-18 (nullable)
 * @see https://spec.openapis.org/oas/v3.1.0#schema-object (type as array)
 */
export interface BoundAliasInfo {
  genericName: string;
  typeArgs: string[];
  imports: { name: string; schemaName: string }[];
  extraSchemas?: OpenApiSchemaObject[];
}

/** Check whether a schema reference has at least one `$defs` entry with both `$dynamicAnchor` and `$ref`. */
function isBoundAlias(schema: OpenApiReferenceObject): boolean {
  const defs = schema.$defs as Record<string, unknown> | undefined;
  if (!defs || typeof defs !== 'object') return false;
  for (const defSchema of Object.values(defs)) {
    const rec = defSchema as Record<string, unknown>;
    if (
      typeof rec.$dynamicAnchor === 'string' &&
      typeof rec.$ref === 'string'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extract bound-alias information from a schema that references a generic template
 * and binds `$dynamicAnchor` entries to concrete types via `$defs`.
 */
export function extractBoundAliasInfo(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): BoundAliasInfo | undefined {
  let bindingElement: OpenApiReferenceObject | undefined;
  let extraSchemas: OpenApiSchemaObject[] | undefined;

  if (isReference(schema) && isBoundAlias(schema)) {
    bindingElement = schema;
  } else {
    const allOf = (schema as { allOf?: unknown[] }).allOf;
    if (Array.isArray(allOf)) {
      for (let i = 0; i < allOf.length; i++) {
        const element = allOf[i] as
          | OpenApiSchemaObject
          | OpenApiReferenceObject;
        if (isReference(element) && isBoundAlias(element)) {
          bindingElement = element;
          extraSchemas = allOf.filter(
            (_: unknown, j: number) => j !== i,
          ) as OpenApiSchemaObject[];
          break;
        }
      }
    }
  }

  if (!bindingElement) return undefined;

  const bindingRecord = bindingElement as Record<string, unknown>;
  const defs = bindingRecord.$defs as Record<string, unknown> | undefined;
  if (!defs || typeof defs !== 'object') return undefined;

  const bindingByAnchor = new Map<
    string,
    { typeName: string; originalName: string }
  >();

  for (const defSchema of Object.values(defs)) {
    const rec = defSchema as Record<string, unknown>;
    if (typeof defSchema !== 'object' || rec.$dynamicAnchor === undefined)
      continue;

    const ref = rec.$ref as string | undefined;
    if (!ref || !isComponentRef(ref)) continue;

    const anchor = rec.$dynamicAnchor as string;
    const { name, originalName } = getRefInfo(ref, context);
    bindingByAnchor.set(anchor, { typeName: name, originalName });
  }

  if (bindingByAnchor.size === 0) return undefined;

  const refPath = bindingElement.$ref;
  if (typeof refPath !== 'string') return undefined;

  const { name: genericName, refPaths: templateRefPaths } = getRefInfo(
    refPath,
    context,
  );

  const templateSchema = templateRefPaths
    ? (prop(
        context.spec,
        // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
        ...templateRefPaths,
      ) as Record<string, unknown> | undefined)
    : undefined;

  const templateDefs = templateSchema?.$defs as
    | Record<string, unknown>
    | undefined;

  const typeArgs: string[] = [];
  const imports: { name: string; schemaName: string }[] = [];

  if (templateDefs && typeof templateDefs === 'object') {
    for (const defSchema of Object.values(templateDefs)) {
      const rec = defSchema as Record<string, unknown>;
      if (
        typeof defSchema !== 'object' ||
        rec.$dynamicAnchor === undefined ||
        rec.$ref !== undefined
      )
        continue;
      const anchor = rec.$dynamicAnchor as string;
      const binding = bindingByAnchor.get(anchor);
      if (!binding) continue;
      typeArgs.push(binding.typeName);
      imports.push({
        name: binding.typeName,
        schemaName: binding.originalName,
      });
    }
  }

  if (typeArgs.length === 0) {
    for (const { typeName, originalName } of bindingByAnchor.values()) {
      typeArgs.push(typeName);
      imports.push({ name: typeName, schemaName: originalName });
    }
  }

  return { genericName, typeArgs, imports, extraSchemas };
}

/** Resolve a `$ref` pointer to its schema definition and ref metadata from the spec. */
function getSchema<TSchema extends object = OpenApiComponentsObject>(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
): {
  refInfo: RefInfo;
  currentSchema: TSchema | undefined;
} {
  if (!schema.$ref) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: missing $ref`);
  }

  const refInfo = getRefInfo(schema.$ref, context);

  const { refPaths } = refInfo;

  const schemaByRefPaths:
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined = Array.isArray(refPaths)
    ? (prop(
        context.spec,
        // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
        ...refPaths,
      ) as OpenApiSchemaObject | OpenApiReferenceObject | undefined)
    : undefined;

  if (isObject(schemaByRefPaths) && isReference(schemaByRefPaths)) {
    return getSchema(schemaByRefPaths, context);
  }

  let currentSchema: OpenApiSchemaObject | OpenApiReferenceObject | undefined =
    schemaByRefPaths;

  // Handle OpenAPI 3.0 nullable property
  // Bridge assertion: schema properties are `any` due to AnyOtherAttribute
  if (isObject(currentSchema) && 'nullable' in schema) {
    const nullable = schema.nullable as boolean | undefined;
    const currentSchemaObject = currentSchema as Record<string, unknown>;
    currentSchema = {
      ...currentSchemaObject,
      nullable,
    } as OpenApiSchemaObject | OpenApiReferenceObject;
  }

  // Handle OpenAPI 3.1 type array (e.g., type: ["object", "null"])
  // This preserves nullable information when using direct $ref with types array
  if (
    isObject(currentSchema) &&
    'type' in schema &&
    Array.isArray(schema.type)
  ) {
    const type = schema.type as string[];
    const currentSchemaObject = currentSchema as Record<string, unknown>;
    currentSchema = {
      ...currentSchemaObject,
      type,
    } as OpenApiSchemaObject | OpenApiReferenceObject;
  }

  return {
    currentSchema: currentSchema as TSchema | undefined,
    refInfo,
  };
}

/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

function encodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Build the dynamic scope for a schema: maps `$dynamicAnchor` names to concrete
 * type entries for self-referential resolution, `$defs` bindings, and sibling anchors.
 */
export function buildDynamicScope(
  schemaName: string,
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): Record<string, DynamicScopeEntry> {
  const scope: Record<string, DynamicScopeEntry> = {};

  const getSchemaScopeEntry = (name: string): DynamicScopeEntry => {
    const refInfo = getRefInfo(
      `#/components/schemas/${encodeJsonPointerSegment(name)}`,
      context,
    );

    return {
      name: refInfo.name,
      schemaName: refInfo.originalName,
    };
  };

  const schemaRecord = schema as Record<string, unknown>;

  if (typeof schemaRecord.$dynamicAnchor === 'string') {
    scope[schemaRecord.$dynamicAnchor] = getSchemaScopeEntry(schemaName);
  }

  const defs = schemaRecord.$defs as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;
  if (defs && typeof defs === 'object') {
    for (const [, defSchema] of Object.entries(defs)) {
      const defRecord = defSchema as Record<string, unknown>;
      if (
        typeof defSchema === 'object' &&
        typeof defRecord.$dynamicAnchor === 'string'
      ) {
        const anchorName = defRecord.$dynamicAnchor;
        const refInDef = (defSchema as OpenApiReferenceObject).$ref;
        if (refInDef && isComponentRef(refInDef)) {
          const { name, originalName } = getRefInfo(refInDef, context);
          scope[anchorName] = { name, schemaName: originalName };
        } else if (!refInDef) {
          const paramName = dynamicAnchorToParamName(anchorName);
          scope[anchorName] = {
            name: paramName,
            schemaName: paramName,
            isParameter: true,
          };
        }
      }
    }
  }

  return scope;
}

/**
 * Resolve a `$dynamicRef` anchor to its concrete type using the current dynamic scope.
 * Falls back to the static `$dynamicAnchor` provider when no scope override exists.
 */
export function resolveDynamicRef(
  anchorName: string,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): {
  schema: OpenApiSchemaObject;
  imports: GeneratorImport[];
  resolvedTypeName: string;
} {
  const scope = context.dynamicScope ?? {};
  const scopeEntry = scope[anchorName];

  if (!scopeEntry) {
    return {
      schema: {},
      imports,
      resolvedTypeName: 'unknown',
    };
  }

  if (scopeEntry.isParameter) {
    return {
      schema: {},
      imports,
      resolvedTypeName: scopeEntry.name,
    };
  }

  const resolvedTypeName = scopeEntry.name;
  const schemaRef = `#/components/schemas/${encodeJsonPointerSegment(scopeEntry.schemaName)}`;

  try {
    const { schema: resolvedSchema, imports: resolvedImports } =
      resolveRef<OpenApiSchemaObject>({ $ref: schemaRef }, context, imports);
    return {
      schema: resolvedSchema,
      imports: resolvedImports,
      resolvedTypeName,
    };
  } catch {
    return {
      schema: {},
      imports,
      resolvedTypeName: 'unknown',
    };
  }
}

/** Recursively resolves `$ref` entries in an examples array or record. */
export function resolveExampleRefs(
  examples: Examples,
  context: ContextSpec,
): ResolvedExample[] | Record<string, ResolvedExample> | undefined {
  if (!examples) {
    return undefined;
  }
  return Array.isArray(examples)
    ? examples.map((example) => {
        if (isObject(example) && isReference(example)) {
          const { schema }: { schema: OpenApiExampleObject } = resolveRef(
            example,
            context,
          );
          // Bridge assertion: ExampleObject.value is typed as `any`
          return schema.value as ResolvedExample;
        }
        return example;
      })
    : (() => {
        const result: Record<string, ResolvedExample> = {};
        for (const [key, example] of Object.entries(examples)) {
          // Bridge assertion: ExampleObject.value is typed as `any`
          result[key] =
            isObject(example) && isReference(example)
              ? ((
                  resolveRef(example, context) as {
                    schema: OpenApiExampleObject;
                  }
                ).schema.value as ResolvedExample)
              : example;
        }
        return result;
      })();
}
