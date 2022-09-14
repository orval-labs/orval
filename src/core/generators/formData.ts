import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { camel } from '../../utils/case';
import { isReference } from '../../utils/is';
import { generatePropertyAccessor } from '../../utils/propertyAccessor';
import { resolveRef } from '../resolvers/ref';

export const generateSchemaFormDataAndUrlEncoded = (
  name: string,
  schemaObject: SchemaObject | ReferenceObject,
  context: ContextSpecs,
  isUrlEncoded?: boolean,
) => {
  const { schema, imports } = resolveRef<SchemaObject>(schemaObject, context);
  const propName = isReference(schemaObject) ? imports[0].name : name;

  const variableName = isUrlEncoded ? 'formUrlEncoded' : 'formData';
  const form = isUrlEncoded
    ? `const ${variableName} = new URLSearchParams();\n`
    : `const ${variableName} = new FormData();\n`;

  if (schema.type === 'object' && schema.properties) {
    const formDataValues = Object.entries(schema.properties).reduce(
      (acc, [key, value]) => {
        const { schema: property } = resolveRef<SchemaObject>(value, context);

        let formDataValue = '';

        if (property.type === 'object') {
          formDataValue = `${variableName}.append('${key}', JSON.stringify(${camel(
            propName,
          )}${generatePropertyAccessor(key)}));\n`;
        } else if (property.type === 'array') {
          formDataValue = `${camel(propName)}${generatePropertyAccessor(
            key,
          )}.forEach(value => ${variableName}.append('${key}', value));\n`;
        } else if (
          property.type === 'number' ||
          property.type === 'integer' ||
          property.type === 'boolean'
        ) {
          formDataValue = `${variableName}.append('${key}', ${camel(
            propName,
          )}${generatePropertyAccessor(key)}.toString())\n`;
        } else {
          formDataValue = `${variableName}.append('${key}', ${camel(
            propName,
          )}${generatePropertyAccessor(key)})\n`;
        }

        if (schema.required?.includes(key)) {
          return acc + formDataValue;
        }

        return (
          acc +
          `if(${camel(propName)}${generatePropertyAccessor(
            key,
          )} !== undefined) {\n ${formDataValue} }\n`
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
