import { ReferenceObject, RequestBodyObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs } from '../../types';
import { GeneratorImport, GeneratorSchema } from '../../types/generator';
import { GetterBody } from '../../types/getters';
import { camel } from '../../utils/case';
import { getResReqTypes } from './resReqTypes';

export const getBody = async (
  requestBody: ReferenceObject | RequestBodyObject,
  operationId: string,
  context: ContextSpecs,
): Promise<GetterBody> => {
  const allBodyTypes = await getResReqTypes(
    [[context.override.components.requestBodies.suffix, requestBody]],
    operationId,
    context,
  );

  const imports = allBodyTypes.reduce<GeneratorImport[]>(
    (acc, { imports = [] }) => {
      acc.push(...imports);

      return acc;
    },
    [],
  );
  const schemas = allBodyTypes.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => {
      acc.push(...schemas);

      return acc;
    },
    [],
  );

  const definition = allBodyTypes.map(({ value }) => value).join(' | ');

  const implementation =
    generalJSTypesWithArray.includes(definition.toLowerCase()) ||
    allBodyTypes.length > 1
      ? camel(operationId) + context.override.components.requestBodies.suffix
      : camel(definition);
  const formData =
    allBodyTypes.length === 1 ? allBodyTypes[0].formData : undefined;

  const formUrlEncoded =
    allBodyTypes.length === 1 ? allBodyTypes[0].formUrlEncoded : undefined;

  return {
    definition,
    implementation,
    imports,
    schemas,
    formData: formData || '',
    formUrlEncoded: formUrlEncoded || '',
  };
};
