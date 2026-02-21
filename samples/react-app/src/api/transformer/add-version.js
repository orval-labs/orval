import { defineTransformer } from 'orval';

export default defineTransformer((inputSchema) => ({
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
}));
