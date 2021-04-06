import { PathItemObject } from 'openapi3-ts';
import { ContextSpecs, OutputOptions } from '../../types';
import { GeneratorApiResponse, GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { getRoute } from '../getters/route';
import { generateClient } from './client';
import { generateVerbsOptions } from './verbsOptions';

export const generateApi = async ({
  output,
  context,
}: {
  output?: OutputOptions;
  context: ContextSpecs;
}) => {
  return asyncReduce(
    Object.entries(context.specs[context.specKey].paths),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      const verbsOptions = await generateVerbsOptions({
        verbs,
        output,
        route,
        context,
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

      const client = await generateClient(output?.client, verbsOptions, {
        route,
        pathRoute,
        override: output?.override,
        context,
        mock: !!output?.mock,
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
