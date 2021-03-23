import { uniqBy } from 'lodash';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';
import { getRef } from './ref';

const getResReqContentTypes = ({
  mediaType,
  propName,
}: {
  mediaType: MediaTypeObject;
  propName?: string;
}) => {
  if (!mediaType.schema) {
    return undefined;
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
): ResolverValue[] => {
  const typesArray = responsesOrRequests
    .filter(([_, res]) => Boolean(res))
    .map(([key, res]) => {
      if (isReference(res)) {
        const value = getRef(res.$ref);
        return [
          {
            value,
            imports: [value],
            schemas: [],
            type: 'ref',
            isEnum: false,
          },
        ];
      }

      if (res.content) {
        return Object.entries(res.content)
          .map(([, mediaType], index, arr) => {
            let propName = key ? pascal(name) + pascal(key) : undefined;

            if (propName && arr.length > 1) {
              propName = propName + pascal(getNumberWord(index + 1));
            }

            return getResReqContentTypes({
              mediaType,
              propName,
            });
          })
          .filter((x) => x) as ResolverValue[];
      }

      return [
        {
          value: 'unknown',
          imports: [],
          schemas: [],
          type: 'unknow',
          isEnum: false,
        },
      ];
    });

  return uniqBy(
    typesArray.reduce<ResolverValue[]>((acc, it) => [...acc, ...it], []),
    'value',
  );
};
