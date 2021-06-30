import { ResponsesObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport, GeneratorSchema } from '../../types/generator';
import { GetterResponse } from '../../types/getters';
import { ResReqTypesValue } from '../../types/resolvers';
import { getResReqTypes } from './resReqTypes';

export const getResponse = async (
  responses: ResponsesObject,
  operationId: string,
  context: ContextSpecs,
): Promise<GetterResponse> => {
  if (!responses) {
    return {
      imports: [],
      definition: {
        success: '',
        errors: '',
      },
      isBlob: false,
      types: { success: [], errors: [] },
      schemas: [],
    };
  }

  const types = await getResReqTypes(
    Object.entries(responses),
    operationId,
    context,
  );

  const groupedByStatus = types.reduce<{
    success: ResReqTypesValue[];
    errors: ResReqTypesValue[];
  }>(
    (acc, type) =>
      type.key.startsWith('2')
        ? { ...acc, success: [...acc.success, type] }
        : { ...acc, errors: [...acc.errors, type] },
    { success: [], errors: [] },
  );

  const imports = types.reduce<GeneratorImport[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );

  const schemas = types.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );

  const success = groupedByStatus.success.map(({ value }) => value).join(' | ');
  const errors = groupedByStatus.errors.map(({ value }) => value).join(' | ');

  return {
    imports,
    definition: {
      success: success || 'unknown',
      errors: errors || 'unknown',
    },
    isBlob: success === 'Blob',
    types: groupedByStatus,
    schemas,
  };
};
