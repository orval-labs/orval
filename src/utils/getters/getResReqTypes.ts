import uniq from 'lodash/uniq';
import {ReferenceObject, RequestBodyObject, ResponseObject} from 'openapi3-ts';
import {isReference} from '../isReference';
import {resolveValue} from '../resolvers/resolveValue';
import {getRef} from './getRef';

/**
 * Extract responses / request types from open-api specs
 *
 * @param responsesOrRequests reponses or requests object from open-api specs
 */
export const getResReqTypes = (
  responsesOrRequests: Array<
    [string, ResponseObject | ReferenceObject | RequestBodyObject]
  >
): Array<{
  value: string;
  isEnum?: boolean;
  type?: string;
  imports?: string[];
}> =>
  uniq(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(([_, res]) => {
        if (isReference(res)) {
          const value = getRef(res.$ref);
          return {value, imports: [value]};
        } else {
          if (res.content?.['application/json']) {
            const schema = res.content['application/json'].schema!;
            return resolveValue(schema);
          } else if (res.content?.['application/octet-stream']) {
            const schema = res.content['application/octet-stream'].schema!;
            return resolveValue(schema);
          } else if (res.content?.['application/pdf']) {
            const schema = res.content['application/pdf'].schema!;
            return resolveValue(schema);
          } else if (res.content?.['multipart/form-data']) {
            const schema = res.content['multipart/form-data'].schema!;
            return resolveValue(schema);
          }
          return {value: 'unknown'};
        }
      })
  );
