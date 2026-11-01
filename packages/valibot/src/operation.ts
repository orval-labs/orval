import {
  type ContextSpec,
  isObject,
  type OpenApiParameterObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  resolveRef,
} from '@orval/core';

import { dereference } from './dereference';
import { withFileParts, type PartEncoding } from './form-data';
import { plainNode, type ValibotNode } from './nodes';
import { omitReadOnly } from './read-only';
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

interface ParseBodyAndResponseOptions {
  data:
    | OpenApiResponseObject
    | OpenApiRequestBodyObject
    | OpenApiReferenceObject
    | undefined;
  context: ContextSpec;
  strict: boolean;
  generate: boolean;
  isRequest: boolean;
}

export const parseBodyAndResponse = ({
  data,
  context,
  strict,
  generate,
  isRequest,
}: ParseBodyAndResponseOptions): ValibotNode | undefined => {
  if (!data || !generate) return;

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
  const media = MEDIA_TYPES.map((pattern) =>
    schemas.find(({ contentType }) => pattern.test(contentType)),
  ).find(Boolean);
  if (!media) return;

  const resolved = dereference(media.schema, context);
  const node = generateValibotValidationSchemaDefinition(
    isRequest ? omitReadOnly(resolved) : resolved,
    context,
    strict,
    { required: true, urlEncoded: URL_ENCODED_TYPE.test(media.contentType) },
  );
  return MULTIPART_TYPE.test(media.contentType)
    ? withFileParts(node, resolved, media.encoding)
    : node;
};

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

type ParameterLocation = 'param' | 'query' | 'header';

const PARAMETER_LOCATIONS = new Map<string, ParameterLocation>([
  ['path', 'param'],
  ['query', 'query'],
  ['header', 'header'],
]);

export const parseParameters = ({
  data,
  context,
  strict,
  generate,
}: ParseParametersOptions): ParsedParameters => {
  // Keyed by name: a repeated parameter keeps its position and last schema.
  const defs: Record<ParameterLocation, Map<string, ValibotNode>> = {
    param: new Map(),
    query: new Map(),
    header: new Map(),
  };

  for (const item of data ?? []) {
    const { schema: parameter } = resolveRef<OpenApiParameterObject>(
      item,
      context,
    );
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!('schema' in parameter) || !parameter.in || !parameter.name) continue;

    const location = PARAMETER_LOCATIONS.get(parameter.in);
    if (!location || !generate[location]) continue;

    const resolvedSchema = dereference(parameter.schema, context);

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
