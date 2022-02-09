import { ResponsesObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GetterResponse } from '../../types/getters';
import { ResReqTypesValue } from '../../types/resolvers';
import { getResReqTypes } from './resReqTypes';

export const getResponse = async (
  responses: ResponsesObject,
  operationName: string,
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
      contentTypes: [],
    };
  }

  const types = await getResReqTypes(
    Object.entries(responses),
    operationName,
    context,
    'void',
  );

  const groupedByStatus = types.reduce<{
    success: ResReqTypesValue[];
    errors: ResReqTypesValue[];
  }>(
    (acc, type) => {
      if (type.key.startsWith('2')) {
        acc.success.push(type);
      } else {
        acc.errors.push(type);
      }
      return acc;
    },
    { success: [], errors: [] },
  );

  const imports = types.flatMap(({ imports }) => imports);
  const schemas = types.flatMap(({ schemas }) => schemas);

  const contentTypes = [
    ...new Set(types.map(({ contentType }) => contentType)),
  ];

  const success = groupedByStatus.success
    .map(({ value, formData }) => (formData ? 'Blob' : value))
    .join(' | ');
  const errors = groupedByStatus.errors.map(({ value }) => value).join(' | ');

  return {
    imports,
    definition: {
      success: success || 'unknown',
      errors: errors || 'unknown',
    },
    isBlob: success === 'Blob',
    types: groupedByStatus,
    contentTypes,
    schemas,
  };
};
