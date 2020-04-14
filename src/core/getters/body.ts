import { camel } from 'case';
import { ReferenceObject, RequestBodyObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { GeneratorSchema } from '../../types/generator';
import { GetterBody } from '../../types/getters';
import { getResReqTypes } from './resReqTypes';

export const getBody = (
  requestBody: ReferenceObject | RequestBodyObject,
  operationId: string,
): GetterBody => {
  const allBodyTypes = getResReqTypes([['body', requestBody]], operationId);
  const imports = allBodyTypes.reduce<string[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const schemas = allBodyTypes.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );

  const definition = allBodyTypes.map(({ value }) => value).join(' | ');
  const implementation =
    generalJSTypesWithArray.includes(definition) || allBodyTypes.length > 1
      ? 'payload'
      : camel(definition);

  return {
    definition,
    implementation,
    imports,
    isBlob: definition === 'Blob',
    schemas,
  };
};
