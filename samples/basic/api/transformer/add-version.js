import { defineTransformer } from 'orval';

/**
 * Prefixes every path with `/v{version}` and adds a required `version` path
 * parameter.
 *
 * @type {Parameters<typeof import('orval').defineTransformer>[0]}
 */
const addVersion = (inputSchema) => ({
  ...inputSchema,
  paths: Object.entries(inputSchema.paths).reduce(
    (acc, [path, pathItem]) => ({
      ...acc,
      [`/v{version}${path}`]: Object.entries(pathItem).reduce(
        (pathItemAcc, [verb, operation]) => ({
          ...pathItemAcc,
          [verb]: {
            ...operation,
            parameters: [
              ...(operation.parameters || []),
              {
                name: 'version',
                in: 'path',
                required: true,
                schema: {
                  type: 'number',
                  default: 1,
                },
              },
            ],
          },
        }),
        {},
      ),
    }),
    {},
  ),
});

export default defineTransformer(addVersion);
