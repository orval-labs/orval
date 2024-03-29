import { ReferenceObject, RequestBodyObject } from 'openapi3-ts/oas30';
import { generalJSTypesWithArray } from '../constants';
import { resolveRef } from '../resolvers';
import { ContextSpecs, GetterBody, OverrideOutputContentType } from '../types';
import { camel, isReference, sanitize } from '../utils';
import { getResReqTypes } from './res-req-types';

export const getBody = ({
  requestBody,
  operationName,
  context,
  contentType,
}: {
  requestBody: ReferenceObject | RequestBodyObject;
  operationName: string;
  context: ContextSpecs;
  contentType?: OverrideOutputContentType;
}): GetterBody => {
  const allBodyTypes = getResReqTypes(
    [[context.output.override.components.requestBodies.suffix, requestBody]],
    operationName,
    context,
  );

  const filteredBodyTypes = contentType
    ? allBodyTypes.filter((type) => {
        let include = true;
        let exclude = false;

        if (contentType.include) {
          include = contentType.include.includes(type.contentType);
        }

        if (contentType.exclude) {
          exclude = contentType.exclude.includes(type.contentType);
        }

        return include && !exclude;
      })
    : allBodyTypes;

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
      const { schema: bodySchema } = resolveRef<RequestBodyObject>(
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
};
