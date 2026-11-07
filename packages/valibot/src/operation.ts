import {
  type ContextSpec,
  isObject,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  isString,
  resolveRef,
} from '@orval/core';

import { dereference } from './dereference';
import { withFileParts, type PartEncoding } from './form-data';
import { plainNode, type ValibotNode } from './nodes';
import { omitDirectional } from './read-only';
import { createRefPolicy } from './ref-policy';
import { getLocalRefTarget } from './refs';
import { generateValibotValidationSchemaDefinition } from './schema';

const JSON_TYPE = /^application\/([^/;]+\+)?json$/;
const MULTIPART_TYPE = /^multipart\/form-data$/;
const URL_ENCODED_TYPE = /^application\/x-www-form-urlencoded$/;

// Same order as the zod package; `+json` vendor types validate like JSON.
const MEDIA_TYPES = [JSON_TYPE, MULTIPART_TYPE, URL_ENCODED_TYPE];

interface MediaSchema {
  contentType: string;
  schema: OpenApiSchemaObject;
  encoding?: PartEncoding;
}

type BodyOrResponse =
  | OpenApiResponseObject
  | OpenApiRequestBodyObject
  | OpenApiReferenceObject;

// The first content with a schema in a media type that gets one.
const selectMedia = (
  data: BodyOrResponse | undefined,
  context: ContextSpec,
): MediaSchema | undefined => {
  if (!data) return;
  const { content } = resolveRef<
    OpenApiResponseObject | OpenApiRequestBodyObject
  >(data, context).schema;

  // A media type without a schema is skipped so it cannot hide a later one.
  const schemas = Object.entries(content ?? {}).flatMap(
    ([contentType, media]): MediaSchema[] =>
      isObject(media) && (isObject(media.schema) || media.schema === true)
        ? [
            {
              contentType: contentType.split(';')[0].trim().toLowerCase(),
              schema: media.schema,
              encoding: isObject(media.encoding) ? media.encoding : undefined,
            },
          ]
        : [],
  );
  return MEDIA_TYPES.map((pattern) =>
    schemas.find(({ contentType }) => pattern.test(contentType)),
  ).find(Boolean);
};

const describeSite = (operation: string | undefined, site: string): string =>
  operation ? `${operation} ${site}` : site;

interface ParseBodyAndResponseOptions {
  data: BodyOrResponse | undefined;
  context: ContextSpec;
  strict: boolean;
  // Defaults to the output-level option.
  exactOptional?: boolean;
  generate: boolean;
  isRequest: boolean;
  // The operation, named when its schema is too large to inline.
  operation?: string;
}

export const parseBodyAndResponse = ({
  data,
  context,
  strict,
  exactOptional = context.output.override.valibot.exactOptional,
  generate,
  isRequest,
  operation,
}: ParseBodyAndResponseOptions): ValibotNode | undefined => {
  if (!generate) return;
  const media = selectMedia(data, context);
  if (!media) return;

  // Form parts are rebuilt from the inlined tree.
  const isForm =
    MULTIPART_TYPE.test(media.contentType) ||
    URL_ENCODED_TYPE.test(media.contentType);
  const direction = isRequest ? 'readOnly' : 'writeOnly';
  const resolved = dereference(
    media.schema,
    context,
    isForm
      ? undefined
      : createRefPolicy({ context, direction, strict, exactOptional }),
    { label: describeSite(operation, isRequest ? 'request body' : 'response') },
  );
  const node = generateValibotValidationSchemaDefinition(
    omitDirectional(resolved, direction),
    context,
    strict,
    { required: true, urlEncoded: URL_ENCODED_TYPE.test(media.contentType) },
  );
  return MULTIPART_TYPE.test(media.contentType)
    ? withFileParts(node, resolved, media.encoding)
    : node;
};

const isSuccessWithBody = (code: string) =>
  code.startsWith('2') && code !== '204' && code !== '205';

