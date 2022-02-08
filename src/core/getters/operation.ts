import { Verbs } from '../../types';
import { pascal } from '../../utils/case';
import { sanitize } from '../../utils/string';

export const getOperationId = (route: string, verb: Verbs): string => {
  return pascal([verb, ...route.split('/').map((p) => sanitize(p))].join('-'));
};
