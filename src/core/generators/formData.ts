import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { asyncReduce } from '../../utils/async-reduce';
import { camel } from '../../utils/case';
import { resolveRef } from '../resolvers/ref';

export const generateSchemaFormData = async (
  name: string,
  schemaObject: SchemaObject,
  context: ContextSpecs,
) => {
  const { schema } = await resolveRef<SchemaObject>(schemaObject, context);

  const formData = 'const formData = new FormData();\n';

  if (schema.type === 'object' && schema.properties) {
    const formDataValues = await asyncReduce(
      Object.entries(schema.properties),
      async (acc, [key, value]) => {
        const { schema: property } = await resolveRef<SchemaObject>(
          value,
          context,
        );

        let formDataValue = '';

        if (property.type === 'object' || property.type === 'array') {
          formDataValue = `formData.append('${key}', JSON.stringify(${camel(
            name,
          )}.${key}))\n`;
        } else if (property.type === 'number' || property.type === 'boolean') {
          formDataValue = `formData.append('${key}', ${camel(
            name,
          )}.${key}.toString())\n`;
        } else {
          formDataValue = `formData.append('${key}', ${camel(name)}.${key})\n`;
        }

        if (schema.required?.includes(key)) {
          return acc + formDataValue;
        }

        return acc + `if(${camel(name)}.${key}) {\n ${formDataValue} }\n`;
      },
      '',
    );

    return `${formData}${formDataValues}`;
  }

  if (schema.type === 'array') {
    return `${formData}formData.append('data', JSON.stringify(${camel(
      name,
    )}))\n`;
  }

  if (schema.type === 'number' || schema.type === 'boolean') {
    return `${formData}formData.append('data', ${camel(name)}.toString())\n`;
  }

  return `${formData}formData.append('data', ${camel(name)})\n`;
};
