import { GeneratorSchema } from '../../types/generator';
import { GetterBody, GetterParams, GetterProps } from '../../types/getters';
import { sortByPriority } from '../../utils/sort';

export const getProps = ({
  body,
  queryParams,
  params,
}: {
  body: GetterBody;
  queryParams?: GeneratorSchema;
  params: GetterParams;
}): GetterProps => {
  const bodyProp = {
    definition: `${body.implementation}: ${body.definition}`,
    implementation: `${body.implementation}: ${body.definition}`,
    default: false,
    required: true,
  };

  const queryParamsProp = {
    definition: `params?: ${queryParams?.name}`,
    implementation: `params?: ${queryParams?.name}`,
    default: false,
    required: false,
  };

  const props = [
    ...params,
    ...(body.definition ? [bodyProp] : []),
    ...(queryParams ? [queryParamsProp] : []),
  ];

  const sortedProps = sortByPriority(props);

  const definition =
    sortedProps.map(({ definition }) => definition).join(',\n    ') + ',';

  const implementation =
    sortedProps.map(({ implementation }) => implementation).join(',\n    ') +
    ',';

  return { definition, implementation };
};
