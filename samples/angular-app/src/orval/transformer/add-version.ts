import { defineTransformer } from 'orval';

const HTTP_VERBS = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

export default defineTransformer((inputSchema) => ({
  ...inputSchema,
  paths: Object.entries(inputSchema.paths ?? {}).reduce(
    (acc, [path, pathItem]) => ({
      ...acc,
      [`/v{version}${path}`]: Object.entries(pathItem ?? {}).reduce(
        (pathItemAcc, [verb, operation]) => {
          if (
            !HTTP_VERBS.has(verb) ||
            !operation ||
            typeof operation !== 'object'
          ) {
            return {
              ...pathItemAcc,
              [verb]: operation,
            };
          }

          const parameters =
            'parameters' in operation ? operation.parameters : undefined;
          const existingParameters = Array.isArray(parameters)
            ? parameters
            : [];

          const filteredParameters = existingParameters.filter((parameter) => {
            if (!parameter || typeof parameter !== 'object') {
              return true;
            }

            return !(
              'in' in parameter &&
              'name' in parameter &&
              parameter.in === 'path' &&
              parameter.name === 'version'
            );
          });

          return {
            ...pathItemAcc,
            [verb]: {
              ...operation,
              parameters: [
                ...filteredParameters,
                {
                  name: 'version',
                  in: 'path',
                  required: true,
                  schema: {
                    type: 'integer',
                    default: 1,
                  },
                },
              ],
            },
          };
        },
        {},
      ),
    }),
    {},
  ),
}));
