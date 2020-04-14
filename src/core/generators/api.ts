import { OpenAPIObject, PathItemObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { GeneratorApiResponse, GeneratorSchema } from '../../types/generator';
import { getRoute } from '../getters/route';
import { generateClient } from './client';
import { generateVerbsOptions } from './verbsOptions';

export const generateApi = (
  specs: OpenAPIObject,
  override?: OverrideOutput,
) => {
  return Object.entries(specs.paths).reduce<GeneratorApiResponse>(
    (acc, [pathRoute, verbs]: [string, PathItemObject]) => {
      const route = getRoute(pathRoute);

      const verbsOptions = generateVerbsOptions({
        verbs,
        override,
        route,
        components: specs.components,
      });

      const schemas = verbsOptions.reduce<GeneratorSchema[]>(
        (acc, { queryParams, body, response }) => [
          ...acc,
          ...(queryParams ? [queryParams] : []),
          ...body.schemas,
          ...response.schemas,
        ],
        [],
      );

      const client = generateClient(verbsOptions, {
        route,
        specs,
        override,
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
