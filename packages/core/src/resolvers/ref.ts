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
import { isReference } from '../utils';

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- TSchema constrains return type for callers (e.g. resolveRef<OpenApiExampleObject>) */

export function resolveRef<
  TSchema extends OpenApiComponentsObject = OpenApiComponentsObject,
>(
  schema: OpenApiComponentsObject,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): {
  schema: TSchema;
  imports: GeneratorImport[];
} {
  // the schema is referring to another object
  if ('schema' in schema && schema.schema?.$ref) {
    const resolvedRef = resolveRef<TSchema>(schema.schema, context, imports);
    if ('examples' in schema) {
      schema.examples = resolveExampleRefs(schema.examples, context);
    }
    if ('examples' in resolvedRef.schema) {
      resolvedRef.schema.examples = resolveExampleRefs(
        resolvedRef.schema.examples,
        context,
      );
    }
    return {
      schema: {
        ...schema,
        schema: resolvedRef.schema,
      } as TSchema,
      imports,
    };
  }

  if (isDereferenced(schema)) {
    if ('examples' in schema) {
      schema.examples = resolveExampleRefs(schema.examples, context);
    }
    return { schema: schema as TSchema, imports };
  }

  const {
    currentSchema,
    refInfo: { name, originalName },
  } = getSchema(schema, context);

  if (!currentSchema) {
    throw new Error(`Oops... 🍻. Ref not found: ${schema.$ref}`);
  }

  return resolveRef<TSchema>(currentSchema, { ...context }, [
    ...imports,
    { name, schemaName: originalName },
  ]);
}

function getSchema<
  TSchema extends OpenApiComponentsObject = OpenApiComponentsObject,
>(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
): {
  refInfo: RefInfo;
  currentSchema: TSchema | undefined;
} {
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
  if ('nullable' in schema) {
    const nullable = schema.nullable as boolean | undefined;
    currentSchema = { ...currentSchema, nullable } as typeof currentSchema;
  }

  // Handle OpenAPI 3.1 type array (e.g., type: ["object", "null"])
  // This preserves nullable information when using direct $ref with types array
  if ('type' in schema && Array.isArray(schema.type)) {
    const type = schema.type as string[];
    currentSchema = { ...currentSchema, type } as typeof currentSchema;
  }

  return {
    currentSchema,
    refInfo,
  };
}

/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

type Example = OpenApiExampleObject | OpenApiReferenceObject;
type Examples = Example[] | Record<string, Example> | undefined;
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
        const result: Record<string, unknown> = {};
        for (const [key, example] of Object.entries(examples)) {
          // Bridge assertion: ExampleObject.value is typed as `any`
          result[key] = isReference(example)
            ? (resolveRef<OpenApiExampleObject>(example, context).schema
                .value as unknown)
            : example;
        }
        return result;
      })();
}
