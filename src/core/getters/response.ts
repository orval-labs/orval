import { ReferenceObject, ResponseObject, ResponsesObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport, GeneratorSchema } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { getResReqTypes } from './resReqTypes';

const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
  statusCode.toString().startsWith('2');

export const getResponse = async (
  responses: ResponsesObject,
  operationId: string,
  context: ContextSpecs,
): Promise<GetterResponse> => {
  if (!responses) {
    return {
      imports: [],
      definition: '',
      isBlob: false,
      types: [],
      schemas: [],
    };
  }

  const types = await getResReqTypes(
    Object.entries(responses).filter(isOk),
    operationId,
    context,
  );

  const imports = types.reduce<GeneratorImport[]>(
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
    definition: definition || 'unknown',
    isBlob: definition === 'Blob',
    types,
    schemas,
  };
};
