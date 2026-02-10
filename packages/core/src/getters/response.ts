import type {
  ContextSpec,
  GetterResponse,
  OpenApiResponsesObject,
  OverrideOutputContentType,
  ResReqTypesValue,
} from '../types';
import { dedupeUnionType, filterByContentType } from '../utils';
import { getResReqTypes } from './res-req-types';

interface GetResponseOptions {
  responses: OpenApiResponsesObject;
  operationName: string;
  context: ContextSpec;
  contentType?: OverrideOutputContentType;
}

export function getResponse({
  responses,
  operationName,
  context,
  contentType,
}: GetResponseOptions): GetterResponse {
  const types = getResReqTypes(
    Object.entries(responses),
    operationName,
    context,
    'void',
    (type) => `${type.key}-${type.value}`,
  );

  const filteredTypes = filterByContentType(types, contentType);

  const imports = filteredTypes.flatMap(({ imports }) => imports);
  const schemas = filteredTypes.flatMap(({ schemas }) => schemas);

  const contentTypes = [
    ...new Set(filteredTypes.map(({ contentType }) => contentType)),
  ];

  const groupedByStatus: {
    success: ResReqTypesValue[];
    errors: ResReqTypesValue[];
  } = { success: [], errors: [] };
  for (const type of filteredTypes) {
    if (type.key.startsWith('2')) {
      groupedByStatus.success.push(type);
    } else {
      groupedByStatus.errors.push(type);
    }
  }

  const success = dedupeUnionType(
    groupedByStatus.success
      .map(({ value, formData }) => (formData ? 'Blob' : value))
      .join(' | '),
  );
  const errors = dedupeUnionType(
    groupedByStatus.errors.map(({ value }) => value).join(' | '),
  );

  const defaultType = filteredTypes.find(({ key }) => key === 'default')?.value;

  return {
    imports,
    definition: {
      success: success || (defaultType ?? 'unknown'),
      errors: errors || (defaultType ?? 'unknown'),
    },
    isBlob: success === 'Blob',
    types: groupedByStatus,
    contentTypes,
    schemas,
    originalSchema: responses,
  };
}
