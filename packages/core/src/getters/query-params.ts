import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GeneratorImport,
  GeneratorSchema,
  GetterParameters,
  GetterQueryParam,
  OpenApiParameterObject,
  OpenApiSchemaObject,
} from '../types';
import { jsDoc, pascal, sanitize } from '../utils';
import { getEnum, getEnumDescriptions, getEnumNames } from './enum';
import { getKey } from './keys';

interface QueryParamsType {
  name: string;
  required: boolean;
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: OpenApiSchemaObject;
}

const isOpenApiSchemaObject = (
  value: unknown,
): value is OpenApiSchemaObject => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return !('$ref' in value);
};

const getSchemaType = (
  schema: OpenApiSchemaObject,
): string | string[] | undefined => {
  const type = (schema as { type?: unknown }).type;

  if (typeof type === 'string') {
    return type;
  }

  if (
    Array.isArray(type) &&
    type.every((variant): variant is string => typeof variant === 'string')
  ) {
    return type;
  }

  return undefined;
};
/**
 * Detects whether a query parameter's resolved schema is non-primitive — i.e.
 * an object, an array of objects, or a composition (oneOf/anyOf/allOf) that
 * resolves to a non-primitive shape.
 *
 * Used by Angular generators so the default `filterParams` helper preserves
 * such values instead of silently dropping them. Angular's `HttpParams` only
 * accepts primitives, but a user-provided `paramsSerializer`, `mutator`, or
 * `paramsFilter` may need the raw object to flatten or stringify it.
 */
const isSchemaNonPrimitive = (schema: OpenApiSchemaObject): boolean => {
  const schemaType = getSchemaType(schema);
  const type = Array.isArray(schemaType)
    ? schemaType.filter((variant) => variant !== 'null')
    : schemaType;
  const additionalProperties = (schema as { additionalProperties?: unknown })
    .additionalProperties;

  if (type === 'object') {
    return true;
  }
  if (type === 'array' || (Array.isArray(type) && type.includes('array'))) {
    const items = (schema as { items?: unknown }).items;
    if (isOpenApiSchemaObject(items)) {
      return isSchemaNonPrimitive(items);
    }
    return false;
  }
  if (Array.isArray(type) && type.includes('object')) {
    return true;
  }

  const compositions = [
    ...(Array.isArray(schema.oneOf) ? (schema.oneOf as unknown[]) : []),
    ...(Array.isArray(schema.anyOf) ? (schema.anyOf as unknown[]) : []),
    ...(Array.isArray(schema.allOf) ? (schema.allOf as unknown[]) : []),
  ];
  if (compositions.length > 0) {
    return compositions.some(
      (variant) =>
        isOpenApiSchemaObject(variant) && isSchemaNonPrimitive(variant),
    );
  }

  if (
    !type &&
    ((schema as { properties?: unknown }).properties !== undefined ||
      (additionalProperties !== undefined && additionalProperties !== false))
  ) {
    return true;
  }
  return false;
};

const isSchemaNullable = (schema: OpenApiSchemaObject): boolean => {
  if (schema.nullable === true) {
    return true;
  }

  if (schema.type === 'null') {
    return true;
  }

  if (Array.isArray(schema.type) && schema.type.includes('null')) {
    return true;
  }

  const oneOfVariants = Array.isArray(schema.oneOf)
    ? (schema.oneOf as unknown[])
    : [];
  const anyOfVariants = Array.isArray(schema.anyOf)
    ? (schema.anyOf as unknown[])
    : [];
  const variants = [...oneOfVariants, ...anyOfVariants];

  return variants.some((variant) => {
    if (!isOpenApiSchemaObject(variant)) {
      return false;
    }

    return isSchemaNullable(variant);
  });
};

