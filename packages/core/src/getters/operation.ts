import { type OpenApiOperationObject, Verbs } from '../types';
import { pascal, sanitize } from '../utils';

export function getOperationId(
  operation: OpenApiOperationObject,
  route: string,
  verb: Verbs,
): string {
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
}
