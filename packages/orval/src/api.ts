import {
  asyncReduce,
  ContextSpecs,
  generateVerbsOptions,
  GeneratorApiBuilder,
  GeneratorApiOperations,
  GeneratorSchema,
  getRoute,
  isReference,
  NormalizedInputOptions,
  NormalizedOutputOptions,
  resolveRef,
} from '@orval/core';
import { generateMSWImports } from '@orval/msw';
import { PathItemObject } from 'openapi3-ts';
import {
  generateClientFooter,
  generateClientHeader,
  generateClientImports,
  generateClientTitle,
  generateOperations,
} from './client';

export const getApiBuilder = async ({
  input,
  output,
  context,
}: {
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  context: ContextSpecs;
}): Promise<GeneratorApiBuilder> => {
  const api = await asyncReduce(
    Object.entries(context.specs[context.specKey].paths),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      let resolvedVerbs = verbs;
      let resolvedContext = context;

      if (isReference(verbs)) {
        const { schema, imports } = resolveRef<PathItemObject>(verbs, context);

        resolvedVerbs = schema;

        resolvedContext = {
          ...context,
          ...(imports.length
            ? {
                specKey: imports[0].specKey,
              }
            : {}),
        };
      }

      let verbsOptions = await generateVerbsOptions({
        verbs: resolvedVerbs,
        input,
        output,
        route,
        context: resolvedContext,
      });

      // GitHub #564 check if we want to exclude deprecated operations
      if (output.override.useDeprecatedOperations === false) {
        verbsOptions = verbsOptions.filter((verb) => {
          return !verb.deprecated;
        });
      }

      const schemas = verbsOptions.reduce(
        (acc, { queryParams, headers, body, response }) => {
          if (queryParams) {
            acc.push(queryParams.schema, ...queryParams.deps);
          }
          if (headers) {
            acc.push(headers.schema, ...headers.deps);
          }

          acc.push(...body.schemas);
          acc.push(...response.schemas);

          return acc;
        },
        [] as GeneratorSchema[],
      );

      const pathOperations = await generateOperations(
        output.client,
        verbsOptions,
        {
          route,
          pathRoute,
          override: output.override,
          context: resolvedContext,
          mock: !!output.mock,
          output: output.target,
        },
      );

      acc.schemas.push(...schemas);
      acc.operations = { ...acc.operations, ...pathOperations };

      return acc;
    },
    {
      operations: {},
      schemas: [],
    } as GeneratorApiOperations,
  );

  return {
    operations: api.operations,
    schemas: api.schemas,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: generateMSWImports,
  };
};
