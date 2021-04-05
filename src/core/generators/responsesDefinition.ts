import isEmpty from 'lodash/isEmpty';
import { ComponentsObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
import { GeneratorImport, GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { pascal } from '../../utils/case';
import { getResReqTypes } from '../getters/resReqTypes';

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (
  responses: ComponentsObject['responses'] = {},
  target: InputTarget,
): Promise<GeneratorSchema[]> => {
  if (isEmpty(responses)) {
    return Promise.resolve([]);
  }

  return asyncReduce(
    Object.entries(responses),
    async (acc, [name, response]) => {
      const allResponseTypes = await getResReqTypes(
        [['Response', response]],
        name,
        target,
      );

      const imports = allResponseTypes.reduce<GeneratorImport[]>(
        (acc, { imports = [] }) => [...acc, ...imports],
        [],
      );
      const schemas = allResponseTypes.reduce<GeneratorSchema[]>(
        (acc, { schemas = [] }) => [...acc, ...schemas],
        [],
      );
      const type = allResponseTypes.map(({ value }) => value).join(' | ');

      const modelName = `${pascal(name)}Response`;
      const model = `export type ${modelName} = ${type || 'unknown'};\n`;

      return [
        ...acc,
        ...schemas,
        ...(modelName !== type
          ? [
              {
                name: modelName,
                model,
                imports,
              },
            ]
          : []),
      ];
    },
    [] as GeneratorSchema[],
  );
};
