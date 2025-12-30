import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterParameters,
  OpenApiParameterObject,
  OpenApiReferenceObject,
} from '../types';
import { isReference } from '../utils';

interface GetParametersOptions {
  parameters: (OpenApiReferenceObject | OpenApiParameterObject)[];
  context: ContextSpec;
}

export function getParameters({
  parameters,
  context,
}: GetParametersOptions): GetterParameters {
  return parameters.reduce<GetterParameters>(
    (acc, p) => {
      if (isReference(p)) {
        const { schema: parameter, imports } =
          resolveRef<OpenApiParameterObject>(p, context);

        if (
          parameter.in === 'path' ||
          parameter.in === 'query' ||
          parameter.in === 'header'
        ) {
          acc[parameter.in].push({ parameter, imports });
        }
      } else {
        if (p.in === 'query' || p.in === 'path' || p.in === 'header') {
          acc[p.in].push({ parameter: p, imports: [] });
        }
      }

      return acc;
    },
    {
      path: [],
      query: [],
      header: [],
    },
  );
}
