import { OperationObject } from 'openapi3-ts';
import { Verbs } from '../../types';
import { pascal } from '../../utils/case';
import { sanitize } from '../../utils/string';

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
