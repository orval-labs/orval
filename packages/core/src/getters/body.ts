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
import { camel, filterByContentType, isReference, sanitize } from '../utils';
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
      if (bodySchema.required !== undefined) {
        isOptional = !bodySchema.required;
      }
    } else if (requestBody.required !== undefined) {
      isOptional = !requestBody.required;
    }
  }

  return {
    originalSchema: requestBody,
    definition: nonReadonlyDefinition,
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
}: GetBodyOptions): Array<GetterBody & { contentTypeSuffix: string }> {
  const allBodyTypes = getResReqTypes(
    [[context.output.override.components.requestBodies.suffix, requestBody]],
    operationName,
    context,
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

  return filteredBodyTypes.map((bodyType) => {
    const suffix = getContentTypeSuffix(bodyType.contentType);
    const body = buildBody([bodyType], requestBody, operationName, context);
    return {
      ...body,
      contentTypeSuffix: suffix,
    };
  });
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
  if (CONTENT_TYPE_SUFFIX_MAP[contentType]) {
    return CONTENT_TYPE_SUFFIX_MAP[contentType];
  }
  // For unknown content types, derive a PascalCase suffix from the subtype
  const subtype = contentType.split('/')[1] ?? contentType;
  return subtype
    .split(/[-+.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