function getQueryParamsTypes(
  queryParams: GetterParameters['query'],
  operationName: string,
  context: ContextSpec,
): QueryParamsType[] {
  return queryParams.map(({ parameter, imports: parameterImports }) => {
    const {
      name,
      required,
      schema: schemaParam,
      content,
    } = parameter as {
      name: string;
      required: boolean;
      schema: OpenApiSchemaObject | undefined;
      content: OpenApiParameterObject['content'];
    };

    const queryName = sanitize(`${pascal(operationName)}${pascal(name)}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });

    const schema = schemaParam ?? content?.['application/json']?.schema;
    if (!schema) {
      throw new Error(
        `Query parameter "${name}" has no schema or content definition`,
      );
    }

    const resolvedValue = resolveValue({
      schema,
      context,
      name: queryName,
    });

    const key = getKey(name);
    // Bridge assertion: cast schema to jsDoc's expected parameter shape
    // to avoid AnyOtherAttribute spreading error type
    const schemaForDoc = schema as {
      description?: string | string[];
      deprecated?: boolean;
      summary?: string;
      minLength?: number;
      maxLength?: number;
      minimum?: number;
      maximum?: number;
      exclusiveMinimum?: number;
      exclusiveMaximum?: number;
      minItems?: number;
      maxItems?: number;
      type?: string | string[];
      pattern?: string;
    };
    const doc = jsDoc(
      {
        description: parameter.description,
        ...schemaForDoc,
      },
      void 0,
      context,
    );

    if (parameterImports.length > 0) {
      return {
        name,
        required,
        definition: `${doc}${key}${!required || schema.default ? '?' : ''}: ${
          parameterImports[0].name
        };`,
        imports: parameterImports,
        schemas: [],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    if (resolvedValue.isEnum && !resolvedValue.isRef) {
      const enumName = queryName;
      const enumValue = getEnum(
        resolvedValue.value,
        enumName,
        getEnumNames(resolvedValue.originalSchema),
        context.output.override.enumGenerationType,
        getEnumDescriptions(resolvedValue.originalSchema),
        context.output.override.namingConvention.enum,
      );

      return {
        name,
        required,
        definition: `${doc}${key}${
          !required || schema.default ? '?' : ''
        }: ${enumName};`,
        imports: [{ name: enumName }],
        schemas: [
          ...resolvedValue.schemas,
          { name: enumName, model: enumValue, imports: resolvedValue.imports },
        ],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    const definition = `${doc}${key}${
      !required || schema.default ? '?' : ''
    }: ${resolvedValue.value};`;

    return {
      name,
      required,
      definition,
      imports: resolvedValue.imports,
      schemas: resolvedValue.schemas,
      originalSchema: resolvedValue.originalSchema,
    };
  });
}

interface GetQueryParamsOptions {
  queryParams: GetterParameters['query'];
  operationName: string;
  context: ContextSpec;
  suffix?: string;
}

export function getQueryParams({
  queryParams,
  operationName,
  context,
  suffix = 'params',
}: GetQueryParamsOptions): GetterQueryParam | undefined {
  if (queryParams.length === 0) {
    return;
  }
  const types = getQueryParamsTypes(queryParams, operationName, context);
  const imports = types.flatMap(({ imports }) => imports);
  const schemas = types.flatMap(({ schemas }) => schemas);
  const name = `${pascal(operationName)}${pascal(suffix)}`;

  const type = types.map(({ definition }) => definition).join('\n');
  const allOptional = queryParams.every(({ parameter }) => !parameter.required);
  const requiredNullableKeys = types
    .filter(
      ({ required, originalSchema }) =>
        required && isSchemaNullable(originalSchema),
    )
    .map(({ name }) => name);
  const nonPrimitiveKeys = types
    .filter(({ originalSchema }) => isSchemaNonPrimitive(originalSchema))
    .map(({ name }) => name);

  const schema = {
    name,
    model: `export type ${name} = {\n${type}\n};\n`,
    imports,
  };

  const nonPrimitiveKeys = types
    .filter(({ originalSchema }) => isSchemaNonPrimitive(originalSchema))
    .map(({ name }) => name);

  return {
    schema,
    deps: schemas,
    isOptional: allOptional,
    requiredNullableKeys,
    ...(nonPrimitiveKeys.length > 0 ? { nonPrimitiveKeys } : {}),
  };
}
