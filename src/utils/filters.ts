import uniq from 'lodash/uniq';
import {generalJSTypesWithArray} from '../constants';

export const generalTypesFilter = (values: string[] = []) => {
  return uniq(values.filter(value => !generalJSTypesWithArray.includes(value)));
};
