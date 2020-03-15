import uniq from 'lodash/uniq';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject
} from 'openapi3-ts';
import {resolveValue} from '../resolvers/resolveValue';
import {getRef} from './getRef';
import { isReference } from '../../utils/is';

const CONTENT_TYPES = [
  'application/json',
  'application/octet-stream',
  'application/pdf',
  'multipart/form-data'
];

const getResReqContentTypes = (type: string, mediaType: MediaTypeObject) => {
  if (!CONTENT_TYPES.includes(type) || !mediaType.schema) {
    return {value: 'unknown'};
  }

  return resolveValue(mediaType.schema);
};

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
          return res.content
            ? Object.entries(res.content).map(([type, mediaType]) =>
                getResReqContentTypes(type, mediaType)
              )
            : {value: 'unknown'};
        }
      })
      .reduce<
        Array<{
          value: string;
          isEnum?: boolean;
          type?: string;
          imports?: string[];
        }>
      >((acc, it) => {
        if (Array.isArray(it)) {
          return [...acc, ...it];
        }
        return [...acc, it];
      }, [])
  );
