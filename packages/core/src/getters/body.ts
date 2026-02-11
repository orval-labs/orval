import { generalJSTypesWithArray } from '../constants';
import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GetterBody,
  OpenApiOperationObject,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
  OverrideOutputContentType,
} from '../types';
import { camel, filterByContentType, isReference, sanitize } from '../utils';
import { getResReqTypes } from './res-req-types';

interface GetBodyOptions {
  requestBody: OpenApiReferenceObject | OpenApiRequestBodyObject;
  operationName: string;
  context: ContextSpec;
  contentType?: OverrideOutputContentType;
}

/**
 * Extract all content types from a requestBody (#2812)
 */
export function getRequestBodyContentTypes(
  requestBody: OpenApiOperationObject['requestBody'],
  context: ContextSpec,
): string[] {
  if (!requestBody) {
    return [];
  }

  const resolvedBody = isReference(requestBody)
    ? resolveRef<OpenApiRequestBodyObject>(requestBody, context).schema
    : requestBody;

  // Bridge assertion: resolvedBody.content is typed but resolveRef propagates AnyOtherAttribute
  const content = resolvedBody.content as Record<string, unknown> | undefined;
  return content ? Object.keys(content) : [];
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

  const imports = filteredBodyTypes.flatMap(({ imports }) => imports);
  const schemas = filteredBodyTypes.flatMap(({ schemas }) => schemas);

  const definition = filteredBodyTypes.map(({ value }) => value).join(' | ');
  const hasReadonlyProps = filteredBodyTypes.some((x) => x.hasReadonlyProps);
  const nonReadonlyDefinition =
    hasReadonlyProps && definition ? `NonReadonly<${definition}>` : definition;

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
      const { schema: bodySchema } = resolveRef<OpenApiRequestBodyObject>(
        requestBody,
        context,
      );
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
