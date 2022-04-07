import { ReferenceObject, RequestBodyObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs } from '../../types';
import { GetterBody } from '../../types/getters';
import { camel } from '../../utils/case';
import { getResReqTypes } from './resReqTypes';

export const getBody = async (
  requestBody: ReferenceObject | RequestBodyObject,
  operationName: string,
  context: ContextSpecs,
): Promise<GetterBody> => {
  const allBodyTypes = await getResReqTypes(
    [[context.override.components.requestBodies.suffix, requestBody]],
    operationName,
    context,
  );

  const imports = allBodyTypes.flatMap(({ imports }) => imports);
  const schemas = allBodyTypes.flatMap(({ schemas }) => schemas);

  const definition = allBodyTypes.map(({ value }) => value).join(' | ');

  const implementation =
    generalJSTypesWithArray.includes(definition.toLowerCase()) ||
    allBodyTypes.length > 1
      ? camel(operationName) + context.override.components.requestBodies.suffix
      : camel(definition);
  const formData =
    allBodyTypes.length === 1 ? allBodyTypes[0].formData : undefined;

  const formUrlEncoded =
    allBodyTypes.length === 1 ? allBodyTypes[0].formUrlEncoded : undefined;

  const contentType =
    allBodyTypes.length === 1 ? allBodyTypes[0].contentType : undefined;

  return {
    definition,
    implementation,
    imports,
    schemas,
    formData: formData || '',
    formUrlEncoded: formUrlEncoded || '',
    contentType: contentType || '',
  };
};
