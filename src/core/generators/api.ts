import { PathItemObject } from 'openapi3-ts';
import { ContextSpecs, NormalizedOutputOptions } from '../../types';
import { GeneratorApiResponse, GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { isReference } from '../../utils/is';
import { getRoute } from '../getters/route';
import { resolveRef } from '../resolvers/ref';
import { generateClient } from './client';
import { generateVerbsOptions } from './verbsOptions';

export const generateApi = async ({
  output,
  context,
}: {
  output: NormalizedOutputOptions;
  context: ContextSpecs;
}) => {
  return asyncReduce(
    Object.entries(context.specs[context.specKey].paths),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      let resolvedVerbs = verbs;
      let resolvedContext = context;

      if (isReference(verbs)) {
        const { schema, imports } = await resolveRef(verbs, context);

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

      const verbsOptions = await generateVerbsOptions({
        verbs: resolvedVerbs,
        output,
        route,
        context: resolvedContext,
      });

      const schemas = verbsOptions.reduce<GeneratorSchema[]>(
        (acc, { queryParams, body, response }) => {
          if (queryParams) {
            acc.push(queryParams.schema, ...queryParams.deps);
          }

          acc.push(...body.schemas);
          acc.push(...response.schemas);

          return acc;
        },
        [],
      );

      const client = await generateClient(output.client, verbsOptions, {
        route,
        pathRoute,
        override: output.override,
        context: resolvedContext,
        mock: !!output.mock,
        injected: output.client === 'axios-injected',
        objectParams: output.objectParams,
      });

      acc.schemas.push(...schemas);
      acc.operations = { ...acc.operations, ...client };

      return acc;
    },
    {
      operations: {},
      schemas: [],
    } as GeneratorApiResponse,
  );
};
