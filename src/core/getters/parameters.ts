import {
  ComponentsObject,
  ParameterObject,
  ReferenceObject,
} from 'openapi3-ts';
import { InputTarget } from '../../types';
import { GetterParameters } from '../../types/getters';
import { asyncReduce } from '../../utils/async-reduce';
import { useContext } from '../../utils/context';
import { isReference } from '../../utils/is';
import { getRefInfo } from './ref';

const getRefParameters = async ({
  parameter,
  components,
  target,
}: {
  parameter: ParameterObject | ReferenceObject;
  components?: ComponentsObject;
  target: InputTarget;
}): Promise<ParameterObject> => {
  if (isReference(parameter)) {
    const { name, specKey } = await getRefInfo(parameter.$ref, target);

    if (specKey) {
      const [context] = useContext();
      const refParameter =
        context.specs[specKey].spec.components?.parameters?.[name];

      return getRefParameters({
        parameter: refParameter!,
        components: context.specs[specKey].spec.components,
        target,
      });
    }

    return getRefParameters({
      parameter: components?.parameters?.[name]!,
      components,
      target,
    });
  }

  return parameter;
};

export const getParameters = async ({
  parameters = [],
  components,
  target,
}: {
  parameters: (ReferenceObject | ParameterObject)[];
  components?: ComponentsObject;
  target: InputTarget;
}): Promise<GetterParameters> => {
  return asyncReduce(
    parameters,
    async (acc, p) => {
      if (isReference(p)) {
        const { name, specKey } = await getRefInfo(p.$ref, target);

        const [context] = useContext();
        const parameter = specKey
          ? context.specs[specKey].spec.components?.parameters?.[name]
          : components?.parameters?.[name];

        const refParameter = await getRefParameters({
          parameter: parameter!,
          components,
          target,
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
