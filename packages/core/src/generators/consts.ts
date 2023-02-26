import { isSchemaObject, SchemaObject } from 'openapi3-ts';
import { resolveRef } from '../resolvers';
import { ContextSpecs } from '../types';
import { isReference, pascal } from '../utils';

/**
 * Generate the consts based on passed schema
 * Generated consts will be exported along with model to be used for validation purposes
 *
 * @param name Model name
 * @param schema Model schema
 */
export const generateConsts = ({
  name,
  schema,
  context,
  initialOutput,
}: {
  name: string;
  schema: SchemaObject;
  context: ContextSpecs;
  initialOutput?: string;
}): string => {
  let output = initialOutput ?? '';

  if (isSchemaObject(schema) && schema.properties) {
    output += [
      ...new Set(
        Object.entries(schema.properties).map(([propName, propSchema]) => {
          if (isReference(propSchema)) return '';
          return generateConsts({
            name: pascal(`${name}-${propName}`),
            schema: propSchema,
            context,
            initialOutput: output,
          });
        }),
      ),
    ].join('');
    return output;
  }

  if (schema.minLength !== undefined) {
    output += `export const ${name}MinLenght = ${schema.minLength};\n`;
  }

  if (schema.maxLength !== undefined) {
    output += `export const ${name}MaxLenght = ${schema.maxLength};\n`;
  }

  if (schema.minimum !== undefined) {
    output += `export const ${name}Minimum = ${schema.minimum};\n`;
  }

  if (schema.maximum !== undefined) {
    output += `export const ${name}Maximum = ${schema.maximum};\n`;
  }

  if (schema.exclusiveMaximum !== undefined) {
    output += `export const ${name}ExclusiveMaximum = ${schema.exclusiveMaximum};\n`;
  }

  if (schema.exclusiveMinimum !== undefined) {
    output += `export const ${name}ExclusiveMinimum = ${schema.exclusiveMinimum};\n`;
  }

  return output;
};
