import { ReferenceObject, RequestBodyObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs, OverrideOutputContentType } from '../../types';
import { GetterBody } from '../../types/getters';
import { camel } from '../../utils/case';
import { getResReqTypes } from './resReqTypes';

export const getBody = async ({
  requestBody,
  operationName,
  context,
  contentType,
}: {
  requestBody: ReferenceObject | RequestBodyObject;
  operationName: string;
  context: ContextSpecs;
  contentType?: OverrideOutputContentType;
}): Promise<GetterBody> => {
  const allBodyTypes = await getResReqTypes(
    [[context.override.components.requestBodies.suffix, requestBody]],
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

  const implementation =
    generalJSTypesWithArray.includes(definition.toLowerCase()) ||
    filteredBodyTypes.length > 1
      ? camel(operationName) + context.override.components.requestBodies.suffix
      : camel(definition);

  return {
    definition,
    implementation,
    imports,
    schemas,
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
