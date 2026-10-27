import {
  type ContextSpec,
  isObject,
  isString,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  resolveRef,
  toObjectSchema,
} from '@orval/core';

import { logger, warnOnce } from './logger';
import {
  generateValibotValidationSchemaDefinition,
  type ValibotNode,
} from './schema';

const tryResolveRefSchema = (
  $ref: string,
  context: ContextSpec,
): OpenApiSchemaObject | undefined => {
  try {
    return resolveRef<OpenApiSchemaObject>({ $ref }, context).schema;
  } catch (error) {
    logger.verbose(
      `Failed to resolve $ref "${$ref}": ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  }
};

const dereferenceValue = (value: unknown, context: ContextSpec): unknown => {
  if (isObject(value)) return dereferenceObject(value, context);
  return Array.isArray(value)
    ? value.map((item: unknown) => dereferenceValue(item, context))
    : value;
};

const dereferenceObject = (
  schema: Record<string, unknown>,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  const refName = isString(schema.$ref) ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    warnOnce(`Circular $ref "${refName}" is validated as unknown.`);
    return {};
  }

  const resolvedContext: ContextSpec = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents ?? []), refName] }
      : undefined),
  };

  const resolveReferenced = (
    name: string,
  ): Record<string, unknown> | undefined => {
    const referenced = tryResolveRefSchema(name, context);
    if (!referenced || typeof referenced !== 'object') return;
    const siblings = Object.fromEntries(
      Object.entries(schema).filter(([key]) => key !== '$ref'),
    );
    return { ...referenced, ...siblings };
  };

  const resolved = refName ? resolveReferenced(refName) : schema;
  if (!resolved) return {};

  // The entries are rebuilt from a JSON document, so the compiler cannot see
  // that the result is still a schema.
  return Object.fromEntries(
    Object.entries(resolved).map(([key, value]) => {
      if (key === 'properties' && isObject(value)) {
        return [
          key,
          Object.fromEntries(
            Object.entries(value).map(([name, property]) => [
              name,
              dereferenceValue(property, resolvedContext),
            ]),
          ),
        ];
      }
      return [
        key,
        key === 'default' || key === 'example' || key === 'examples'
          ? value
          : dereferenceValue(value, resolvedContext),
      ];
    }),
  ) as OpenApiNonBooleanSchemaObject;
};

/**
 * Inlines every `$ref`. A circular `$ref` becomes an empty schema, which is
 * validated as `unknown`.
 */
export const dereference = (
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): OpenApiNonBooleanSchemaObject => {
  if (typeof schema === 'boolean') return toObjectSchema(schema);
  return isObject(schema) ? dereferenceObject(schema, context) : {};
};

// `+json` vendor types and form bodies validate as plain objects.
const MEDIA_TYPES = [
  /^application\/([^/;]+\+)?json$/,
  /^application\/x-www-form-urlencoded$/,
  /^multipart\/form-data$/,
];

export interface ParseBodyAndResponseOptions {
  data:
    | OpenApiResponseObject
    | OpenApiRequestBodyObject
    | OpenApiReferenceObject
    | undefined;
  context: ContextSpec;
  strict: boolean;
  generate: boolean;
}

export const parseBodyAndResponse = ({
  data,
  context,
  strict,
  generate,
}: ParseBodyAndResponseOptions): ValibotNode | undefined => {
  if (!data || !generate) return;

  const { content } = resolveRef<
    OpenApiResponseObject | OpenApiRequestBodyObject
  >(data, context).schema;

  const entries = Object.entries(content ?? {});
  const schema = MEDIA_TYPES.map((pattern) =>
    entries.find(([contentType]) =>
      pattern.test(contentType.split(';')[0].trim().toLowerCase()),
    ),
  ).find(Boolean)?.[1].schema;
  if (!schema) return;

  return generateValibotValidationSchemaDefinition(
    dereference(schema, context),
    context,
    strict,
    { required: true },
  );
};

// The first success response, the way the zod package picks it.
export const getSingleResponse = (
  responses:
    | Record<string, OpenApiResponseObject | OpenApiReferenceObject | undefined>
    | undefined,
) =>
  responses?.['200'] ??
  responses?.['2XX'] ??
  responses?.['2xx'] ??
  Object.entries(responses ?? {}).find(
    ([code]) => code.startsWith('2') && code !== '204' && code !== '205',
  )?.[1];

export type Locations<T> = Record<
  'param' | 'query' | 'header' | 'body' | 'response',
  T
>;

export interface ParseParametersOptions {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[] | undefined;
  context: ContextSpec;
  strict: Locations<boolean>;
  generate: Locations<boolean>;
}

export interface ParsedParameters {
  headers?: ValibotNode;
  queryParams?: ValibotNode;
  params?: ValibotNode;
}

type ParameterTarget = keyof ParsedParameters;

const PARAMETER_LOCATIONS = new Map<
  string,
  { location: 'param' | 'query' | 'header'; target: ParameterTarget }
>([
  ['path', { location: 'param', target: 'params' }],
  ['query', { location: 'query', target: 'queryParams' }],
  ['header', { location: 'header', target: 'headers' }],
]);

export const parseParameters = ({
  data,
  context,
  strict,
  generate,
}: ParseParametersOptions): ParsedParameters => {
  // Keyed by name, so a repeated parameter keeps its position and its last
  // schema.
  const defs: Record<ParameterTarget, Map<string, ValibotNode>> = {
    params: new Map(),
    queryParams: new Map(),
    headers: new Map(),
  };

  for (const item of data ?? []) {
    const { schema: parameter } = resolveRef<OpenApiParameterObject>(
      item,
      context,
    );
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!('schema' in parameter) || !parameter.in || !parameter.name) continue;

    const target = PARAMETER_LOCATIONS.get(parameter.in);
    if (!target || !generate[target.location]) continue;

    const resolvedSchema = dereference(parameter.schema, context);

    defs[target.target].set(
      parameter.name,
      generateValibotValidationSchemaDefinition(
        {
          ...resolvedSchema,
          description: parameter.description ?? resolvedSchema.description,
        },
        context,
        strict[target.location],
        { required: parameter.required },
      ),
    );
  }

  const toObject = (
    props: Map<string, ValibotNode>,
    isStrict: boolean,
  ): ValibotNode | undefined =>
    props.size === 0
      ? undefined
      : {
          schema: {
            kind: 'object',
            mode: isStrict ? 'strictObject' : 'object',
            entries: [...props].map(([key, value]) => ({ key, value })),
          },
          actions: [],
          nullable: false,
          optional: false,
        };

  return {
    headers: toObject(defs.headers, strict.header),
    queryParams: toObject(defs.queryParams, strict.query),
    params: toObject(defs.params, strict.param),
  };
};
