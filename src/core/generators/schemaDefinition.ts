import isEmpty from 'lodash/isEmpty';
import { SchemasObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { pascal, upper } from '../../utils/case';
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
  schemas: SchemasObject = {},
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
        return [...acc, ...generateInterface({ name, schema, schemas })];
      } else {
        const resolvedValue = resolveValue({ schema, name, schemas });

        let output = '';
        output += `export type ${pascal(name)} = ${resolvedValue.value};\n`;

        if (resolvedValue.isEnum) {
          const implementation = resolvedValue.value
            .split(' | ')
            .reduce((acc, val) => {
              return (
                acc +
                `  ${
                  resolvedValue.type === 'number'
                    ? `${upper(resolvedValue.type)}_${val}`
                    : sanitize(val, false)
                }: ${val} as ${pascal(name)},\n`
              );
            }, '');

          output += `\n\nexport const ${pascal(
            name,
          )} = {\n${implementation}};\n`;
        }

        return [
          ...acc,
          ...resolvedValue.schemas,
          {
            name: pascal(name),
            model: output,
            imports: generalTypesFilter(resolvedValue.imports),
          },
        ];
      }
    },
    [],
  );

  return models;
};
