import { ReferenceObject, ResponseObject, ResponsesObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { getResReqTypes } from './resReqTypes';

const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
  statusCode.toString().startsWith('2');

export const getResponse = (
  responses: ResponsesObject,
  operationId: string,
  override: OverrideOutput = {},
): GetterResponse => {
  const types = responses
    ? getResReqTypes(
        Object.entries(responses).filter(isOk),
        operationId,
        override,
      )
    : [
        {
          value: 'unknown',
          imports: [],
          schemas: [],
          type: 'unknow',
          isEnum: false,
        },
      ];

  const imports = types.reduce<string[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const schemas = types.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );

  const definition = types.map(({ value }) => value).join(' | ');

  return {
    imports,
    definition,
    isBlob: definition === 'Blob',
    types,
    schemas,
  };
};
