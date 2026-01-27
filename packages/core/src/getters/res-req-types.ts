import { keyword } from 'esutils';
import { uniqueBy } from 'remeda';

import { createTypeAliasIfNeeded, resolveObject } from '../resolvers/object';
import { resolveExampleRefs, resolveRef } from '../resolvers/ref';
import {
  type ContextSpec,
  FormDataArrayHandling,
  type GeneratorImport,
  type OpenApiEncodingObject,
  type OpenApiMediaTypeObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  type ResReqTypesValue,
  type ScalarValue,
} from '../types';
import { camel } from '../utils';
import { isReference } from '../utils/assertion';
import { pascal } from '../utils/case';
import { getNumberWord } from '../utils/string';
import { getObject } from './object';
import { getScalar } from './scalar';

const formDataContentTypes = new Set(['multipart/form-data']);

const formUrlEncodedContentTypes = new Set([
  'application/x-www-form-urlencoded',
]);

interface GetResReqContentTypesOptions {
  mediaType: OpenApiMediaTypeObject;
  propName?: string;
  context: ContextSpec;
  isFormData?: boolean;
  contentType: string;
}

function getResReqContentTypes({
  mediaType,
  propName,
  context,
  isFormData,
  contentType,
}: GetResReqContentTypesOptions) {
  if (!mediaType.schema) {
    return;
  }

  // For form-data, try special handling for file type overrides
  if (isFormData) {
    const formDataResult = resolveFormDataRootObject({
      schemaOrRef: mediaType.schema,
      propName,
      context,
      encoding: mediaType.encoding,
    });
    if (formDataResult) {
      return formDataResult;
    }
    // No file type overrides - fall through to normal resolution
  }

  const resolvedObject = resolveObject({
    schema: mediaType.schema,
    propName,
    context,
  });

  // Media key has highest precedence: binary media key → Blob (overrides schema)
  if (!isFormData && isBinaryContentType(contentType)) {
    return {
      ...resolvedObject,
      value: 'Blob',
    };
  }

  return resolvedObject;
}

