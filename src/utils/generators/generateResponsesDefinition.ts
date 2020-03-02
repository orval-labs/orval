import {pascal} from 'case';
import isEmpty from 'lodash/isEmpty';
import {ComponentsObject} from 'openapi3-ts';
import {generalTypesFilter} from '../generalTypesFilter';
import {getResReqTypes} from '../getters/getResReqTypes';

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (
  responses: ComponentsObject['responses'] = {}
): Array<{name: string; model: string; imports?: string[]}> => {
  if (isEmpty(responses)) {
    return [];
  }

  const models = Object.entries(responses).map(([name, response]) => {
    let imports: string[] = [];
    const allResponseTypes = getResReqTypes([['', response]]);
    const allResponseTypesImports = allResponseTypes.reduce<string[]>(
      (acc, {imports = []}) => [...acc, ...imports],
      []
    );
    imports = [...imports, ...allResponseTypesImports];
    const type = allResponseTypes.map(({value}) => value).join(' | ');
    const isEmptyInterface = type === '{}';
    let model = '';
    if (isEmptyInterface) {
      model = `// tslint:disable-next-line:no-empty-interface \nexport interface ${pascal(
        name
      )}Response ${type}`;
    } else if (
      type.includes('{') &&
      !type.includes('|') &&
      !type.includes('&')
    ) {
      model = `export interface ${pascal(name)}Response ${type}`;
    } else {
      model = `export type ${pascal(name)}Response = ${type || 'unknown'};`;
    }

    return {
      name: `${pascal(name)}Response`,
      model,
      imports: generalTypesFilter(imports)
    };
  });

  return models;
};
