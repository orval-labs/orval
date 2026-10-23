import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GeneratorVerbOptions,
  GetterQueryParam,
  OpenApiParameterObject,
  OpenApiParameterWithSchemaObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { logger, toObjectSchema } from '../utils';

export type QueryArrayFormat = 'repeat' | 'brackets' | 'comma';

/** `pipeDelimited` / `spaceDelimited` query styles, which join array items. */
export type QueryDelimitedStyle = 'pipeDelimited' | 'spaceDelimited';

export const isDelimitedStyle = (
  style: string | undefined,
): style is QueryDelimitedStyle =>
  style === 'pipeDelimited' || style === 'spaceDelimited';

/** The percent-encoded separator a delimited style joins its items with. */
export const getQueryDelimiter = (style: QueryDelimitedStyle) =>
  style === 'pipeDelimited' ? '%7C' : '%20';

/** Whether the parameter declares a `schema` (rather than `content`). */
export const isSchemaParameter = (
  parameter: OpenApiParameterObject,
): parameter is OpenApiParameterWithSchemaObject => 'schema' in parameter;

/** Resolves a schema `$ref` and normalizes a boolean schema to an object. */
const resolveSchemaRef = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
) => {
  if (typeof schema === 'boolean') {
    return { schema: toObjectSchema(schema) };
  }
  const resolved = resolveRef(schema as OpenApiReferenceObject, context) as {
    schema: OpenApiSchemaObject;
  };
  return { schema: toObjectSchema(resolved.schema) };
};

/**
 * The operation's parameters, path-item-level ones first, deduplicated so an
 * operation-level parameter overrides a path-item-level one with the same
 * name and location. Reads the spec rather than `verbOptions.queryParams`,
 * which only carries the generated type.
 */
export function getOperationParameters(
  { pathRoute, verb }: Pick<GeneratorVerbOptions, 'pathRoute' | 'verb'>,
  context: ContextSpec,
): OpenApiParameterObject[] {
  const spec = context.spec.paths?.[pathRoute];
  // `query` is an orval verb, not an OpenAPI path-item method.
  const operation = spec && verb !== 'query' ? spec[verb] : undefined;
  // Same dedup rule as `getParameters`.
  const declared = [
    ...(spec?.parameters ?? []),
    ...(operation?.parameters ?? []),
  ];
  return [
    ...new Map(
      declared.map((parameter) => {
        const { schema } = resolveRef(parameter, context);
        const parameterObject = schema as OpenApiParameterObject;
        return [
          // oxlint-disable-next-line typescript/no-unnecessary-condition
          `${parameterObject.in}:${parameterObject.in === 'header' ? parameterObject.name?.toLowerCase() : parameterObject.name}`,
          parameterObject,
        ] as const;
      }),
    ).values(),
  ];
}

const isArrayLikeParam = (
  parameterObject: OpenApiParameterObject,
  context: ContextSpec,
) => {
  if (!isSchemaParameter(parameterObject)) return false;
  const { schema: schemaObject } = resolveSchemaRef(
    parameterObject.schema,
    context,
  );
  const compositionIncludesArray = (
    members: readonly (OpenApiSchemaObject | OpenApiReferenceObject)[] = [],
  ) =>
    members.some(
      (member) => resolveSchemaRef(member, context).schema.type === 'array',
    );
  return (
    schemaObject.type === 'array' ||
    compositionIncludesArray(schemaObject.oneOf) ||
    compositionIncludesArray(schemaObject.anyOf) ||
    compositionIncludesArray(schemaObject.allOf)
  );
};

/**
 * Whether the parameter's schema is `format: date-time`, directly, as array
 * items, or through a `oneOf` / `anyOf` / `allOf` member.
 */
