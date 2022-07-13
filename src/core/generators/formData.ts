import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { asyncReduce } from '../../utils/async-reduce';
import { camel } from '../../utils/case';
import { isReference } from '../../utils/is';
import { resolveRef } from '../resolvers/ref';

export const generateSchemaFormDataAndUrlEncoded = async (
  name: string,
  schemaObject: SchemaObject | ReferenceObject,
  context: ContextSpecs,
  isUrlEncoded?: boolean,
) => {
  const { schema, imports } = await resolveRef<SchemaObject>(
    schemaObject,
    context,
  );
  const propName = isReference(schemaObject) ? imports[0].name : name;

  const variableName = isUrlEncoded ? 'formUrlEncoded' : 'formData';
  const form = isUrlEncoded
    ? `const ${variableName} = new URLSearchParams();\n`
    : `const ${variableName} = new FormData();\n`;

  if (schema.type === 'object' && schema.properties) {
    const formDataValues = await asyncReduce(
      Object.entries(schema.properties),
      async (acc, [key, value]) => {
        const { schema: property } = await resolveRef<SchemaObject>(
          value,
          context,
        );

        let formDataValue = '';

        if (property.type === 'object') {
          formDataValue = `${variableName}.append('${key}', JSON.stringify(${camel(
            propName,
          )}${key.includes('-') ? `['${key}']` : `.${key}`}));\n`;
        } else if (property.type === 'array') {
          formDataValue = `${camel(propName)}${
            key.includes('-') ? `['${key}']` : `.${key}`
          }.forEach(value => ${variableName}.append('${key}', value));\n`;
        } else if (
          property.type === 'number' ||
          property.type === 'integer' ||
          property.type === 'boolean'
        ) {
          formDataValue = `${variableName}.append('${key}', ${camel(propName)}${
            key.includes('-') ? `['${key}']` : `.${key}`
          }.toString())\n`;
        } else {
          formDataValue = `${variableName}.append('${key}', ${camel(propName)}${
            key.includes('-') ? `['${key}']` : `.${key}`
          })\n`;
        }

        if (schema.required?.includes(key)) {
          return acc + formDataValue;
        }

        return (
          acc +
          `if(${camel(propName)}${
            key.includes('-') ? `['${key}']` : `.${key}`
          } !== undefined) {\n ${formDataValue} }\n`
        );
      },
      '',
    );

    return `${form}${formDataValues}`;
  }

  if (schema.type === 'array') {
    return `${form}${camel(
      propName,
    )}.forEach(value => ${variableName}.append('data', value))\n`;
  }

  if (schema.type === 'number' || schema.type === 'boolean') {
    return `${form}${variableName}.append('data', ${camel(
      propName,
    )}.toString())\n`;
  }

  return `${form}${variableName}.append('data', ${camel(propName)})\n`;
};
