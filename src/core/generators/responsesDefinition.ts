import isEmpty from 'lodash/isEmpty';
import { ComponentsObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import { pascal } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import { getResReqTypes } from '../getters/resReqTypes';

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (
  responses: ComponentsObject['responses'] = {},
  override: OverrideOutput = {},
): Array<GeneratorSchema> => {
  if (isEmpty(responses)) {
    return [];
  }

  return Object.entries(responses).reduce<GeneratorSchema[]>(
    (acc, [name, response]) => {
      const allResponseTypes = getResReqTypes(
        [['responseData', response]],
        name,
        override,
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
