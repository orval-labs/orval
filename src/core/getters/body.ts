import {camel} from 'case';
import {ReferenceObject, RequestBodyObject} from 'openapi3-ts';
import {generalJSTypesWithArray} from '../../constants';
import {GetterBody} from '../../types/getters';
import {getResReqTypes} from './resReqTypes';

export const getBody = (
  requestBody: ReferenceObject | RequestBodyObject
): GetterBody => {
  const allBodyTypes = getResReqTypes([['body', requestBody]]);
  const imports = allBodyTypes.reduce<string[]>(
    (acc, {imports = []}) => [...acc, ...imports],
    []
  );
  const definition = allBodyTypes.map(({value}) => value).join(' | ');
  const implementation = generalJSTypesWithArray.includes(definition)
    ? 'payload'
    : camel(definition);

  return {
    imports,
    definition,
    implementation,
    isBlob: definition === 'Blob'
  };
};
