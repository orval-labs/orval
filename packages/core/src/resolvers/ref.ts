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
type Examples = Example[] | Record<string, Example> | undefined;

type WithOptionalExamples = {
  examples?: Examples;
};

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- TSchema constrains return type for callers (e.g. resolveRef<OpenApiExampleObject>) */

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
    throw new Error('Oops... 🍻. Ref not found: missing $ref');
  }

  const {
    currentSchema,
    refInfo: { name, originalName },
  } = getSchema(schema, context);

  if (!currentSchema) {
    throw new Error(`Oops... 🍻. Ref not found: ${refPath}`);
  }

  return resolveRef<TSchema>(currentSchema, { ...context }, [
    ...imports,
    { name, schemaName: originalName },
  ]);
}

function getSchema<TSchema extends object = OpenApiComponentsObject>(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
): {
  refInfo: RefInfo;
  currentSchema: TSchema | undefined;
} {
  if (!schema.$ref) {
    throw new Error('Oops... 🍻. Ref not found: missing $ref');
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

export function resolveExampleRefs(
  examples: Examples,
  context: ContextSpec,
): Examples {
  if (!examples) {
    return undefined;
  }
  return Array.isArray(examples)
    ? examples.map((example) => {
        if (isReference(example)) {
          const { schema } = resolveRef<OpenApiExampleObject>(example, context);
          // Bridge assertion: ExampleObject.value is typed as `any`
          return schema.value as Example;
        }
        return example;
      })
    : (() => {
        const result: Record<string, Example> = {};
        for (const [key, example] of Object.entries(examples)) {
          // Bridge assertion: ExampleObject.value is typed as `any`
          result[key] = isReference(example)
            ? (resolveRef<OpenApiExampleObject>(example, context).schema
                .value as unknown as Example)
            : example;
        }
        return result;
      })();
}
