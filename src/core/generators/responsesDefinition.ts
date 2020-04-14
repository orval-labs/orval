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

  const models = Object.entries(responses).map(([name, response]) => {
    const allResponseTypes = getResReqTypes([['response', response]], name);
    const imports = allResponseTypes.reduce<string[]>(
      (acc, { imports = [] }) => [...acc, ...imports],
      [],
    );
    const schemas = allResponseTypes.reduce<GeneratorSchema[]>(
      (acc, { schemas = [] }) => [...acc, ...schemas],
      [],
    );
    const type = allResponseTypes.map(({ value }) => value).join(' | ');
    const isEmptyInterface = type === '{}';
    let model = '';
    if (isEmptyInterface) {
      model = `// tslint:disable-next-line:no-empty-interface \nexport interface ${pascal(
        name,
      )}Response ${type}\n`;
    } else if (
      type.includes('{') &&
      !type.includes('|') &&
      !type.includes('&')
    ) {
      model = `export interface ${pascal(name)}Response ${type}\n`;
    } else {
      model = `export type ${pascal(name)}Response = ${type || 'unknown'};\n`;
    }

    return {
      name: `${pascal(name)}Response`,
      model,
      imports: generalTypesFilter(imports),
      schemas,
    };
  });

  return models;
};
