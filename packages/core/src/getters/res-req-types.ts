import { keyword } from 'esutils';
import type { ValueIteratee } from 'lodash';
import uniqBy from 'lodash.uniqby';

import {
  MediaTypeObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts/oas30';
import { resolveObject } from '../resolvers/object';
import { resolveExampleRefs, resolveRef } from '../resolvers/ref';
import {
  ContextSpecs,
  FormDataArrayHandling,
  GeneratorImport,
  ResReqTypesValue,
} from '../types';
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
  uniqueKey: ValueIteratee<ResReqTypesValue> = 'value',
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
              example: mediaType?.example,
              examples: resolveExampleRefs(mediaType?.examples, context),
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
              isRequestBodyOptional:
                // Even though required is false by default, we only consider required to be false if specified. (See pull 1277)
                'required' in bodySchema && bodySchema.required === false,
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
              isRequestBodyOptional:
                'required' in bodySchema && bodySchema.required === false,
              isUrlEncoded: true,
              isRef: true,
            })
          : undefined;

        const additionalImports = getFormDataAdditionalImports({
          schemaObject: mediaType?.schema,
          context: {
            ...context,
            specKey: specKey || context.specKey,
          },
        });

        return [
          {
            value: name,
            imports: [{ name, specKey, schemaName }, ...additionalImports],
            schemas: [],
            type: 'unknown',
            isEnum: false,
            hasReadonlyProps: false,
            formData,
            formUrlEncoded,
            isRef: true,
            originalSchema: mediaType?.schema,
            example: mediaType.example,
            examples: resolveExampleRefs(mediaType.examples, context),
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

            if ((!isFormData && !isFormUrlEncoded) || !propName) {
              return {
                ...resolvedValue,
                imports: resolvedValue.imports,
                contentType,
                example: mediaType.example,
                examples: resolveExampleRefs(mediaType.examples, context),
              };
            }

            const formData = isFormData
              ? getSchemaFormDataAndUrlEncoded({
                  name: propName,
                  schemaObject: mediaType.schema!,
                  context,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                })
              : undefined;

            const formUrlEncoded = isFormUrlEncoded
              ? getSchemaFormDataAndUrlEncoded({
                  name: propName,
                  schemaObject: mediaType.schema!,
                  context,
                  isUrlEncoded: true,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                })
              : undefined;

            const additionalImports = getFormDataAdditionalImports({
              schemaObject: mediaType.schema!,
              context,
            });
            return {
              ...resolvedValue,
              imports: [...resolvedValue.imports, ...additionalImports],
              formData,
              formUrlEncoded,
              contentType,
              example: mediaType.example,
              examples: resolveExampleRefs(mediaType.examples, context),
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
    uniqueKey,
  );
};

const getFormDataAdditionalImports = ({
  schemaObject,
  context,
}: {
  schemaObject: SchemaObject | ReferenceObject;
  context: ContextSpecs;
}): GeneratorImport[] => {
  const { schema } = resolveRef<SchemaObject>(schemaObject, context);

  if (schema.type !== 'object') {
    return [];
  }

  const combinedSchemas = schema.oneOf || schema.anyOf;

  if (!combinedSchemas) {
    return [];
  }

  return combinedSchemas
    .map((schema) => resolveRef<SchemaObject>(schema, context).imports[0])
    .filter(Boolean);
};

const getSchemaFormDataAndUrlEncoded = ({
  name,
  schemaObject,
  context,
  isRequestBodyOptional,
  isUrlEncoded,
  isRef,
}: {
  name: string;
  schemaObject: SchemaObject | ReferenceObject;
  context: ContextSpecs;
  isRequestBodyOptional: boolean;
  isUrlEncoded?: boolean;
  isRef?: boolean;
}): string => {
  const { schema, imports } = resolveRef<SchemaObject>(schemaObject, context);
  const propName = camel(
    !isRef && isReference(schemaObject) ? imports[0].name : name,
  );
  const additionalImports: GeneratorImport[] = [];

  const variableName = isUrlEncoded ? 'formUrlEncoded' : 'formData';
  let form = isUrlEncoded
    ? `const ${variableName} = new URLSearchParams();\n`
    : `const ${variableName} = new FormData();\n`;

  const combinedSchemas = schema.oneOf || schema.anyOf || schema.allOf;
  if (
    schema.type === 'object' ||
    (schema.type === undefined && combinedSchemas)
  ) {
    if (combinedSchemas) {
      const shouldCast = !!schema.oneOf || !!schema.anyOf;

      const combinedSchemasFormData = combinedSchemas!
        .map((schema) => {
          const { schema: combinedSchema, imports } = resolveRef<SchemaObject>(
            schema,
            context,
          );

          let newPropName = propName;
          let newPropDefinition = '';

          // If the schema is a union type (oneOf, anyOf) and includes a reference (has imports),
          // we need to cast the property to the specific type to avoid TypeScript errors.
          if (shouldCast && imports[0]) {
            additionalImports.push(imports[0]);
            newPropName = `${propName}${pascal(imports[0].name)}`;
            newPropDefinition = `const ${newPropName} = (${propName} as ${imports[0].name}${isRequestBodyOptional ? ' | undefined' : ''});\n`;
          }

          return (
            newPropDefinition +
            resolveSchemaPropertiesToFormData({
              schema: combinedSchema,
              variableName,
              propName: newPropName,
              context,
              isRequestBodyOptional,
            })
          );
        })
        .filter((x) => x)
        .join('\n');

      form += combinedSchemasFormData;
    }

    if (schema.properties) {
      const formDataValues = resolveSchemaPropertiesToFormData({
        schema,
        variableName,
        propName,
        context,
        isRequestBodyOptional,
      });

      form += formDataValues;
    }

    return form;
  }

  if (schema.type === 'array') {
    let valueStr = 'value';
    if (schema.items) {
      const { schema: itemSchema } = resolveRef<SchemaObject>(
        schema.items,
        context,
      );
      if (itemSchema.type === 'object' || itemSchema.type === 'array') {
        valueStr = 'JSON.stringify(value)';
      } else if (
        itemSchema.type === 'number' ||
        itemSchema.type === 'integer' ||
        itemSchema.type === 'boolean'
      ) {
        valueStr = 'value.toString()';
      }
    }

    return `${form}${propName}.forEach(value => ${variableName}.append('data', ${valueStr}))\n`;
  }

  if (
    schema.type === 'number' ||
    schema.type === 'integer' ||
    schema.type === 'boolean'
  ) {
    return `${form}${variableName}.append('data', ${propName}.toString())\n`;
  }

  return `${form}${variableName}.append('data', ${propName})\n`;
};

const resolveSchemaPropertiesToFormData = ({
  schema,
  variableName,
  propName,
  context,
  isRequestBodyOptional,
  keyPrefix = '',
  depth = 0,
}: {
  schema: SchemaObject;
  variableName: string;
  propName: string;
  context: ContextSpecs;
  isRequestBodyOptional: boolean;
  keyPrefix?: string;
  depth?: number;
}) => {
  const formDataValues = Object.entries(schema.properties ?? {}).reduce(
    (acc, [key, value]) => {
      const { schema: property } = resolveRef<SchemaObject>(value, context);

      // Skip readOnly properties for formData
      if (property.readOnly) {
        return acc;
      }

      let formDataValue = '';

      const formattedKeyPrefix = !isRequestBodyOptional
        ? ''
        : !keyword.isIdentifierNameES5(key)
          ? '?.'
          : '?';
      const formattedKey = !keyword.isIdentifierNameES5(key)
        ? `['${key}']`
        : `.${key}`;

      const valueKey = `${propName}${formattedKeyPrefix}${formattedKey}`;
      const nonOptionalValueKey = `${propName}${formattedKey}`;

      if (property.type === 'object') {
        if (
          context.output.override.formData.arrayHandling ===
          FormDataArrayHandling.EXPLODE
        ) {
          formDataValue = resolveSchemaPropertiesToFormData({
            schema: property,
            variableName,
            propName: nonOptionalValueKey,
            context,
            isRequestBodyOptional,
            keyPrefix: `${keyPrefix}${key}.`,
            depth: depth + 1,
          });
        } else {
          formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, JSON.stringify(${nonOptionalValueKey}));\n`;
        }
      } else if (property.type === 'array') {
        let valueStr = 'value';
        let hasNonPrimitiveChild = false;
        if (property.items) {
          const { schema: itemSchema } = resolveRef<SchemaObject>(
            property.items,
            context,
          );
          if (itemSchema.type === 'object' || itemSchema.type === 'array') {
            if (
              context.output.override.formData.arrayHandling ===
              FormDataArrayHandling.EXPLODE
            ) {
              hasNonPrimitiveChild = true;
              const resolvedValue = resolveSchemaPropertiesToFormData({
                schema: itemSchema,
                variableName,
                propName: 'value',
                context,
                isRequestBodyOptional,
                keyPrefix: `${keyPrefix}${key}[\${index${depth > 0 ? depth : ''}}].`,
                depth: depth + 1,
              });
              formDataValue = `${valueKey}.forEach((value, index${depth > 0 ? depth : ''}) => {
    ${resolvedValue}});\n`;
            } else {
              valueStr = 'JSON.stringify(value)';
            }
          } else if (
            itemSchema.type === 'number' ||
            itemSchema.type?.includes('number') ||
            itemSchema.type === 'integer' ||
            itemSchema.type?.includes('integer') ||
            itemSchema.type === 'boolean' ||
            itemSchema.type?.includes('boolean')
          ) {
            valueStr = 'value.toString()';
          }
        }
        if (
          context.output.override.formData.arrayHandling ===
          FormDataArrayHandling.EXPLODE
        ) {
          if (!hasNonPrimitiveChild) {
            formDataValue = `${valueKey}.forEach((value, index${depth > 0 ? depth : ''}) => ${variableName}.append(\`${keyPrefix}${key}[\${index${depth > 0 ? depth : ''}}]\`, ${valueStr}));\n`;
          }
        } else {
          formDataValue = `${valueKey}.forEach(value => ${variableName}.append(\`${keyPrefix}${key}${context.output.override.formData.arrayHandling === FormDataArrayHandling.SERIALIZE_WITH_BRACKETS ? '[]' : ''}\`, ${valueStr}));\n`;
        }
      } else if (
        property.type === 'number' ||
        property.type?.includes('number') ||
        property.type === 'integer' ||
        property.type?.includes('integer') ||
        property.type === 'boolean' ||
        property.type?.includes('boolean')
      ) {
        formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey}.toString())\n`;
      } else {
        formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey})\n`;
      }

      let existSubSchemaNullable = false;
      if (property.allOf || property.anyOf || property.oneOf) {
        const combine = property.allOf || property.anyOf || property.oneOf;
        const subSchemas = combine?.map((c) =>
          resolveObject({ schema: c, combined: true, context: context }),
        );
        if (
          subSchemas?.some((subSchema) => {
            return ['number', 'integer', 'boolean'].includes(subSchema.type);
          })
        ) {
          formDataValue = `${variableName}.append(\`${key}\`, ${nonOptionalValueKey}.toString())\n`;
        }

        if (
          subSchemas?.some((subSchema) => {
            return subSchema.type === 'null';
          })
        ) {
          existSubSchemaNullable = true;
        }
      }

      const isRequired =
        schema.required?.includes(key) && !isRequestBodyOptional;

      if (
        property.nullable ||
        property.type?.includes('null') ||
        existSubSchemaNullable
      ) {
        if (isRequired) {
          return acc + `if(${valueKey} !== null) {\n ${formDataValue} }\n`;
        }

        return (
          acc +
          `if(${valueKey} !== undefined && ${nonOptionalValueKey} !== null) {\n ${formDataValue} }\n`
        );
      }

      if (isRequired) {
        return acc + formDataValue;
      }

      return acc + `if(${valueKey} !== undefined) {\n ${formDataValue} }\n`;
    },
    '',
  );

  return formDataValues;
};
