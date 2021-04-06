import { uniqBy } from 'lodash';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { getNumberWord } from '../../utils/string';
import { resolveObject } from '../resolvers/object';
import { getRefInfo } from './ref';

const getResReqContentTypes = ({
  mediaType,
  propName,
  context,
}: {
  mediaType: MediaTypeObject;
  propName?: string;
  context: ContextSpecs;
}) => {
  if (!mediaType.schema) {
    return undefined;
  }

  return resolveObject({ schema: mediaType.schema, propName, context });
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
  context: ContextSpecs,
): Promise<ResolverValue[]> => {
  const typesArray = await Promise.all(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(async ([key, res]) => {
        if (isReference(res)) {
          const { name, specKey } = await getRefInfo(res.$ref, context);
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
          const contents = await Promise.all(
            Object.entries(res.content).map(([, mediaType], index, arr) => {
              let propName = key ? pascal(name) + pascal(key) : undefined;

              if (propName && arr.length > 1) {
                propName = propName + pascal(getNumberWord(index + 1));
              }

              return getResReqContentTypes({
                mediaType,
                propName,
                context,
              });
            }),
          );

          return contents.filter((x) => x) as ResolverValue[];
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
