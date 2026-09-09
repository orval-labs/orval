import { resolveRef } from '../resolvers/ref';
import type {
  ContextSpec,
  GetterParameters,
  OpenApiParameterObject,
  OpenApiReferenceObject,
} from '../types';
import { isReference } from '../utils';
import { getRefInfo, isComponentRef } from './ref';

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
      const { schema } = resolveRef(p, context);
      const parameter = schema as OpenApiParameterObject;

      const location = parameter.in;
      if (
        location === 'path' ||
        location === 'query' ||
        location === 'header'
      ) {
        // Refs that don't target a named component slot (e.g. bundler-emitted
        // `#/paths/.../parameters/0`) have no corresponding `export type` from
        // `generateParameterDefinition`, so emitting a named import would
        // dangle. Inline the resolved parameter's schema instead. Mirrors the
        // #398 fix in `resolvers/value.ts`. See issue #1879.
        // Operation params reference the reusable parameter alias itself. Any
        // schema refs nested inside that parameter are imported by the generated
        // `components.parameters` alias, so they must not be forwarded here.
        const componentRefInfo =
          p.$ref && isComponentRef(p.$ref)
            ? getRefInfo(p.$ref, context)
            : undefined;
        const safeImports = componentRefInfo
          ? [
              {
                name: componentRefInfo.name,
                schemaName: componentRefInfo.originalName,
              },
            ]
          : [];
        result[location].push({ parameter, imports: safeImports });
      }
    } else {
      if (p.in === 'query' || p.in === 'path' || p.in === 'header') {
        result[p.in].push({ parameter: p, imports: [] });
      }
    }
  }

  // Parameters are unique by their name and location. Callers provide
  // path-level parameters first and operation-level parameters last, so
  // replacing an existing entry applies the operation-level override. HTTP
  // header names are case-insensitive, unlike names in the other locations.
  for (const location of ['path', 'query', 'header'] as const) {
    result[location] = [
      ...new Map(
        result[location].map((entry) => [
          location === 'header'
            ? entry.parameter.name?.toLowerCase()
            : entry.parameter.name,
          entry,
        ]),
      ).values(),
    ];
  }

  return result;
}