// `200`, then `2XX`, then the other 2xx codes, skipping one with no content
// that gets a schema.
export const getSingleResponse = (
  responses: Record<string, BodyOrResponse | undefined> | undefined,
  context: ContextSpec,
): BodyOrResponse | undefined => {
  const codes = Object.keys(responses ?? {});
  const ordered = [
    '200',
    '2XX',
    '2xx',
    ...codes.filter(
      (code) =>
        isSuccessWithBody(code) && !['200', '2XX', '2xx'].includes(code),
    ),
  ];
  return ordered
    .map((code) => responses?.[code])
    .find((response) => selectMedia(response, context) !== undefined);
};

export type Locations<T> = Record<
  'param' | 'query' | 'header' | 'body' | 'response',
  T
>;

export interface ParseParametersOptions {
  data: (OpenApiParameterObject | OpenApiReferenceObject)[] | undefined;
  context: ContextSpec;
  strict: Locations<boolean>;
  // Defaults to the output-level option.
  exactOptional?: boolean;
  generate: Locations<boolean>;
  // The operation, named when its schema is too large to inline.
  operation?: string;
}

export interface ParsedParameters {
  headers?: ValibotNode;
  queryParams?: ValibotNode;
  params?: ValibotNode;
}

type ParameterLocation = 'param' | 'query' | 'header';

const PARAMETER_LOCATIONS = new Map<string, ParameterLocation>([
  ['path', 'param'],
  ['query', 'query'],
  ['header', 'header'],
]);

type SchemaParameter = OpenApiParameterObject & {
  schema: OpenApiSchemaObject | OpenApiReferenceObject;
};

const isSchemaParameter = (value: unknown): value is SchemaParameter =>
  isObject(value) &&
  isString(value.in) &&
  isString(value.name) &&
  value.name !== '' &&
  value.schema !== undefined;

// Follows the `$ref`s of a parameter without resolving its schema, so a
// reference there can still become a component constant.
const resolveParameter = (
  item: OpenApiParameterObject | OpenApiReferenceObject,
  context: ContextSpec,
): SchemaParameter | undefined => {
  const seen = new Set<string>();
  const follow = (current: unknown): SchemaParameter | undefined => {
    if (isSchemaParameter(current)) return current;
    if (!isObject(current) || !isString(current.$ref)) return undefined;
    if (seen.has(current.$ref)) return undefined;
    seen.add(current.$ref);
    return follow(getLocalRefTarget(current.$ref, context));
  };
  return follow(item);
};

export const parseParameters = ({
  data,
  context,
  strict,
  exactOptional = context.output.override.valibot.exactOptional,
  generate,
  operation,
}: ParseParametersOptions): ParsedParameters => {
  // Keyed by name: a repeated parameter keeps its position and last schema.
  const defs: Record<ParameterLocation, Map<string, ValibotNode>> = {
    param: new Map(),
    query: new Map(),
    header: new Map(),
  };

  for (const item of data ?? []) {
    const parameter = resolveParameter(item, context);
    if (!parameter) continue;

    const location = PARAMETER_LOCATIONS.get(parameter.in);
    if (!location || !generate[location]) continue;

    const resolvedSchema = dereference(
      parameter.schema,
      context,
      createRefPolicy({ context, strict: strict[location], exactOptional }),
      {
        label: describeSite(
          operation,
          `${location} parameter "${parameter.name}"`,
        ),
      },
    );

    defs[location].set(
      parameter.name,
      generateValibotValidationSchemaDefinition(
        {
          ...resolvedSchema,
          description: parameter.description ?? resolvedSchema.description,
        },
        context,
        strict[location],
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
      : plainNode({
          kind: 'object',
          mode: isStrict ? 'strictObject' : 'object',
          entries: [...props].map(([key, value]) => ({ key, value })),
        });

  return {
    headers: toObject(defs.header, strict.header),
    queryParams: toObject(defs.query, strict.query),
    params: toObject(defs.param, strict.param),
  };
};
