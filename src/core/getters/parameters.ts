import { ParameterObject, ReferenceObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GetterParameters } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { isReference } from '../../utils/is';
import { getRefInfo } from './ref';

const getRefParameters = async ({
  parameter,
  context,
}: {
  parameter: ParameterObject | ReferenceObject;
  context: ContextSpecs;
}): Promise<ParameterObject> => {
  if (isReference(parameter)) {
    const { name, specKey } = await getRefInfo(parameter.$ref, context);

    const refParameter =
      context.specs[specKey || context.specKey].components?.parameters?.[name];

    return getRefParameters({
      parameter: refParameter!,
      context: { ...context, specKey: specKey || context.specKey },
    });
  }

  return parameter;
};

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
        const { name, specKey } = await getRefInfo(p.$ref, context);

        const parameter =
          context.specs[specKey || context.specKey].components?.parameters?.[
            name
          ];
        const refParameter = await getRefParameters({
          parameter: parameter!,
          context,
        });

        if (refParameter.in === 'path' || refParameter.in === 'query') {
          return {
            ...acc,
            [refParameter.in]: [...acc[refParameter.in], refParameter],
          };
        }

        return acc;
      } else {
        if (p.in !== 'query' && p.in !== 'path') {
          return acc;
        }
        return { ...acc, [p.in]: [...acc[p.in], p] };
      }
    },
    {
      path: [],
      query: [],
    } as {
      path: ParameterObject[];
      query: ParameterObject[];
    },
  );
};
