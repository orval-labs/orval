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
import { generateSchemaFormDataAndUrlEncoded } from '../generators/formData';
import { resolveObject } from '../resolvers/object';
import { resolveRef } from '../resolvers/ref';

const formDataContentTypes = ['multipart/form-data'];

const formUrlEncodedContentTypes = ['application/x-www-form-urlencoded'];

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

          const isFormData = formDataContentTypes.includes(contentType);
          const isFormUrlEncoded =
            formUrlEncodedContentTypes.includes(contentType);

          if ((!isFormData && !isFormUrlEncoded) || !mediaType?.schema) {
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
                contentType,
              },
            ] as ResReqTypesValue[];
          }

          const formData = isFormData
            ? await generateSchemaFormDataAndUrlEncoded(
                name,
                mediaType?.schema,
                {
                  ...context,
                  specKey: specKey || context.specKey,
                },
              )
            : undefined;

          const formUrlEncoded = isFormUrlEncoded
            ? await generateSchemaFormDataAndUrlEncoded(
                name,
                mediaType?.schema,
                {
                  ...context,
                  specKey: specKey || context.specKey,
                },
                true,
              )
            : undefined;

          return [
            {
              value: name,
              imports: [{ name, specKey, schemaName }],
              schemas: [],
              type: 'unknown',
              isEnum: false,
              formData,
              formUrlEncoded,
              isRef: true,
              originalSchema: mediaType?.schema,
              key,
              contentType,
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

                if (!resolvedValue) {
                  return;
                }

                const isFormData = formDataContentTypes.includes(contentType);
                const isFormUrlEncoded =
                  formUrlEncodedContentTypes.includes(contentType);

                if ((!isFormData && !isFormUrlEncoded) || !propName) {
                  return { ...resolvedValue, contentType };
                }

                const formData = isFormData
                  ? await generateSchemaFormDataAndUrlEncoded(
                      propName,
                      mediaType.schema!,
                      context,
                    )
                  : undefined;

                const formUrlEncoded = isFormUrlEncoded
                  ? await generateSchemaFormDataAndUrlEncoded(
                      propName,
                      mediaType.schema!,
                      context,
                      true,
                    )
                  : undefined;

                return {
                  ...resolvedValue,
                  formData,
                  formUrlEncoded,
                  contentType,
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
            contentType: 'application/json',
          },
        ] as ResReqTypesValue[];
      }),
  );

  return uniqBy(
    typesArray.reduce<ResReqTypesValue[]>((acc, it) => {
      acc.push(...it);

      return acc;
    }, []),
    'value',
  );
};