export function getResReqTypes(
  responsesOrRequests: [
    string,
    OpenApiReferenceObject | OpenApiResponseObject | OpenApiRequestBodyObject,
  ][],
  name: string,
  context: ContextSpec,
  defaultType = 'unknown',
  uniqueKey: (
    item: ResReqTypesValue,
    index: number,
    data: ResReqTypesValue[],
  ) => unknown = (item) => item.value,
): ResReqTypesValue[] {
  const typesArray = responsesOrRequests
    .filter(([_, res]) => Boolean(res))
    .map(([key, res]) => {
      if (isReference(res)) {
        const {
          schema: bodySchema,
          imports: [{ name, schemaName }],
        } = resolveRef<OpenApiRequestBodyObject | OpenApiResponseObject>(
          res,
          context,
        );

        const [contentType, mediaType] =
          Object.entries(bodySchema.content ?? {})[0] ?? [];

        const isFormData = formDataContentTypes.has(contentType);
        const isFormUrlEncoded = formUrlEncodedContentTypes.has(contentType);

        if ((!isFormData && !isFormUrlEncoded) || !mediaType.schema) {
          return [
            {
              value: name,
              imports: [{ name, schemaName }],
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
              schemaObject: mediaType.schema,
              context,
              isRequestBodyOptional:
                // Even though required is false by default, we only consider required to be false if specified. (See pull 1277)
                'required' in bodySchema && bodySchema.required === false,
              isRef: true,
              encoding: mediaType.encoding,
            })
          : undefined;

        const formUrlEncoded = isFormUrlEncoded
          ? getSchemaFormDataAndUrlEncoded({
              name,
              schemaObject: mediaType.schema,
              context,
              isRequestBodyOptional:
                'required' in bodySchema && bodySchema.required === false,
              isUrlEncoded: true,
              isRef: true,
              encoding: mediaType.encoding,
            })
          : undefined;

        const additionalImports = getFormDataAdditionalImports({
          schemaObject: mediaType.schema,
          context,
        });

        return [
          {
            value: name,
            imports: [{ name, schemaName }, ...additionalImports],
            schemas: [],
            type: 'unknown',
            isEnum: false,
            hasReadonlyProps: false,
            formData,
            formUrlEncoded,
            isRef: true,
            originalSchema: mediaType.schema,
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

            // When schema is a $ref, use schema name for consistent param naming
            let effectivePropName = propName;
            if (mediaType.schema && isReference(mediaType.schema)) {
              const { imports } = resolveRef<OpenApiSchemaObject>(
                mediaType.schema,
                context,
              );
              if (imports[0]?.name) {
                effectivePropName = imports[0].name;
              }
            }

            const isFormData = formDataContentTypes.has(contentType);

            const resolvedValue = getResReqContentTypes({
              mediaType,
              propName: effectivePropName,
              context,
              isFormData,
              contentType,
            });

            if (!resolvedValue) {
              // openapi spec 3.1 allows describing binary responses with only a content type
              if (isBinaryContentType(contentType)) {
                return {
                  value: 'Blob',
                  imports: [],
                  schemas: [],
                  type: 'Blob',
                  isEnum: false,
                  key,
                  isRef: false,
                  hasReadonlyProps: false,
                  contentType,
                };
              }

              return;
            }

            const isFormUrlEncoded =
              formUrlEncodedContentTypes.has(contentType);

            if ((!isFormData && !isFormUrlEncoded) || !effectivePropName) {
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
                  name: effectivePropName,
                  schemaObject: mediaType.schema!,
                  context,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                  isRef: true,
                  encoding: mediaType.encoding,
                })
              : undefined;

            const formUrlEncoded = isFormUrlEncoded
              ? getSchemaFormDataAndUrlEncoded({
                  name: effectivePropName,
                  schemaObject: mediaType.schema!,
                  context,
                  isUrlEncoded: true,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                  isRef: true,
                  encoding: mediaType.encoding,
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
          .filter(Boolean)
          .map((x) => ({ ...x, key })) as ResReqTypesValue[];
      }
      const swaggerSchema =
        'schema' in res
          ? (
              res as {
                schema?: OpenApiSchemaObject | OpenApiReferenceObject;
              }
            ).schema
          : undefined;

      if (swaggerSchema) {
        const propName = key ? pascal(name) + pascal(key) : undefined;
        const resolvedValue = resolveObject({
          schema: swaggerSchema,
          propName,
          context,
        });

        return [
          {
            ...resolvedValue,
            contentType: 'application/json',
            key,
          },
        ] as ResReqTypesValue[];
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

  return uniqueBy(typesArray.flat(), uniqueKey);
}

export function isBinaryContentType(contentType: string): boolean {
  if (contentType === 'application/octet-stream') return true;

  if (contentType.startsWith('image/')) return true;
  if (contentType.startsWith('audio/')) return true;
  if (contentType.startsWith('video/')) return true;
  if (contentType.startsWith('font/')) return true;

  // text/* types are not binary
  if (contentType.startsWith('text/')) return false;

  // text-based suffixes (RFC 6838)
  const textSuffixes = [
    '+json',
    '-json',
    '+xml',
    '-xml',
    '+yaml',
    '-yaml',
    '+rss',
    '-rss',
    '+csv',
    '-csv',
  ];
  if (textSuffixes.some((suffix) => contentType.includes(suffix))) {
    return false;
  }

  // text-based whitelist - these as NOT binary
  const textApplicationTypes = new Set([
    'application/json',
    'application/xml',
    'application/yaml',
    'application/x-www-form-urlencoded',
    'application/javascript',
    'application/ecmascript',
    'application/graphql',
  ]);

  return !textApplicationTypes.has(contentType);
}

/**
 * Response type categories for HTTP client response parsing.
 * Maps to Angular HttpClient's responseType, Axios responseType, and Fetch response methods.
 */
export type ResponseTypeCategory = 'json' | 'text' | 'blob' | 'arraybuffer';

/**
 * Determine the response type category for a given content type.
 * Used to set the correct responseType option in HTTP clients.
 *
 * @param contentType - The MIME content type (e.g., 'application/json', 'text/plain')
 * @returns The response type category to use for parsing
 */
export function getResponseTypeCategory(
  contentType: string,
): ResponseTypeCategory {
  // Binary types → blob
  if (isBinaryContentType(contentType)) {
    return 'blob';
  }

  // JSON types
  if (
    contentType === 'application/json' ||
    contentType.includes('+json') ||
    contentType.includes('-json')
  ) {
    return 'json';
  }

  // Everything else is text (text/*, application/xml, etc.)
  return 'text';
}

/**
 * Get the default content type from a list of content types.
 * Priority: application/json > any JSON-like type > first in list
 *
 * @param contentTypes - Array of content types from OpenAPI spec
 * @returns The default content type to use
 */
export function getDefaultContentType(contentTypes: string[]): string {
  if (contentTypes.length === 0) {
    return 'application/json';
  }

  // Prefer application/json
  if (contentTypes.includes('application/json')) {
    return 'application/json';
  }

  // Prefer any JSON-like type
  const jsonType = contentTypes.find(
    (ct) => ct.includes('+json') || ct.includes('-json'),
  );
  if (jsonType) {
    return jsonType;
  }

  // Default to first
  return contentTypes[0];
}

/**
 * Determine if a form-data root field should be treated as binary or text file
 * based on encoding.contentType or contentMediaType.
 *
 * Returns:
 * - 'binary': field is a binary file (Blob in types, File in zod)
 * - 'text': field is a text file that can accept string (Blob | string in types, File | string in zod)
 * - undefined: no override, use standard resolution
 */
export function getFormDataFieldFileType(
  resolvedSchema: OpenApiSchemaObject,
  encodingContentType: string | undefined,
): 'binary' | 'text' | undefined {
  // Only override string fields - objects/arrays with encoding are just serialized
  if (resolvedSchema.type !== 'string') {
    return undefined;
  }

  // contentEncoding (e.g., base64) means the value is an encoded string, not a file
  if (resolvedSchema.contentEncoding) {
    return undefined;
  }

  const effectiveContentType =
    encodingContentType ?? resolvedSchema.contentMediaType;

  if (effectiveContentType) {
    return isBinaryContentType(effectiveContentType) ? 'binary' : 'text';
  }

  return undefined;
}

/**
 * Resolve form-data root object with file type overrides.
 * Returns undefined if no file type overrides needed (caller should use normal resolution).
 */
function resolveFormDataRootObject({
  schemaOrRef,
  propName,
  context,
  encoding,
}: {
  schemaOrRef: OpenApiSchemaObject | OpenApiReferenceObject;
  propName?: string;
  context: ContextSpec;
  encoding?: Record<string, OpenApiEncodingObject>;
}): ScalarValue | undefined {
  const { schema } = resolveRef<OpenApiSchemaObject>(schemaOrRef, context);

  if (!schema.properties) {
    return undefined;
  }

  // Compute file type overrides for top-level properties
  const propertyOverrides: Record<string, ScalarValue> = {};

  for (const key of Object.keys(schema.properties)) {
    const propSchema = schema.properties[key];
    const { schema: resolvedSchema } = resolveRef<OpenApiSchemaObject>(
      propSchema,
      context,
    );

    // Handle top-level string properties with file types
    const fileType = getFormDataFieldFileType(
      resolvedSchema,
      encoding?.[key]?.contentType,
    );

    if (fileType) {
      const scalar = getScalar({
        item: resolvedSchema,
        name: propName,
        context,
      });
      propertyOverrides[key] = {
        ...scalar,
        value: fileType === 'binary' ? 'Blob' : 'Blob | string',
      };
      continue;
    }

    // Handle arrays of files
    if (resolvedSchema.type === 'array' && resolvedSchema.items) {
      const { schema: itemsSchema } = resolveRef<OpenApiSchemaObject>(
        resolvedSchema.items,
        context,
      );

      // Precedence: encoding.contentType > items.contentMediaType
      const effectiveContentType =
        encoding?.[key]?.contentType ?? itemsSchema.contentMediaType;

      if (effectiveContentType) {
        const isBinary = isBinaryContentType(effectiveContentType);
        const scalar = getScalar({
          item: resolvedSchema,
          name: propName,
          context,
        });
        propertyOverrides[key] = {
          ...scalar,
          value: isBinary ? 'Blob[]' : '(Blob | string)[]',
        };
      }
    }
  }

  // No overrides - let caller use normal resolution (preserves $ref names)
  if (Object.keys(propertyOverrides).length === 0) {
    return undefined;
  }

  const result = getObject({
    item: schema,
    name: propName,
    context,
    nullable: '', // multipart/form-data has no native null representation
    propertyOverrides,
  });

  // Wrap in type alias if needed (same contract as resolveObject)
  const resolverValue = { ...result, originalSchema: schema };
  return (
    createTypeAliasIfNeeded({
      resolvedValue: resolverValue,
      propName,
      context,
    }) ?? result
  );
}

interface GetFormDataAdditionalImportsOptions {
  schemaObject: OpenApiSchemaObject | OpenApiReferenceObject;
  context: ContextSpec;
}

function getFormDataAdditionalImports({
  schemaObject,
  context,
}: GetFormDataAdditionalImportsOptions): GeneratorImport[] {
  const { schema } = resolveRef<OpenApiSchemaObject>(schemaObject, context);

  if (schema.type !== 'object') {
    return [];
  }

  const combinedSchemas = schema.oneOf || schema.anyOf;

  if (!combinedSchemas) {
    return [];
  }

  return combinedSchemas
    .map(
      (schema) => resolveRef<OpenApiSchemaObject>(schema, context).imports[0],
    )
    .filter(Boolean);
}

interface GetSchemaFormDataAndUrlEncodedOptions {
  name: string;
  schemaObject: OpenApiSchemaObject | OpenApiReferenceObject;
  context: ContextSpec;
  isRequestBodyOptional: boolean;
  isUrlEncoded?: boolean;
  isRef?: boolean;
  encoding?: Record<string, OpenApiEncodingObject>;
}

function getSchemaFormDataAndUrlEncoded({
  name,
  schemaObject,
  context,
  isRequestBodyOptional,
  isUrlEncoded,
  isRef,
  encoding,
}: GetSchemaFormDataAndUrlEncodedOptions): string {
  const { schema, imports } = resolveRef<OpenApiSchemaObject>(
    schemaObject,
    context,
  );
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
          const { schema: combinedSchema, imports } =
            resolveRef<OpenApiSchemaObject>(schema, context);

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
              encoding,
            })
          );
        })
        .filter(Boolean)
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
        encoding,
      });

      form += formDataValues;
    }

    return form;
  }

  if (schema.type === 'array') {
    let valueStr = 'value';
    if (schema.items) {
      const { schema: itemSchema } = resolveRef<OpenApiSchemaObject>(
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
}

interface ResolveSchemaPropertiesToFormDataOptions {
  schema: OpenApiSchemaObject;
  variableName: string;
  propName: string;
  context: ContextSpec;
  isRequestBodyOptional: boolean;
  keyPrefix?: string;
  depth?: number;
  encoding?: Record<string, OpenApiEncodingObject>;
}

function resolveSchemaPropertiesToFormData({
  schema,
  variableName,
  propName,
  context,
  isRequestBodyOptional,
  keyPrefix = '',
  depth = 0,
  encoding,
}: ResolveSchemaPropertiesToFormDataOptions): string {
  const formDataValues = Object.entries(schema.properties ?? {}).reduce(
    (acc, [key, value]) => {
      const { schema: property } = resolveRef<OpenApiSchemaObject>(
        value,
        context,
      );

      // Skip readOnly properties for formData
      if (property.readOnly) {
        return acc;
      }

      let formDataValue = '';

      // Get encoding.contentType for this field (only at top level, depth === 0)
      const fieldEncoding = depth === 0 ? encoding?.[key] : undefined;
      const encodingContentType = fieldEncoding?.contentType;

      const formattedKeyPrefix = isRequestBodyOptional
        ? keyword.isIdentifierNameES5(key)
          ? '?'
          : '?.'
        : '';
      const formattedKey = keyword.isIdentifierNameES5(key)
        ? `.${key}`
        : `['${key}']`;

      const valueKey = `${propName}${formattedKeyPrefix}${formattedKey}`;
      const nonOptionalValueKey = `${propName}${formattedKey}`;

      // Use shared file type detection (same logic as type generation)
      const fileType = getFormDataFieldFileType(property, encodingContentType);
      const effectiveContentType =
        encodingContentType ?? property.contentMediaType;

      if (fileType === 'binary' || property.format === 'binary') {
        // Binary: append directly (value is Blob)
        formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey});\n`;
      } else if (fileType === 'text') {
        // Text file: value is Blob | string, check at runtime
        formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey} instanceof Blob ? ${nonOptionalValueKey} : new Blob([${nonOptionalValueKey}], { type: '${effectiveContentType}' }));\n`;
      } else if (property.type === 'object') {
        formDataValue =
          context.output.override.formData.arrayHandling ===
          FormDataArrayHandling.EXPLODE
            ? resolveSchemaPropertiesToFormData({
                schema: property,
                variableName,
                propName: nonOptionalValueKey,
                context,
                isRequestBodyOptional,
                keyPrefix: `${keyPrefix}${key}.`,
                depth: depth + 1,
                encoding,
              })
            : encodingContentType
              ? `${variableName}.append(\`${keyPrefix}${key}\`, new Blob([JSON.stringify(${nonOptionalValueKey})], { type: '${encodingContentType}' }));\n`
              : `${variableName}.append(\`${keyPrefix}${key}\`, JSON.stringify(${nonOptionalValueKey}));\n`;
      } else if (property.type === 'array') {
        let valueStr = 'value';
        let hasNonPrimitiveChild = false;
        if (property.items) {
          const { schema: itemSchema } = resolveRef<OpenApiSchemaObject>(
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
        formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey});\n`;
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
}