export const isDateTimeParam = (
  parameterObject: OpenApiParameterObject,
  context: ContextSpec,
) => {
  if (!isSchemaParameter(parameterObject)) return false;
  const isDateTime = (
    schema: OpenApiSchemaObject | OpenApiReferenceObject,
    depth: number,
  ): boolean => {
    // Bounded so a self-referencing schema can't recurse forever.
    if (depth > 4) return false;
    const { schema: schemaObject } = resolveSchemaRef(schema, context);
    return (
      schemaObject.format === 'date-time' ||
      (schemaObject.items !== undefined &&
        isDateTime(
          schemaObject.items as OpenApiSchemaObject | OpenApiReferenceObject,
          depth + 1,
        )) ||
      [
        ...(schemaObject.oneOf ?? []),
        ...(schemaObject.anyOf ?? []),
        ...(schemaObject.allOf ?? []),
      ].some((member) => isDateTime(member, depth + 1))
    );
  };
  return isDateTime(parameterObject.schema, 0);
};

/**
 * Array query params serialized as repeated keys: `form` + `explode`, and
 * `pipeDelimited` / `spaceDelimited` with an explicit `explode: true`.
 *
 * @param arrayFormat The fetch client's `override.fetch.arrayFormat`. When set,
 * array params without an explicit `explode` are left to it instead of the
 * OpenAPI default.
 */
export const getExplodeParameters = (
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
  arrayFormat?: QueryArrayFormat,
) =>
  parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      isArrayLikeParam(parameterObject, context) &&
      ((parameterObject.style ?? 'form') === 'form'
        ? (parameterObject.explode ?? true) &&
          !(arrayFormat && parameterObject.explode === undefined)
        : isDelimitedStyle(parameterObject.style) &&
          parameterObject.explode === true),
  );

/**
 * Array query params with `style: pipeDelimited` / `spaceDelimited` and no
 * `explode: true` (`explode` defaults to false for these styles), joined into
 * one value. They take precedence over `arrayFormat`.
 */
export const getDelimitedParameters = (
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
) =>
  parameters.filter(
    (
      parameterObject,
    ): parameterObject is OpenApiParameterWithSchemaObject & {
      style: QueryDelimitedStyle;
    } =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      isDelimitedStyle(parameterObject.style) &&
      parameterObject.explode !== true &&
      isArrayLikeParam(parameterObject, context),
  );

/**
 * Array query params without an explicit `explode`, serialized per
 * `arrayFormat`. Delimited styles keep their own separator.
 */
export const getArrayFormatParameters = (
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
  arrayFormat?: QueryArrayFormat,
) =>
  arrayFormat
    ? parameters.filter(
        (
          parameterObject,
        ): parameterObject is OpenApiParameterWithSchemaObject =>
          isSchemaParameter(parameterObject) &&
          parameterObject.in === 'query' &&
          isArrayLikeParam(parameterObject, context) &&
          parameterObject.explode === undefined &&
          !isDelimitedStyle(parameterObject.style),
      )
    : [];

/** Query params with `style: deepObject`. */
export const getDeepObjectParameters = (parameters: OpenApiParameterObject[]) =>
  parameters.filter(
    (parameterObject): parameterObject is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameterObject) &&
      parameterObject.in === 'query' &&
      parameterObject.style === 'deepObject',
  );

/**
 * Whether every query param falls into one of the serialized groups, so the
 * generated URL helpers drop values that none of them handle.
 */
export const isExplodeOnly = (
  parameters: OpenApiParameterObject[],
  ...serialized: OpenApiParameterObject[][]
) =>
  serialized.reduce((count, group) => count + group.length, 0) ===
  parameters.filter((parameter) => parameter.in === 'query').length;

/** How a plain-object query param in `form` style reaches the URL. */
export type FormObjectStrategy = 'flatten' | 'comma';

/** Property names of an object schema, including `allOf` / `oneOf` / `anyOf` members. */
const getObjectPropertyNames = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
  depth = 0,
): string[] => {
  // Bounded so a self-referencing schema can't recurse forever.
  if (depth > 4) return [];
  const { schema: schemaObject } = resolveSchemaRef(schema, context);
  return [
    ...Object.keys(schemaObject.properties ?? {}),
    ...[
      ...(schemaObject.allOf ?? []),
      ...(schemaObject.oneOf ?? []),
      ...(schemaObject.anyOf ?? []),
    ].flatMap((member) => getObjectPropertyNames(member, context, depth + 1)),
  ];
};

