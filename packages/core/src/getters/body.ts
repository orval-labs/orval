import { generalJSTypesWithArray } from '../constants';
import { resolveRef } from '../resolvers';
import type {
  ContextSpec,
  GetterBody,
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
  // OpenAPI `readOnly` properties are typically response-only, so request body
  // types are relaxed by default for backwards compatibility. The override lets
  // callers opt back into preserving readonly request payloads when desired.
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
