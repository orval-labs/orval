import { pascal } from 'case';
import isEmpty from 'lodash/isEmpty';
import { ComponentsObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { generalTypesFilter } from '../../utils/filters';
import { getResReqTypes } from '../getters/resReqTypes';

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (
  responses: ComponentsObject['responses'] = {},
): Array<GeneratorSchema> => {
  if (isEmpty(responses)) {
    return [];
  }

  return Object.entries(responses).reduce<GeneratorSchema[]>(
    (acc, [name, response]) => {
      const allResponseTypes = getResReqTypes(
        [['responseData', response]],
        name,
      );

      const imports = allResponseTypes.reduce<string[]>(
        (acc, { imports = [] }) => [...acc, ...imports],
        [],
      );
      const schemas = allResponseTypes.reduce<GeneratorSchema[]>(
        (acc, { schemas = [] }) => [...acc, ...schemas],
        [],
      );
      const type = allResponseTypes.map(({ value }) => value).join(' | ');

      const model = `export type ${pascal(name)}Response = ${
        type || 'unknown'
      };\n`;

      return [
        ...acc,
        ...schemas,
        {
          name: `${pascal(name)}Response`,
          model,
          imports: generalTypesFilter(imports),
        },
      ];
    },
    [],
  );
};
