import { ReferenceObject, RequestBodyObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { OverrideOutput } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { GetterBody } from '../../types/getters';
import { camel } from '../../utils/case';
import { getResReqTypes } from './resReqTypes';

export const getBody = (
  requestBody: ReferenceObject | RequestBodyObject,
  operationId: string,
  override: OverrideOutput = {},
): GetterBody => {
  const allBodyTypes = getResReqTypes(
    [['body', requestBody]],
    operationId,
    override,
  );
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
