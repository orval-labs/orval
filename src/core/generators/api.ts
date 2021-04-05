import { OpenAPIObject, PathItemObject } from 'openapi3-ts';
import { InputTarget, OutputOptions } from '../../types';
import { GeneratorApiResponse, GeneratorSchema } from '../../types/generator';
import { asyncReduce } from '../../utils/async-reduce';
import { getRoute } from '../getters/route';
import { generateClient } from './client';
import { generateVerbsOptions } from './verbsOptions';

export const generateApi = async ({
  specs,
  output,
  target,
}: {
  specs: OpenAPIObject;
  output?: OutputOptions;
  target: InputTarget;
}) => {
  return asyncReduce(
    Object.entries(specs.paths),
    async (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      const verbsOptions = await generateVerbsOptions({
        verbs,
        output,
        route,
        components: specs.components,
        target,
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
        specs,
        override: output?.override,
        target,
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
