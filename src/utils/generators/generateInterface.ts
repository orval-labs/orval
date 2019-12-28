import { pascal } from 'case';
import uniq from 'lodash/uniq';
import { SchemaObject } from 'openapi3-ts';
import { generalJSTypes } from '../../constants/generalJsTypes';
import { getScalar } from '../getters/getScalar';

/**
 * Generate the interface string
 * A tslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = (name: string, schema: SchemaObject) => {
  const { value, imports } = getScalar(schema);
  const isEmptyObject = value === '{}';

  return {
    name: pascal(name),
    model: isEmptyObject
      ? `// tslint:disable-next-line:no-empty-interface
export interface ${pascal(name)} ${value}`
      : `export interface ${pascal(name)} ${value}`,
    imports: uniq(imports).filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase())),
  };
};
