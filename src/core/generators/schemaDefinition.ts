import { pascal, upper } from 'case';
import isEmpty from 'lodash/isEmpty';
import { SchemaObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { generalTypesFilter } from '../../utils/filters';
import { isReference } from '../../utils/is';
import { sanitize } from '../../utils/string';
import { resolveValue } from '../resolvers/value';
import { generateInterface } from './interface';

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (
  schemas: SchemaObject = {},
): Array<GeneratorSchema> => {
  if (isEmpty(schemas)) {
    return [];
  }

  const models = Object.entries(schemas).reduce<Array<GeneratorSchema>>(
    (acc, [name, schema]) => {
      if (
        (!schema.type || schema.type === 'object') &&
        !schema.allOf &&
        !schema.oneOf &&
        !isReference(schema) &&
        !schema.nullable
      ) {
        return [...acc, ...generateInterface(name, schema)];
      } else {
        const { value, imports, isEnum, type, schemas = [] } = resolveValue(
          schema,
          name,
        );

        let output = '';
        output += `export type ${pascal(name)} = ${value};\n`;

        if (isEnum) {
          const implementation = value.split(' | ').reduce((acc, val) => {
            return (
              acc +
              `  ${
                type === 'number' ? `${upper(type)}_${val}` : sanitize(val)
              }: ${val} as ${pascal(name)},\n`
            );
          }, '');

          output += `\n\nexport const ${pascal(
            name,
          )} = {\n${implementation}};\n`;
        }

        return [
          ...acc,
          ...schemas,
          {
            name: pascal(name),
            model: output,
            imports: generalTypesFilter(imports),
          },
        ];
      }
    },
    [],
  );

  return models;
};
