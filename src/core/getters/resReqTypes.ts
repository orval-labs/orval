import { uniqBy } from 'lodash';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue, ResReqTypesValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { getNumberWord } from '../../utils/string';
import { generateSchemaFormData } from '../generators/formData';
import { resolveObject } from '../resolvers/object';
import { resolveRef } from '../resolvers/ref';

const formDataContentTypes = ['multipart/form-data'];

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

export const getResReqTypes = async (
  responsesOrRequests: Array<
    [string, ResponseObject | ReferenceObject | RequestBodyObject]
  >,
  name: string,
  context: ContextSpecs,
): Promise<ResReqTypesValue[]> => {
  const typesArray = await Promise.all(
    responsesOrRequests
      .filter(([_, res]) => Boolean(res))
      .map(async ([key, res]) => {
        if (isReference(res)) {
          const {
            schema: bodySchema,
            imports: [{ name, specKey, schemaName }],
          } = await resolveRef<RequestBodyObject | ResponseObject>(
            res,
            context,
          );

          const [contentType, mediaType] =
            Object.entries(bodySchema.content || {})[0] || [];

          if (
            !formDataContentTypes.includes(contentType) ||
            !mediaType?.schema
          ) {
            return [
              {
                value: name,
                imports: [{ name, specKey, schemaName }],
                schemas: [],
                type: 'unknown',
                isEnum: false,
                isRef: true,
              },
            ] as ResReqTypesValue[];
          }

          const formData = await generateSchemaFormData(
            name,
            mediaType?.schema,
            {
              ...context,
              specKey: specKey || context.specKey,
            },
          );

          return [
            {
              value: name,
              imports: [{ name, specKey, schemaName }],
              schemas: [],
              type: 'unknown',
              isEnum: false,
              formData,
              isRef: true,
            },
          ] as ResReqTypesValue[];
        }

        if (res.content) {
          const contents = await Promise.all(
            Object.entries(res.content).map(
              async ([contentType, mediaType], index, arr) => {
                let propName = key ? pascal(name) + pascal(key) : undefined;

                if (propName && arr.length > 1) {
                  propName = propName + pascal(getNumberWord(index + 1));
                }

                const resolvedValue = await getResReqContentTypes({
                  mediaType,
                  propName,
                  context,
                });

                if (
                  !resolvedValue ||
                  !formDataContentTypes.includes(contentType) ||
                  !propName
                ) {
                  return resolvedValue;
                }

                const formData = await generateSchemaFormData(
                  propName,
                  mediaType.schema!,
                  context,
                );
                return {
                  ...resolvedValue,
                  formData,
                } as ResReqTypesValue;
              },
            ),
          );

          return contents.filter((x) => x) as ResReqTypesValue[];
        }

        return [
          {
            value: 'unknown',
            imports: [],
            schemas: [],
            type: 'unknown',
            isEnum: false,
          },
        ] as ResReqTypesValue[];
      }),
  );

  return uniqBy(
    typesArray.reduce<ResolverValue[]>((acc, it) => [...acc, ...it], []),
    'value',
  );
};
