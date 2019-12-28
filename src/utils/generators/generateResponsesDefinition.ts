import { pascal } from 'case';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { ComponentsObject } from 'openapi3-ts';
import { generalJSTypes } from '../constants/generalJsTypes';
import { getResReqTypes } from '../utils/getResReqTypes';

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (
  responses: ComponentsObject['responses'] = {},
): Array<{ name: string; model: string; imports?: string[] }> => {
  if (isEmpty(responses)) {
    return [];
  }

  const models = Object.entries(responses).map(([name, response]) => {
    const type = getResReqTypes([['', response]]);
    const isEmptyInterface = type === '{}';

    let imports: string[] = [];
    let model = '';
    if (isEmptyInterface) {
      model = `// tslint:disable-next-line:no-empty-interface \nexport interface ${pascal(name)}Response ${type}`;
    } else if (type.includes('{') && !type.includes('|') && !type.includes('&')) {
      model = `export interface ${pascal(name)}Response ${type}`;
    } else {
      if (type) {
        imports = [...imports, type];
      }
      model = `export type ${pascal(name)}Response = ${type || 'unknown'};`;
    }

    return {
      name: `${pascal(name)}Response`,
      model,
      imports: uniq(imports).filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase())),
    };
  });

  return models;
};
