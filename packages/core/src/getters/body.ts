import { generalJSTypesWithArray } from '../constants';
import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GetterBody,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OverrideOutputContentType,
  ResReqTypesValue,
} from '../types';
import {
  camel,
  filterByContentType,
  isBinaryContentType,
  isReference,
  sanitize,
} from '../utils';
import { getResReqTypes } from './res-req-types';

interface GetBodyOptions {
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject;
  operationName: string;
  context: ContextSpec;
  contentType?: OverrideOutputContentType;
}

function buildBody(
  filteredBodyTypes: ResReqTypesValue[],
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject,
  operationName: string,
  context: ContextSpec,
): GetterBody {
  const imports = filteredBodyTypes.flatMap(({ imports }) => imports);
  const schemas = filteredBodyTypes.flatMap(({ schemas }) => schemas);

  const definition = filteredBodyTypes.map(({ value }) => value).join(' | ');
  const hasReadonlyProps = filteredBodyTypes.some((x) => x.hasReadonlyProps);
  const nonReadonlyDefinition =
    hasReadonlyProps &&
    definition &&
    context.output.override.preserveReadonlyRequestBodies !== 'preserve'
      ? `NonReadonly<${definition}>`
      : definition;

  let implementation =
    generalJSTypesWithArray.includes(definition.toLowerCase()) ||
    filteredBodyTypes.length > 1
      ? camel(operationName) +
        context.output.override.components.requestBodies.suffix
      : camel(definition);

  const overrideName = getRequestBodyExtensionName(requestBody, context);
  if (overrideName) {
    implementation = camel(overrideName);
  }

  let isOptional = false;
  if (implementation) {
    implementation = sanitize(implementation, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });
    if (isReference(requestBody)) {
      const { schema: bodySchema }: { schema: OpenApiRequestBodyObject } =
        resolveRef(requestBody, context);
      isOptional = bodySchema.required !== true;
    } else {
      isOptional = requestBody.required !== true;
    }
  }

  return {
    originalSchema: requestBody,
    definition: nonReadonlyDefinition,
    isBlob: filteredBodyTypes.some(
      (t) =>
        (!!t.contentType && isBinaryContentType(t.contentType)) ||
        t.originalSchema?.format === 'binary' ||
        (t.originalSchema?.contentMediaType === 'application/octet-stream' &&
          !t.originalSchema.contentEncoding),
    ),
    implementation,
    imports,
    schemas,
    isOptional,
    ...(filteredBodyTypes.length === 1
      ? {
          formData: filteredBodyTypes[0].formData,
          formUrlEncoded: filteredBodyTypes[0].formUrlEncoded,
          contentType: filteredBodyTypes[0].contentType,
        }
      : {
          formData: '',
          formUrlEncoded: '',
          contentType: '',
        }),
  };
}

export function getBody({
  requestBody,
  operationName,
  context,
  contentType,
}: GetBodyOptions): GetterBody {
  const allBodyTypes = getResReqTypes(
    [[context.output.override.components.requestBodies.suffix, requestBody]],
    operationName,
    context,
  );

  const filteredBodyTypes = filterByContentType(allBodyTypes, contentType);

  return buildBody(filteredBodyTypes, requestBody, operationName, context);
}

/**
 * Returns per-content-type bodies when `splitByContentType` is enabled.
 * Each entry includes a `contentTypeSuffix` for generating distinct function names.
 */
export function getBodiesByContentType({
  requestBody,
  operationName,
  context,
  contentType,
}: GetBodyOptions): (GetterBody & { contentTypeSuffix: string })[] {
  const allBodyTypes = getResReqTypes(
    [[context.output.override.components.requestBodies.suffix, requestBody]],
    operationName,
    context,
    undefined,
    (item) => `${item.value}::${item.contentType}`,
  );

  const filteredBodyTypes = filterByContentType(allBodyTypes, contentType);

  // If there's only one content type, no need to split
  if (filteredBodyTypes.length <= 1) {
    return [
      {
        ...buildBody(filteredBodyTypes, requestBody, operationName, context),
        contentTypeSuffix: '',
      },
    ];
  }

  // Distinct media types can share a suffix: `application/a-b` and
  // `application/a+b` both reduce to `AB`, and any two types made only of
  // stripped characters both reduce to `Content`. Two bodies would then emit
  // the same `${operationName}With${suffix}` declaration and the generated
  // file would not compile, so number the repeats.
  //
  // The number has to be checked against what was actually handed out, not
  // against a per-base counter: `application/a-b`, `application/a+b` and
  // `application/a-b2` reduce to `AB`, `AB` and `AB2`, so a counter would give
  // the second and third the same `AB2`. The first occurrence still keeps the
  // plain suffix, which leaves every non-colliding name unchanged.
  const usedSuffixes = new Set<string>();

  return filteredBodyTypes.map((bodyType) => {
    const baseSuffix = getContentTypeSuffix(bodyType.contentType);
    let suffix = baseSuffix;
    for (let n = 2; usedSuffixes.has(suffix); n++) {
      suffix = `${baseSuffix}${n}`;
    }
    usedSuffixes.add(suffix);

    const body = buildBody([bodyType], requestBody, operationName, context);
    return {
      ...body,
      contentTypeSuffix: suffix,
    };
  });
}

function getRequestBodyExtensionName(
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject,
  context: ContextSpec,
): string | undefined {
  let value: unknown;
  if (isReference(requestBody)) {
    const { schema } = resolveRef(requestBody, context);
    value = (schema as Record<string, unknown>)?.[
      'x-codegen-request-body-name'
    ];
  } else {
    value = (requestBody as Record<string, unknown>)?.[
      'x-codegen-request-body-name'
    ];
  }
  return typeof value === 'string' ? value : undefined;
}

const CONTENT_TYPE_SUFFIX_MAP: Record<string, string> = {
  'application/json': 'Json',
  'multipart/form-data': 'FormData',
  'application/x-www-form-urlencoded': 'UrlEncoded',
  'text/plain': 'Text',
  'application/xml': 'Xml',
  'text/xml': 'Xml',
  'application/octet-stream': 'Blob',
};

function getContentTypeSuffix(contentType: string): string {
  // `contentType` is a raw spec key, so a plain index would resolve inherited
  // members: a media type named `toString` would otherwise return the function
  // itself and splice its source into the generated identifier.
  if (Object.hasOwn(CONTENT_TYPE_SUFFIX_MAP, contentType)) {
    return CONTENT_TYPE_SUFFIX_MAP[contentType];
  }
  // For unknown content types, derive a PascalCase suffix from the subtype.
  //
  // The media type is a raw key from the spec's `content` object and is not
  // validated anywhere upstream, while this suffix is concatenated straight
  // into generated identifiers (`${operationName}With${suffix}`). Anything
  // that is not an identifier character has to be dropped, or a crafted media
  // type breaks out of the declaration and injects arbitrary top-level code.
  // `$` is kept: it is legal both in a JS identifier and in an RFC 6838
  // subtype, so dropping it would needlessly merge distinct media types.
  const subtype = contentType.split('/')[1] ?? contentType;
  const suffix = subtype
    .split(/[-+.]/)
    .map((part) => part.replaceAll(/[^A-Za-z0-9_$]/g, ''))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // A media type made up entirely of stripped characters would otherwise
  // collapse to `${operationName}With`. Callers still have to disambiguate
  // repeats — see `getBodiesByContentType`.
  return suffix || 'Content';
}
