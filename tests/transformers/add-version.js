import { defineTransformer } from 'orval';

export default defineTransformer((inputSchema) => ({
  ...inputSchema,
  paths: Object.fromEntries(
    Object.entries(inputSchema.paths).map(([path, pathItem]) => [
      `/v{version}${path}`,
      Object.fromEntries(
        Object.entries(pathItem).map(([verb, operation]) => [
          verb,
          {
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
        ]),
      ),
    ]),
  ),
}));
