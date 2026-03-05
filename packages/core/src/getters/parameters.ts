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
  const result: GetterParameters = { path: [], query: [], header: [] };
  for (const p of parameters) {
    if (isReference(p)) {
      const { schema: parameter, imports } = resolveRef<OpenApiParameterObject>(
        p,
        context,
      );

      if (
        parameter.in === 'path' ||
        parameter.in === 'query' ||
        parameter.in === 'header'
      ) {
        result[parameter.in].push({ parameter, imports });
      }
    } else {
      if (p.in === 'query' || p.in === 'path' || p.in === 'header') {
        result[p.in].push({ parameter: p, imports: [] });
      }
    }
  }
  return result;
}
