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
  objectStrategy?: 'flatten' | 'comma' | 'deepObject';
}

const isOpenApiSchemaObject = (
  value: unknown,
): value is OpenApiSchemaObject => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return !('$ref' in value);
};

/**
 * A `$ref` schema object (e.g. array `items` or a oneOf/anyOf/allOf variant
 * pointing at a component). We don't resolve the reference here, but a query
 * parameter behind a `$ref` is virtually always a complex (object-like) type,
 * so it must be treated as non-primitive. Over-flagging is harmless: the only
 * consumer (the Angular `nonPrimitiveKeys` passthrough) is gated on a
 * configured `paramsSerializer`, which is precisely what handles raw values.
 */
const isRefObject = (value: unknown): boolean =>
  !!value && typeof value === 'object' && '$ref' in value;

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
  if (Array.isArray(type) && type.includes('object')) {
    return true;
  }
  if (type === 'array' || (Array.isArray(type) && type.includes('array'))) {
    const items = (schema as { items?: unknown }).items;
    if (isOpenApiSchemaObject(items)) {
      return isSchemaNonPrimitive(items);
    }
    // Arrays with missing/unknown `items` are still non-primitive for our
    // Angular passthrough purposes: without a serializer/filter, HttpParams
    // cannot safely represent them. `$ref` items also land here because
    // isOpenApiSchemaObject rejects references.
    return true;
  }

  const compositions = [
    ...(Array.isArray(schema.oneOf) ? (schema.oneOf as unknown[]) : []),
    ...(Array.isArray(schema.anyOf) ? (schema.anyOf as unknown[]) : []),
    ...(Array.isArray(schema.allOf) ? (schema.allOf as unknown[]) : []),
  ];
  if (compositions.length > 0) {
    return compositions.some((variant) =>
      isOpenApiSchemaObject(variant)
        ? isSchemaNonPrimitive(variant)
        : isRefObject(variant),
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

/**
 * Detects whether a query parameter's resolved schema is a plain object —
 * i.e. serializable per OpenAPI's `style`/`explode` object rules (form/
 * deepObject). Unlike {@link isSchemaNonPrimitive}, arrays (including arrays
 * of objects) are explicitly excluded: OpenAPI defines no style/explode
 * object-serialization for them, so they stay on the existing
 * passthrough/drop path.
 *
 * Used to compute {@link GetterQueryParam.objectQueryParams}. See issue #3705.
 */
const isPlainObjectSchema = (schema: OpenApiSchemaObject): boolean => {
  const schemaType = getSchemaType(schema);
  const type = Array.isArray(schemaType)
    ? schemaType.filter((variant) => variant !== 'null')
    : schemaType;
  const additionalProperties = (schema as { additionalProperties?: unknown })
    .additionalProperties;

  if (type === 'object') {
    return true;
  }
  if (Array.isArray(type) && type.includes('object')) {
    return true;
  }
  if (type === 'array' || (Array.isArray(type) && type.includes('array'))) {
    return false;
  }

  const compositions = [
    ...(Array.isArray(schema.oneOf) ? (schema.oneOf as unknown[]) : []),
    ...(Array.isArray(schema.anyOf) ? (schema.anyOf as unknown[]) : []),
    ...(Array.isArray(schema.allOf) ? (schema.allOf as unknown[]) : []),
  ];
  if (compositions.length > 0) {
    return compositions.some(
      (variant) =>
        isOpenApiSchemaObject(variant) && isPlainObjectSchema(variant),
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

/**
 * Derives the object-serialization strategy for a query parameter from its
 * declared `style`/`explode`, following the OpenAPI defaults (`style: form`,
 * `explode: true` for `form`). Returns `undefined` for parameters that are
 * not plain-object schemas or that are defined via `content:` (their
 * spec-correct encoding is a JSON string — a separate follow-up). See issue
 * #3705.
 */
const getObjectQueryParamStrategy = (
  parameter: OpenApiParameterObject,
  schema: OpenApiSchemaObject | undefined,
  isContentBased: boolean,
): 'flatten' | 'comma' | 'deepObject' | undefined => {
  if (isContentBased || !schema || !isPlainObjectSchema(schema)) {
    return undefined;
  }

  const { style, explode } = parameter as {
    style?: string;
    explode?: boolean;
  };

  if (style === 'deepObject') {
    return 'deepObject';
  }

  const resolvedStyle = style ?? 'form';
  const resolvedExplode = explode ?? resolvedStyle === 'form';

  return resolvedExplode ? 'flatten' : 'comma';
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

    const objectStrategy = getObjectQueryParamStrategy(
      parameter,
      resolvedValue.originalSchema,
      schemaParam === undefined,
    );

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
        objectStrategy,
      };
    }

    if (resolvedValue.isEnum && !resolvedValue.isRef) {
      const enumName = queryName;
      // Vendor extensions like `x-enum-varnames` may live on the parameter
      // itself rather than inside `schema` — notably after a Swagger 2 → OAS 3
      // upgrade, which moves standard schema fields into `schema` but leaves
      // vendor extensions at the parameter level.
      const parameterAsSchema = parameter as OpenApiSchemaObject;
      const enumValue = getEnum(
        resolvedValue.value,
        enumName,
        getEnumNames(resolvedValue.originalSchema) ??
          getEnumNames(parameterAsSchema),
        context.output.override.enumGenerationType,
        getEnumDescriptions(resolvedValue.originalSchema) ??
          getEnumDescriptions(parameterAsSchema),
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
        objectStrategy,
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
      objectStrategy,
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
  const objectQueryParams = types
    .filter(
      (
        type,
      ): type is QueryParamsType & {
        objectStrategy: 'flatten' | 'comma' | 'deepObject';
      } => type.objectStrategy !== undefined,
    )
    .map(({ name, objectStrategy }) => ({ key: name, strategy: objectStrategy }));

  const schema = {
    name,
    model: `export type ${name} = {\n${type}\n};\n`,
    imports,
  };

  return {
    schema,
    deps: schemas,
    isOptional: allOptional,
    paramNames: types.map(({ name }) => name),
    requiredNullableKeys,
    ...(nonPrimitiveKeys.length > 0 ? { nonPrimitiveKeys } : {}),
    ...(objectQueryParams.length > 0 ? { objectQueryParams } : {}),
  };
}
