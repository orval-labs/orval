import { type OpenApiOperationObject, Verbs } from '../types';
import { isString, pascal, sanitize } from '../utils';

export function getOperationId(
  operation: OpenApiOperationObject,
  route: string,
  verb: Verbs,
): string {
  if (isString(operation.operationId)) {
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
}
