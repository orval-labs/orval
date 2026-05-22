import type { QueryKey } from '@tanstack/react-query';

const OPERATION_KEY_PREFIX = 'operation';

export function customQueryOptionsWithOperation<
  T extends { queryKey: QueryKey },
>(
  options: T,
  // The 2nd arg is the queryProperties dictionary (params / petId / etc.),
  // which varies per operation — type it as a broad record so a single
  // mutator can handle every endpoint.
  _queryProperties: Record<string, unknown>,
  operation: { url: string; operationId: string; operationName: string },
): T {
  return {
    ...options,
    queryKey: [
      OPERATION_KEY_PREFIX,
      operation.operationId,
      operation.operationName,
      operation.url,
      ...options.queryKey,
    ],
  };
}
