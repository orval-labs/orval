import { overrideVarName } from './faker/getters';
import { MockSchemaObject } from './types';

export function createOverrideVariable(path?: string) {
  let index = 0;

  if (!path) {
    return overrideVarName;
  }

  return (
    overrideVarName +
    path
      ?.replace('#.', '')
      .split('.')
      .reduce((acc, key) => {
        if (key !== '[]') {
          return acc + `?.['${key}']`;
        } else {
          return acc + `?.[index_${index++}]`;
        }
      }, '')
  );
}
