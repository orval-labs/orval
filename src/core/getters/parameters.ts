import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import {
  ComponentsObject,
  ParameterObject,
  ReferenceObject,
} from 'openapi3-ts';
import { GetterParameters } from '../../types/getters';
import { isReference } from '../../utils/is';

export const getParameters = (
  parameters: (ReferenceObject | ParameterObject)[] = [],
  components?: ComponentsObject,
): GetterParameters => {
  return groupBy(
    parameters.map<ParameterObject>((p) => {
      if (isReference(p)) {
        return get(
          components,
          p.$ref.replace('#/components/', '').replace('/', '.'),
        );
      } else {
        return p;
      }
    }),
    'in',
  );
};