/**
 * Plain-object query params in `form` style, the OpenAPI default, with their
 * strategy from `queryParams.objectQueryParams`:
 *
 * - `flatten` (`explode: true`): each property becomes its own key.
 * - `comma` (`explode: false`): one key with `prop,value,...`.
 *
 * `deepObject` params are left to {@link getDeepObjectParameters}. Warns when a
 * flattened property shares its key with another query param, since both then
 * reach the URL under the same name.
 */
export const getFormObjectParameters = (
  queryParams: GetterQueryParam | undefined,
  parameters: OpenApiParameterObject[],
  context: ContextSpec,
  operationName: string,
) => {
  const formObjectParameters = (queryParams?.objectQueryParams ?? []).filter(
    (parameter): parameter is { key: string; strategy: FormObjectStrategy } =>
      parameter.strategy !== 'deepObject',
  );

  const queryParameters = parameters.filter(
    (parameter): parameter is OpenApiParameterWithSchemaObject =>
      isSchemaParameter(parameter) && parameter.in === 'query',
  );
  const owners = new Map<string, string[]>();
  const addOwner = (key: string, owner: string) =>
    owners.set(key, [...(owners.get(key) ?? []), owner]);
  for (const parameter of queryParameters) {
    const flattened = formObjectParameters.some(
      ({ key, strategy }) => key === parameter.name && strategy === 'flatten',
    );
    if (flattened) {
      for (const property of new Set(
        getObjectPropertyNames(parameter.schema, context),
      )) {
        addOwner(property, `\`${parameter.name}.${property}\``);
      }
    } else {
      addOwner(parameter.name, `\`${parameter.name}\``);
    }
  }
  for (const [key, keyOwners] of owners) {
    if (keyOwners.length > 1) {
      logger.warn(
        `${operationName}: query key \`${key}\` is written by ${keyOwners.join(' and ')}, ` +
          `because flattened (\`form\` + \`explode: true\`) object properties become ` +
          `top-level query keys. The request will repeat \`${key}\`.`,
      );
    }
  }

  return formObjectParameters;
};

/**
 * The generated `forEach` branch that serializes the {@link getFormObjectParameters}
 * params, read from a `formObjectParameters` map of key to strategy. Shared by the
 * fetch and solid-start URL builders, and mirrored by the fetch shared runtime's
 * `serializeQuery`.
 *
 * Undefined properties are skipped, and an object with none left adds no key.
 * Array properties repeat the property key (`flatten`) or append their items
 * (`comma`), `Date` values use `toISOString()`, `null` is `'null'`, and nested
 * objects are JSON-encoded.
 */
export const getFormObjectQueryImplementation = () =>
  `if (typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && formObjectParameters.has(key)) {
      const commaParts: string[] = [];
      Object.entries(value).forEach(([subKey, subValue]) => {
        const items = (Array.isArray(subValue) ? subValue : [subValue])
          .filter((v) => v !== undefined)
          .map((v) => v === null ? 'null' : v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v));
        if (formObjectParameters.get(key) === 'flatten') {
          items.forEach((item) => normalizedParams.append(subKey, item));
        } else if (items.length > 0) {
          commaParts.push(subKey, ...items);
        }
      });
      if (commaParts.length > 0) {
        normalizedParams.append(key, commaParts.join(','));
      }
      return;
    }
      `;

/** The generated `formObjectParameters` map declaration, or `''` when there are none. */
export const getFormObjectParametersDeclaration = (
  formObjectParameters: { key: string; strategy: FormObjectStrategy }[],
  indent: string,
) =>
  formObjectParameters.length > 0
    ? `${indent}const formObjectParameters = new Map<string, string>(${JSON.stringify(formObjectParameters.map(({ key, strategy }) => [key, strategy]))});\n`
    : '';
