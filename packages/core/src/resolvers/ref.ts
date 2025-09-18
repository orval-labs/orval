import type {
  ExampleObject,
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts/oas30';

import { getRefInfo, type RefInfo } from '../getters/ref';
import type { ContextSpecs, GeneratorImport } from '../types';
import { isReference } from '../utils';

type ComponentObject =
  | SchemaObject
  | ResponseObject
  | ParameterObject
  | RequestBodyObject
  | ReferenceObject;
export const resolveRef = <Schema extends ComponentObject = ComponentObject>(
  schema: ComponentObject,
  context: ContextSpecs,
  imports: GeneratorImport[] = [],
): {
  schema: Schema;
  imports: GeneratorImport[];
} => {
  // the schema is referring to another object
  if ((schema as any)?.schema?.$ref) {
    const resolvedRef = resolveRef<Schema>(
      (schema as any)?.schema,
      context,
      imports,
    );
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
      } as Schema,
      imports,
    };
  }

  if (!isReference(schema)) {
    if ('examples' in schema) {
      schema.examples = resolveExampleRefs(schema.examples, context);
    }
    return { schema: schema as Schema, imports };
  }

  const {
    currentSchema,
    refInfo: { specKey, name, originalName },
  } = getSchema(schema, context);

  if (!currentSchema) {
    throw new Error(`Oops... 🍻. Ref not found: ${schema.$ref}`);
  }

  return resolveRef<Schema>(
    currentSchema,
    { ...context, specKey: specKey || context.specKey },
    [...imports, { name, specKey, schemaName: originalName }],
  );
};

function getSchema<Schema extends ComponentObject = ComponentObject>(
  schema: ReferenceObject,
  context: ContextSpecs,
): {
  refInfo: RefInfo;
  currentSchema: Schema | undefined;
} {
  const refInfo = getRefInfo(schema.$ref, context);

  const { specKey, refPaths } = refInfo;

  let schemaByRefPaths: Schema | undefined =
    refPaths && Array.isArray(refPaths)
      ? refPaths.reduce(
          (obj: any, key: string) => (obj && key in obj ? obj[key] : undefined),
          context.specs[specKey || context.specKey],
        )
      : undefined;

  if (!schemaByRefPaths) {
    schemaByRefPaths = context.specs?.[
      specKey || context.specKey
    ] as unknown as Schema;
  }

  if (isReference(schemaByRefPaths)) {
    return getSchema(schemaByRefPaths, context);
  }
  const currentSchema = schemaByRefPaths
    ? schemaByRefPaths
    : (context.specs[specKey || context.specKey] as unknown as Schema);
  return {
    currentSchema,
    refInfo,
  };
}

type Example = ExampleObject | ReferenceObject;
type Examples = Example[] | Record<string, Example> | undefined;
export const resolveExampleRefs = (
  examples: Examples,
  context: ContextSpecs,
): Examples => {
  if (!examples) {
    return undefined;
  }
  return Array.isArray(examples)
    ? examples.map((example) => {
        if (isReference(example)) {
          const { schema } = resolveRef<ExampleObject>(example, context);
          return schema.value;
        }
        return example;
      })
    : Object.entries(examples).reduce((acc, [key, example]) => {
        let schema = example;
        if (isReference(example)) {
          schema = resolveRef<ExampleObject>(example, context).schema.value;
        }
        return {
          ...acc,
          [key]: schema,
        };
      }, {});
};
