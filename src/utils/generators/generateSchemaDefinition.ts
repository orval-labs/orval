import { pascal } from 'case';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { ComponentsObject } from 'openapi3-ts';
import { generalJSTypes } from '../constants/generalJsTypes';
import { generateInterface } from './generateInterface';
import { isReference } from '../utils/isReference';
import { resolveValue } from '../utils/resolveValue';

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (
  schemas: ComponentsObject['schemas'] = {},
): Array<{ name: string; model: string; imports?: string[] }> => {
  if (isEmpty(schemas)) {
    return [];
  }

  const models = Object.entries(schemas).map(([name, schema]) => {
    if (
      (!schema.type || schema.type === 'object') &&
      !schema.allOf &&
      !schema.oneOf &&
      !isReference(schema) &&
      !schema.nullable
    ) {
      return generateInterface(name, schema);
    } else {
      const { value, imports, isEnum } = resolveValue(schema);

      let output = '';
      output += `export type ${pascal(name)} = ${value};`;

      if (isEnum) {
        output += `\n\nexport const ${pascal(name)} = {\n${value
          .split(' | ')
          .reduce((acc, val) => acc + `  ${val.replace(/\W|_/g, '')}: ${val} as ${pascal(name)},\n`, '')}};`;
      }

      return {
        name: pascal(name),
        model: output,
        imports: uniq(imports).filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase())),
      };
    }
  });

  return models;
};
