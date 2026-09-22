import type {
  ContextSpec,
  OpenApiDocument,
  OpenApiMediaTypeObject,
  OpenApiOperationObject,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
} from '../types';
import { Verbs } from '../types';
import { isReference } from '../utils/assertion';
import type { FormDataContext } from './object';
import { getRefInfo } from './ref';

const MULTIPART_CONTENT_TYPE = 'multipart/form-data';

const SCHEMA_REF_PREFIX = '#/components/schemas/';

const VERBS = new Set<string>(Object.values(Verbs));

/**
 * The `encoding` map of a `multipart/form-data` media type, keyed by part name.
 */
type PartEncodings = Record<string, { contentType?: string }>;

/**
 * Memoized per spec document rather than per {@link ContextSpec}: contexts are
 * shallow-copied all over the generators (scoped contexts, per-schema dynamic
 * scopes), so a cache stored on one would be inherited by copies made for
 * other specs.
 */
const indexBySpec = new WeakMap<OpenApiDocument, Map<string, PartEncodings>>();

/**
 * Names of `components.schemas` entries used *directly* as the schema of a
 * `multipart/form-data` request body, mapped to the `encoding` declared on the
 * media type that references them.
 *
 * Inline multipart bodies get their {@link FormDataContext} from
 * `getResReqContentTypes`, which is what types their binary parts as
 * `Blob | File`. A body aliased behind `$ref: '#/components/schemas/upload'`
 * is instead emitted once by `generateSchemasDefinition`, far away from the
 * operation that gives it its media type — so it used to fall back to the
 * context-free `Blob`. This index carries the missing media-type information
 * over to the shared model (#4177).
 *
 * Only multipart is indexed. `application/x-www-form-urlencoded` deliberately
 * stays out: its context narrows binary fields to `string`, and the shared
 * model may well be referenced by a multipart endpoint too, where `Blob` is
 * the correct type (#2410).
 */
function collectFormDataComponentSchemas(
  context: ContextSpec,
): Map<string, PartEncodings> {
  const index = new Map<string, PartEncodings>();

  const requestBodies = (context.spec.components?.requestBodies ??
    {}) as Record<string, OpenApiReferenceObject | OpenApiRequestBodyObject>;

  for (const requestBody of Object.values(requestBodies)) {
    indexRequestBody(requestBody, context, index);
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
        indexRequestBody(requestBody, context, index);
      }
    }
  }

  return index;
}

function indexRequestBody(
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject,
  context: ContextSpec,
  index: Map<string, PartEncodings>,
): void {
  // Request bodies referencing `#/components/requestBodies/...` are already
  // covered by the components sweep above; anything else (a bundler-emitted
  // path ref, an external document) has no named slot to look up here.
  if (isReference(requestBody)) {
    return;
  }

  const mediaType = (
    requestBody.content as
      | Record<string, OpenApiMediaTypeObject | undefined>
      | undefined
  )?.[MULTIPART_CONTENT_TYPE];

  const schema = mediaType?.schema;

  if (
    !schema ||
    !isReference(schema) ||
    !schema.$ref?.startsWith(SCHEMA_REF_PREFIX)
  ) {
    return;
  }

  const { originalName } = getRefInfo(schema.$ref, context);
  const encoding = (mediaType.encoding ?? {}) as PartEncodings;
  const indexed = index.get(originalName);

  if (!indexed) {
    index.set(originalName, { ...encoding });
    return;
  }

  // A schema shared by several multipart endpoints can be described by
  // conflicting `encoding` entries; there is a single emitted model, so the
  // first declaration of a part wins.
  for (const [part, partEncoding] of Object.entries(encoding)) {
    indexed[part] ??= partEncoding;
  }
}

/**
 * The {@link FormDataContext} a shared `components.schemas` entry should be
 * generated with, or `undefined` when it is never used as a
 * `multipart/form-data` request body.
 *
 * @see {@link collectFormDataComponentSchemas}
 */
export function getFormDataComponentContext(
  schemaName: string,
  context: ContextSpec,
): FormDataContext | undefined {
  let index = indexBySpec.get(context.spec);

  if (!index) {
    index = collectFormDataComponentSchemas(context);
    indexBySpec.set(context.spec, index);
  }

  const encoding = index.get(schemaName);

  return encoding ? { atPart: false, encoding } : undefined;
}
