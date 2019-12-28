import uniq from 'lodash/uniq';
import { ReferenceObject, RequestBodyObject, ResponseObject } from 'openapi3-ts';
import { isReference } from '../isReference';
import { resolveValue } from '../resolvers/resolveValue';
import { getRef } from './getRef';

/**
 * Extract responses / request types from open-api specs
 *
 * @param responsesOrRequests reponses or requests object from open-api specs
 */
export const getResReqTypes = (
  responsesOrRequests: Array<[string, ResponseObject | ReferenceObject | RequestBodyObject]>,
) =>
  uniq(
    responsesOrRequests.map(([_, res]) => {
      if (!res) {
        return;
      }

      if (isReference(res)) {
        return getRef(res.$ref);
      } else {
        if (res.content && res.content['application/json']) {
          const schema = res.content['application/json'].schema!;
          return resolveValue(schema).value;
        } else if (res.content && res.content['application/octet-stream']) {
          const schema = res.content['application/octet-stream'].schema!;
          return resolveValue(schema).value;
        } else if (res.content && res.content['application/pdf']) {
          const schema = res.content['application/pdf'].schema!;
          return resolveValue(schema).value;
        }
        return 'unknown';
      }
    }),
  ).join(' | ');
