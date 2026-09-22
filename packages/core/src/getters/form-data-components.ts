import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import type {
  ContextSpec,
  OpenApiOperationObject,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
} from '../types';
import { Verbs } from '../types';
import { isInlineSchema } from '../utils';
import type { FormDataContext } from './object';
import { getRefInfo, isComponentRef } from './ref';

const MULTIPART_CONTENT_TYPE = 'multipart/form-data';

const SCHEMA_REF_PREFIX = '#/components/schemas/';

const VERBS = new Set<string>(Object.values(Verbs));

/**
 * The `encoding` map of a `multipart/form-data` media type, keyed by part name.
 */
type PartEncodings = Record<string, { contentType?: string }>;

/**
 * The {@link FormDataContext} each shared `components.schemas` entry should be
 * generated with, keyed by component name. A schema missing from the map is
 * never used as a `multipart/form-data` request body.
 *
 * Inline multipart bodies get their context from `getResReqContentTypes`,
 * which is what types their binary parts as `Blob | File` and applies the
 * media type `encoding`. A body aliased behind
 * `$ref: '#/components/schemas/upload'` is instead emitted once by
 * `generateSchemasDefinition`, far away from the operation that gives it its
 * media type — so it used to fall back to the context-free `Blob`. This index
 * carries the missing media-type information over to the shared model (#4177).
 *
 * Only multipart is indexed. `application/x-www-form-urlencoded` deliberately
 * stays out: its context narrows binary fields to `string`, and the shared
 * model may well be referenced by a multipart endpoint too, where `Blob` is
 * the correct type (#2410).
 *
 * Built once per `generateSchemasDefinition` run and passed down, rather than
 * memoized per spec: the document is free to change between runs, and a cache
 * keyed on its identity would hand back an index describing the old paths.
 */
export function getFormDataComponentContexts(
  context: ContextSpec,
): Map<string, FormDataContext> {
  const encodings = new Map<string, PartEncodings>();

  const requestBodies = (context.spec.components?.requestBodies ??
    {}) as Record<string, OpenApiReferenceObject | OpenApiRequestBodyObject>;

  for (const requestBody of Object.values(requestBodies)) {
    indexRequestBody(requestBody, context, encodings);
  }

  for (const pathItem of Object.values(context.spec.paths ?? {})) {
    if (!pathItem) {
      continue;
    }

    for (const [verb, operation] of Object.entries(
      pathItem as Record<string, unknown>,
    )) {
      if (!VERBS.has(verb)) {
        continue;
      }

      const requestBody = (operation as OpenApiOperationObject | undefined)
        ?.requestBody;

      if (requestBody) {
        indexRequestBody(requestBody, context, encodings);
      }
    }
  }

  return new Map(
    [...encodings].map(([schemaName, encoding]) => [
      schemaName,
      { atPart: false, encoding },
    ]),
  );
}

function indexRequestBody(
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject,
  context: ContextSpec,
  encodings: Map<string, PartEncodings>,
): void {
  // Request bodies referencing `#/components/requestBodies/...` are already
  // covered by the components sweep above; anything else (a bundler-emitted
  // path ref, an external document) has no named slot to look up here.
  if (!isInlineSchema(requestBody)) {
    return;
  }

  const mediaType = requestBody.content[MULTIPART_CONTENT_TYPE];

  const schema = mediaType?.schema;

  // `isComponentRef` is what rejects a ref that only *starts* at a component,
  // such as `#/components/schemas/Wrapper/properties/upload`: `getRefInfo`
  // names it after its last token, which would hand the form-data context to
  // an unrelated `components.schemas.upload`.
  // A `$ref` with siblings is a Schema Object in OAS 3.1, so this is a string
  // `$ref` check rather than a Reference Object guard. Boolean schemas have no `$ref`.
  if (
    !schema ||
    isBooleanJsonSchema(schema) ||
    typeof schema.$ref !== 'string' ||
    !schema.$ref.startsWith(SCHEMA_REF_PREFIX) ||
    !isComponentRef(schema.$ref)
  ) {
    return;
  }

  const { originalName } = getRefInfo(schema.$ref, context);
  const encoding = (mediaType.encoding ?? {}) as PartEncodings;
  const indexed = encodings.get(originalName);

  if (!indexed) {
    encodings.set(originalName, { ...encoding });
    return;
  }

  // A schema shared by several multipart endpoints can be described by
  // conflicting `encoding` entries; there is a single emitted model, so the
  // first declaration of a part wins.
  for (const [part, partEncoding] of Object.entries(encoding)) {
    indexed[part] ??= partEncoding;
  }
}
