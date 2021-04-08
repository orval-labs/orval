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
    [['body', requestBody]],
    operationId,
    context,
  );

  const imports = allBodyTypes.reduce<GeneratorImport[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const schemas = allBodyTypes.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );

  const definition = allBodyTypes.map(({ value }) => value).join(' | ');

  const implementation =
    generalJSTypesWithArray.includes(definition.toLowerCase()) ||
    allBodyTypes.length > 1
      ? camel(operationId) + 'Body'
      : camel(definition);
  const formData =
    allBodyTypes.length === 1 ? allBodyTypes[0].formData : undefined;

  return {
    definition,
    implementation,
    imports,
    schemas,
    formData: formData || '',
  };
};
