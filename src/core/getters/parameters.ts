import { ParameterObject, ReferenceObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GetterParameters } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { isReference } from '../../utils/is';
import { resolveRef } from '../resolvers/ref';

export const getParameters = async ({
  parameters = [],
  context,
}: {
  parameters: (ReferenceObject | ParameterObject)[];
  context: ContextSpecs;
}): Promise<GetterParameters> => {
  return asyncReduce(
    parameters,
    async (acc, p) => {
      if (isReference(p)) {
        const {
          schema: parameter,
          imports,
        } = await resolveRef<ParameterObject>(p, context);

        if (parameter.in === 'path' || parameter.in === 'query') {
          return {
            ...acc,
            [parameter.in]: [...acc[parameter.in], { parameter, imports }],
          };
        }

        return acc;
      } else {
        if (p.in !== 'query' && p.in !== 'path') {
          return acc;
        }
        return {
          ...acc,
          [p.in]: [...acc[p.in], { parameter: p, imports: [] }],
        };
      }
    },
    {
      path: [],
      query: [],
    } as GetterParameters,
  );
};
