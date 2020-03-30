import uniq from 'lodash/uniq';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { resolveValue } from '../resolvers/value';
import { getRef } from './ref';

const CONTENT_TYPES = [
  'application/json',
  'application/octet-stream',
  'application/pdf',
  'multipart/form-data',
];

const getResReqContentTypes = (type: string, mediaType: MediaTypeObject) => {
  if (!CONTENT_TYPES.includes(type) || !mediaType.schema) {
    return {
      value: 'unknown',
      imports: [],
      schemas: [],
      type: 'unknow',
      isEnum: false,
    };
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
  >,
): Array<ResolverValue> =>
  uniq(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(([_, res]) => {
        if (isReference(res)) {
          const value = getRef(res.$ref);
          return {
            value,
            imports: [value],
            schemas: [],
            type: 'ref',
            isEnum: false,
          };
        } else {
          return res.content
            ? Object.entries(res.content).map(([type, mediaType]) =>
                getResReqContentTypes(type, mediaType),
              )
            : {
                value: 'unknown',
                imports: [],
                schemas: [],
                type: 'unknow',
                isEnum: false,
              };
        }
      })
      .reduce<Array<ResolverValue>>((acc, it) => {
        if (Array.isArray(it)) {
          return [...acc, ...it];
        }
        return [...acc, it];
      }, []),
  );
