type Operation = {
  parameters?: unknown[];
  [key: string]: unknown;
};

type OpenApiDocument = {
  paths?: Record<string, Record<string, Operation | undefined> | undefined>;
  [key: string]: unknown;
};

type InputTransformerFn = (spec: OpenApiDocument) => OpenApiDocument;

const transformer: InputTransformerFn = (inputSchema) => ({
  ...inputSchema,
  paths: Object.entries(inputSchema.paths ?? {}).reduce(
    (acc, [path, pathItem]) => ({
      ...acc,
      [`/v{version}${path}`]: Object.entries(pathItem ?? {}).reduce(
        (pathItemAcc, [verb, operation]) => ({
          ...(() => {
            const safeOperation = operation ?? {};

            return {
              ...pathItemAcc,
              [verb]: {
                ...safeOperation,
                parameters: [
                  ...(Array.isArray(safeOperation.parameters)
                    ? safeOperation.parameters
                    : []),
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
            };
          })(),
        }),
        {},
      ),
    }),
    {},
  ),
});

export default transformer;
