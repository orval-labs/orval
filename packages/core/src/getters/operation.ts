import { OperationObject } from 'openapi3-ts/oas30';
import { Verbs } from '../types';
import { pascal, sanitize } from '../utils';

export const getOperationId = (
  operation: OperationObject,
  route: string,
  verb: Verbs,
): string => {
  if (operation.operationId) {
    return operation.operationId;
  }

  return pascal(
    [
      verb,
      ...route.split('/').map((p) =>
        sanitize(p, {
          dash: true,
          underscore: '-',
          dot: '-',
          whitespace: '-',
        }),
      ),
    ].join('-'),
  );
};
