import { isDereferenced } from '@scalar/openapi-types/helpers';
import { prop } from 'remeda';

import { getRefInfo, type RefInfo } from '../getters/ref';
import type {
  ContextSpec,
  GeneratorImport,
  OpenApiComponentsObject,
  OpenApiExampleObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { isObject, isReference } from '../utils';

type Example = OpenApiExampleObject | OpenApiReferenceObject;
type ResolvedExample = unknown;
type Examples =
  | Example[]
  | Record<string, Example>
  | ResolvedExample[]
  | Record<string, ResolvedExample>
  | undefined;

type WithOptionalExamples = {
  examples?: Examples;
};

const REF_NOT_FOUND_PREFIX = 'Oops... 🍻. Ref not found';

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- TSchema constrains return type for callers (e.g. resolveRef<OpenApiExampleObject>) */

/**
 * Recursively resolves a `$ref` in an OpenAPI document, following
 * nested schema refs and collecting imports along the way.
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

  let schemaByRefPaths = Array.isArray(refPaths)
    ? (prop(
        context.spec,
        // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
        ...refPaths,
      ) as OpenApiSchemaObject | OpenApiReferenceObject)
    : undefined;

  schemaByRefPaths ??= context.spec;

  if (isReference(schemaByRefPaths)) {
    return getSchema(schemaByRefPaths, context);
  }

  let currentSchema: OpenApiSchemaObject | OpenApiReferenceObject =
    schemaByRefPaths || context.spec;

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
    currentSchema: currentSchema as TSchema,
    refInfo,
  };
}

/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

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
          const { schema } = resolveRef<OpenApiExampleObject>(example, context);
          // Bridge assertion: ExampleObject.value is typed as `any`
          return schema.value as ResolvedExample;
        }
        return example as ResolvedExample;
      })
    : (() => {
        const result: Record<string, ResolvedExample> = {};
        for (const [key, example] of Object.entries(examples)) {
          // Bridge assertion: ExampleObject.value is typed as `any`
          result[key] =
            isObject(example) && isReference(example)
              ? (resolveRef<OpenApiExampleObject>(example, context).schema
                  .value as ResolvedExample)
              : (example as ResolvedExample);
        }
        return result;
      })();
}
