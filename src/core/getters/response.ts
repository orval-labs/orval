import { ResponsesObject } from 'openapi3-ts';
import { ContextSpecs, OverrideOutputContentType } from '../../types';
import { GetterResponse } from '../../types/getters';
import { ResReqTypesValue } from '../../types/resolvers';
import { getResReqTypes } from './resReqTypes';

export const getResponse = ({
  responses,
  operationName,
  context,
  contentType,
}: {
  responses: ResponsesObject;
  operationName: string;
  context: ContextSpecs;
  contentType?: OverrideOutputContentType;
}): GetterResponse => {
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

  const types = getResReqTypes(
    Object.entries(responses),
    operationName,
    context,
    'void',
  );

  const filteredTypes = contentType
    ? types.filter((type) => {
        let include = true;
        let exclude = false;

        if (contentType.include) {
          include = contentType.include.includes(type.contentType);
        }

        if (contentType.exclude) {
          exclude = contentType.exclude.includes(type.contentType);
        }

        return include && !exclude;
      })
    : types;

  const groupedByStatus = filteredTypes.reduce<{
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

  const imports = filteredTypes.flatMap(({ imports }) => imports);
  const schemas = filteredTypes.flatMap(({ schemas }) => schemas);

  const contentTypes = [
    ...new Set(filteredTypes.map(({ contentType }) => contentType)),
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
