import { pascal } from 'case';
import { ReferenceObject, ResponseObject, ResponsesObject } from 'openapi3-ts';
import { GetterResponse } from '../../types/getters';
import { getResReqTypes } from './resReqTypes';

const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
  statusCode.toString().startsWith('2');

export const getResponse = (
  responses: ResponsesObject,
  operationId: string,
): GetterResponse => {
  const types = getResReqTypes(Object.entries(responses).filter(isOk));

  const imports = types.reduce<string[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );

  const definition = types.map(({ value }) => value).join(' | ');

  const isSchema = definition.includes('{');

  return {
    imports,
    definition: isSchema ? `${pascal(operationId)}Response` : definition,
    isBlob: definition === 'Blob',
    types,
  };
};
