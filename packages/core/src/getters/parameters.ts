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
      const { schema, imports } = resolveRef(p, context);
      const parameter = schema as OpenApiParameterObject;

      const location = parameter.in;
      if (
        location === 'path' ||
        location === 'query' ||
        location === 'header'
      ) {
        result[location].push({ parameter, imports });
      }
    } else {
      if (p.in === 'query' || p.in === 'path' || p.in === 'header') {
        result[p.in].push({ parameter: p, imports: [] });
      }
    }
  }
  return result;
}
