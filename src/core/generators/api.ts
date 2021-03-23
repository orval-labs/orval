import { OpenAPIObject, PathItemObject } from 'openapi3-ts';
import { OutputOptions } from '../../types';
import { GeneratorApiResponse, GeneratorSchema } from '../../types/generator';
import { getRoute } from '../getters/route';
import { generateClient } from './client';
import { generateVerbsOptions } from './verbsOptions';

export const generateApi = (
  workspace: string,
  specs: OpenAPIObject,
  options?: OutputOptions,
) => {
  return Object.entries(specs.paths).reduce<GeneratorApiResponse>(
    (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      const verbsOptions = generateVerbsOptions({
        workspace,
        verbs,
        options,
        route,
        components: specs.components,
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

      const client = generateClient(options?.client, verbsOptions, {
        route,
        pathRoute,
        specs,
        override: options?.override,
        mock: !!options?.mock,
      });

      return {
        schemas: [...acc.schemas, ...schemas],
        operations: { ...acc.operations, ...client },
      };
    },
    {
      operations: {},
      schemas: [],
    },
  );
};
