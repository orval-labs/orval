import { keyword } from 'esutils';
import uniqBy from 'lodash.uniqby';
import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import { resolveObject } from '../resolvers/object';
import { resolveRef } from '../resolvers/ref';
import { ContextSpecs, ResReqTypesValue } from '../types';
import { camel } from '../utils';
import { isReference } from '../utils/assertion';
import { pascal } from '../utils/case';
import { getNumberWord } from '../utils/string';

const formDataContentTypes = ['multipart/form-data'];

const formUrlEncodedContentTypes = ['application/x-www-form-urlencoded'];

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

  const resolvedObject = resolveObject({
    schema: mediaType.schema,
    propName,
    context,
  });

  return resolvedObject;
};

export const getResReqTypes = (
  responsesOrRequests: Array<
    [string, ResponseObject | ReferenceObject | RequestBodyObject]
  >,
  name: string,
  context: ContextSpecs,
  defaultType = 'unknown',
): ResReqTypesValue[] => {
  const typesArray = responsesOrRequests
    .filter(([_, res]) => Boolean(res))
    .map(([key, res]) => {
      if (isReference(res)) {
        const {
          schema: bodySchema,
          imports: [{ name, specKey, schemaName }],
        } = resolveRef<RequestBodyObject | ResponseObject>(res, context);

        const [contentType, mediaType] =
          Object.entries(bodySchema.content ?? {})[0] ?? [];

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
              hasReadonlyProps: false,
              originalSchema: mediaType?.schema,
              key,
              contentType,
            },
          ] as ResReqTypesValue[];
        }

        const formData = isFormData
          ? getSchemaFormDataAndUrlEncoded({
              name,
              schemaObject: mediaType?.schema,
              context: {
                ...context,
                specKey: specKey || context.specKey,
              },
              isRef: true,
            })
          : undefined;

        const formUrlEncoded = isFormUrlEncoded
          ? getSchemaFormDataAndUrlEncoded({
              name,
              schemaObject: mediaType?.schema,
              context: {
                ...context,
                specKey: specKey || context.specKey,
              },
              isUrlEncoded: true,
              isRef: true,
            })
          : undefined;

        return [
          {
            value: name,
            imports: [{ name, specKey, schemaName }],
            schemas: [],
            type: 'unknown',
            isEnum: false,
            hasReadonlyProps: false,
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
        const contents = Object.entries(res.content).map(
          ([contentType, mediaType], index, arr) => {
            let propName = key ? pascal(name) + pascal(key) : undefined;

            if (propName && arr.length > 1) {
              propName = propName + pascal(getNumberWord(index + 1));
            }

            const resolvedValue = getResReqContentTypes({
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

            const imports = [
              ...resolvedValue.imports,
              ...(resolvedValue.hasReadonlyProps
                ? [{ name: 'NonReadonly' }]
                : []),
            ];

            if ((!isFormData && !isFormUrlEncoded) || !propName) {
              return {
                ...resolvedValue,
                imports,
                contentType,
              };
            }

            const formData = isFormData
              ? getSchemaFormDataAndUrlEncoded({
                  name: propName,
                  schemaObject: mediaType.schema!,
                  context,
                })
              : undefined;

            const formUrlEncoded = isFormUrlEncoded
              ? getSchemaFormDataAndUrlEncoded({
                  name: propName,
                  schemaObject: mediaType.schema!,
                  context,
                  isUrlEncoded: true,
                })
              : undefined;

            return {
              ...resolvedValue,
              imports,
              formData,
              formUrlEncoded,
              contentType,
            };
          },
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
          hasReadonlyProps: false,
          contentType: 'application/json',
        },
      ] as ResReqTypesValue[];
    });

  return uniqBy(
    typesArray.flatMap((it) => it),
    'value',
  );
};

const getSchemaFormDataAndUrlEncoded = ({
  name,
  schemaObject,
  context,
  isUrlEncoded,
  isRef,
}: {
  name: string;
  schemaObject: SchemaObject | ReferenceObject;
  context: ContextSpecs;
  isUrlEncoded?: boolean;
  isRef?: boolean;
}) => {
  const { schema, imports } = resolveRef<SchemaObject>(schemaObject, context);
  const propName = camel(
    !isRef && isReference(schemaObject) ? imports[0].name : name,
  );

  const variableName = isUrlEncoded ? 'formUrlEncoded' : 'formData';
  const form = isUrlEncoded
    ? `const ${variableName} = new URLSearchParams();\n`
    : `const ${variableName} = new FormData();\n`;

  if (schema.type === 'object' && schema.properties) {
    const formDataValues = Object.entries(schema.properties).reduce(
      (acc, [key, value]) => {
        const { schema: property } = resolveRef<SchemaObject>(value, context);

        let formDataValue = '';

        const formatedKey = !keyword.isIdentifierNameES5(key)
          ? `['${key}']`
          : `.${key}`;

        if (property.type === 'object') {
          formDataValue = `${variableName}.append('${key}', JSON.stringify(${propName}${formatedKey}));\n`;
        } else if (property.type === 'array') {
          formDataValue = `${propName}${formatedKey}.forEach(value => ${variableName}.append('${key}', value));\n`;
        } else if (
          property.type === 'number' ||
          property.type === 'integer' ||
          property.type === 'boolean'
        ) {
          formDataValue = `${variableName}.append('${key}', ${propName}${formatedKey}.toString())\n`;
        } else {
          formDataValue = `${variableName}.append('${key}', ${propName}${formatedKey})\n`;
        }

        const isRequired = schema.required?.includes(key);

        if (property.nullable) {
          if (isRequired) {
            return (
              acc +
              `if(${propName}${formatedKey} !== null) {\n ${formDataValue} }\n`
            );
          }

          return (
            acc +
            `if(${propName}${formatedKey} !== undefined && ${propName}${formatedKey} !== null) {\n ${formDataValue} }\n`
          );
        }

        if (isRequired) {
          return acc + formDataValue;
        }

        return (
          acc +
          `if(${propName}${formatedKey} !== undefined) {\n ${formDataValue} }\n`
        );
      },
      '',
    );

    return `${form}${formDataValues}`;
  }

  if (schema.type === 'array') {
    return `${form}${propName}.forEach(value => ${variableName}.append('data', value))\n`;
  }

  if (schema.type === 'number' || schema.type === 'boolean') {
    return `${form}${variableName}.append('data', ${propName}.toString())\n`;
  }

  return `${form}${variableName}.append('data', ${propName})\n`;
};
