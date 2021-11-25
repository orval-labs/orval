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
                specKey: imports[imports.length - 1].specKey,
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
        (acc, { queryParams, body, response }) => [
          ...acc,
          ...(queryParams ? [queryParams.schema, ...queryParams.deps] : []),
          ...body.schemas,
          ...response.schemas,
        ],
        [],
      );

      const client = await generateClient(output.client, verbsOptions, {
        route,
        pathRoute,
        override: output.override,
        context: resolvedContext,
        mock: !!output.mock,
      });

      return {
        schemas: [...acc.schemas, ...schemas],
        operations: { ...acc.operations, ...client },
      };
    },
    {
      operations: {},
      schemas: [],
    } as GeneratorApiResponse,
  );
};
