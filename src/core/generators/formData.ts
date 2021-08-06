import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { asyncReduce } from '../../utils/async-reduce';
import { camel } from '../../utils/case';
import { isReference } from '../../utils/is';
import { resolveRef } from '../resolvers/ref';

export const generateSchemaFormData = async (
  name: string,
  schemaObject: SchemaObject | ReferenceObject,
  context: ContextSpecs,
) => {
  const { schema, imports } = await resolveRef<SchemaObject>(
    schemaObject,
    context,
  );
  const propName = isReference(schemaObject) ? imports[0].name : name;

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
            propName,
          )}${key.includes('-') ? `['${key}']` : `.${key}`}))\n`;
        } else if (
          property.type === 'number' ||
          property.type === 'integer' ||
          property.type === 'boolean'
        ) {
          formDataValue = `formData.append('${key}', ${camel(propName)}${
            key.includes('-') ? `['${key}']` : `.${key}`
          }.toString())\n`;
        } else {
          formDataValue = `formData.append('${key}', ${camel(propName)}${
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
          }) {\n ${formDataValue} }\n`
        );
      },
      '',
    );

    return `${formData}${formDataValues}`;
  }

  if (schema.type === 'array') {
    return `${formData}formData.append('data', JSON.stringify(${camel(
      propName,
    )}))\n`;
  }

  if (schema.type === 'number' || schema.type === 'boolean') {
    return `${formData}formData.append('data', ${camel(
      propName,
    )}.toString())\n`;
  }

  return `${formData}formData.append('data', ${camel(propName)})\n`;
};
