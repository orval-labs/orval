import uniq from 'lodash/uniq';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { resolveObject } from '../resolvers/object';
import { getRef } from './ref';

const CONTENT_TYPES = [
  'application/json',
  'application/octet-stream',
  'application/pdf',
  'multipart/form-data',
];

const getResReqContentTypes = (
  type: string,
  mediaType: MediaTypeObject,
  propName?: string,
) => {
  if (!CONTENT_TYPES.includes(type) || !mediaType.schema) {
    return {
      value: 'unknown',
      imports: [],
      schemas: [],
      type: 'unknow',
      isEnum: false,
    };
  }

  return resolveObject({ schema: mediaType.schema, propName });
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
  name: string,
): Array<ResolverValue> =>
  uniq(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(([key, res]) => {
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
                getResReqContentTypes(
                  type,
                  mediaType,
                  key ? pascal(name) + pascal(key) : undefined,
                ),
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
