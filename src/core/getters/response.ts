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
      contentTypes: [],
    };
  }

  const types = await getResReqTypes(
    Object.entries(responses),
    operationId,
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

  const imports = types.reduce<GeneratorImport[]>((acc, { imports = [] }) => {
    acc.push(...imports);

    return acc;
  }, []);

  const schemas = types.reduce<GeneratorSchema[]>((acc, { schemas = [] }) => {
    acc.push(...schemas);

    return acc;
  }, []);

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
