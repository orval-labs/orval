import uniqBy from 'lodash.uniqby';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
} from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResReqTypesValue } from '../../types/resolvers';
import { pascal } from '../../utils/case';
import { isReference } from '../../utils/is';
import { getNumberWord } from '../../utils/string';
import { generateSchemaFormData } from '../generators/formData';
import { resolveObject } from '../resolvers/object';
import { resolveRef } from '../resolvers/ref';

const formDataContentTypes = ['multipart/form-data'];

const getResReqContentTypes = async ({
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

  const resolvedObject = await resolveObject({
    schema: mediaType.schema,
    propName,
    context,
  });

  return resolvedObject;
};

export const getResReqTypes = async (
  responsesOrRequests: Array<
    [string, ResponseObject | ReferenceObject | RequestBodyObject]
  >,
  name: string,
  context: ContextSpecs,
  defaultType = 'unknown',
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
                originalSchema: mediaType?.schema,
                key,
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
              originalSchema: mediaType?.schema,
              key,
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
                };
              },
            ),
          );

          return contents
            .filter((x) => x)
            .map((x) => ({ ...x, key })) as ResReqTypesValue[];
        }

        return [
          {
            value: defaultType,
            imports: [],
            schemas: [],
            type: defaultType,
            isEnum: false,
            key,
            isRef: false,
          },
        ] as ResReqTypesValue[];
      }),
  );

  return uniqBy(
    typesArray.reduce<ResReqTypesValue[]>((acc, it) => [...acc, ...it], []),
    'value',
  );
};
