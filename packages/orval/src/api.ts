import {
  asyncReduce,
  type ContextSpecs,
  generateVerbsOptions,
  type GeneratorApiBuilder,
  type GeneratorApiOperations,
  type GeneratorSchema,
  getFullRoute,
  getRoute,
  GetterPropType,
  isReference,
  type NormalizedInputOptions,
  type NormalizedOutputOptions,
  resolveRef,
} from '@orval/core';
import { generateMockImports } from '@orval/mock';
import type { PathItemObject } from 'openapi3-ts/oas30';

import {
  generateClientFooter,
  generateClientHeader,
  generateClientImports,
  generateClientTitle,
  generateExtraFiles,
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
    Object.entries(context.specs[context.specKey].paths ?? {}),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      let resolvedVerbs = verbs;
      let resolvedContext = context;

      if (isReference(verbs)) {
        const { schema, imports } = resolveRef<PathItemObject>(verbs, context);

        resolvedVerbs = schema;

        resolvedContext = {
          ...context,
          ...(imports.length > 0
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
        pathRoute,
        context: resolvedContext,
      });

      // GitHub #564 check if we want to exclude deprecated operations
      if (output.override.useDeprecatedOperations === false) {
        verbsOptions = verbsOptions.filter((verb) => {
          return !verb.deprecated;
        });
      }

      const schemas = verbsOptions.reduce<GeneratorSchema[]>(
        (acc, { queryParams, headers, body, response, props }) => {
          if (props) {
            acc.push(
              ...props.flatMap((param) =>
                param.type === GetterPropType.NAMED_PATH_PARAMS
                  ? param.schema
                  : [],
              ),
            );
          }
          if (queryParams) {
            acc.push(queryParams.schema, ...queryParams.deps);
          }
          if (headers) {
            acc.push(headers.schema, ...headers.deps);
          }

          acc.push(...body.schemas, ...response.schemas);

          return acc;
        },
        [],
      );

      const fullRoute = getFullRoute(
        route,
        verbs.servers ?? context.specs[context.specKey].servers,
        output.baseUrl,
      );
      if (!output.target) {
        throw new Error('Output does not have a target');
      }
      const pathOperations = await generateOperations(
        output.client,
        verbsOptions,
        {
          route: fullRoute,
          pathRoute,
          override: output.override,
          context: resolvedContext,
          mock: output.mock,
          output: output.target,
        },
        output,
      );

      for (const verbOption of verbsOptions) {
        acc.verbOptions[verbOption.operationId] = verbOption;
      }
      acc.schemas.push(...schemas);
      acc.operations = { ...acc.operations, ...pathOperations };

      return acc;
    },
    {
      operations: {},
      verbOptions: {},
      schemas: [],
    } as GeneratorApiOperations,
  );

  const extraFiles = await generateExtraFiles(
    output.client,
    api.verbOptions,
    output,
    context,
  );

  return {
    operations: api.operations,
    schemas: api.schemas,
    verbOptions: api.verbOptions,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: generateMockImports,
    extraFiles,
  };
};
