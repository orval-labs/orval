import { uniqBy } from 'lodash';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { InputTarget } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';
import { getRefInfo } from './ref';

const CONTENT_TYPES = [
  'application/json',
  'application/octet-stream',
  'application/pdf',
  'multipart/form-data',
];

const getResReqContentTypes = ({
  type,
  mediaType,
  propName,
  target,
}: {
  type: string;
  mediaType: MediaTypeObject;
  propName?: string;
  target: InputTarget;
}) => {
  if (!CONTENT_TYPES.includes(type) || !mediaType.schema) {
    return {
      value: 'unknown',
      imports: [],
      schemas: [],
      type: 'unknow',
      isEnum: false,
    };
  }

  return resolveObject({ schema: mediaType.schema, propName, target });
};

/**
 * Extract responses / request types from open-api specs
 *
 * @param responsesOrRequests reponses or requests object from open-api specs
 */
export const getResReqTypes = async (
  responsesOrRequests: Array<
    [string, ResponseObject | ReferenceObject | RequestBodyObject]
  >,
  name: string,
  target: InputTarget,
): Promise<Array<ResolverValue>> => {
  const typesArray = await Promise.all(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(async ([key, res]) => {
        if (isReference(res)) {
          const { name, specKey } = await getRefInfo(res.$ref, target);
          return [
            {
              value: name,
              imports: [{ name, specKey }],
              schemas: [],
              type: 'ref',
              isEnum: false,
            },
          ] as ResolverValue[];
        }

        if (res.content) {
          return Promise.all(
            Object.entries(res.content).map(([type, mediaType], index, arr) => {
              let propName = key ? pascal(name) + pascal(key) : undefined;

              if (propName && arr.length > 1) {
                propName = propName + pascal(getNumberWord(index + 1));
              }

              return getResReqContentTypes({
                type,
                mediaType,
                propName,
                target,
              });
            }),
          );
        }

        return [
          {
            value: 'unknown',
            imports: [],
            schemas: [],
            type: 'unknow',
            isEnum: false,
          },
        ] as ResolverValue[];
      }),
  );

  return uniqBy(
    typesArray.reduce<ResolverValue[]>((acc, it) => [...acc, ...it], []),
    'value',
  );
};
