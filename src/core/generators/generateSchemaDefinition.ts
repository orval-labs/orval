import {pascal, upper} from 'case';
import isEmpty from 'lodash/isEmpty';
import {SchemaObject} from 'openapi3-ts';
import {generalTypesFilter} from '../../utils/filters';
import {isReference} from '../../utils/is';
import {resolveValue} from '../resolvers/resolveValue';
import {generateInterface} from './generateInterface';

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (
  schemas: SchemaObject = {}
): Array<{name: string; model: string; imports?: string[]}> => {
  if (isEmpty(schemas)) {
    return [];
  }

  const models = Object.entries(schemas).reduce<
    Array<{name: string; model: string; imports?: string[]}>
  >((acc, [name, schema]) => {
    if (
      (!schema.type || schema.type === 'object') &&
      !schema.allOf &&
      !schema.oneOf &&
      !isReference(schema) &&
      !schema.nullable
    ) {
      return [...acc, ...generateInterface(name, schema)];
    } else {
      const {value, imports, isEnum, type, schemas = []} = resolveValue(
        schema,
        name
      );

      let output = '';
      output += `export type ${pascal(name)} = ${value};`;

      if (isEnum) {
        output += `\n\nexport const ${pascal(name)} = {\n${value
          .split(' | ')
          .reduce((acc, val) => {
            return (
              acc +
              `  ${
                type === 'number'
                  ? `${upper(type)}_${val}`
                  : val.replace(/\W|_/g, '')
              }: ${val} as ${pascal(name)},\n`
            );
          }, '')}};`;
      }

      return [
        ...acc,
        ...schemas,
        {
          name: pascal(name),
          model: output,
          imports: generalTypesFilter(imports)
        }
      ];
    }
  }, []);

  return models;
};
