type Operation = {
  parameters?: unknown[];
  [key: string]: unknown;
};

type OpenApiDocument = {
  paths?: Record<string, Record<string, Operation | undefined> | undefined>;
  [key: string]: unknown;
};

type InputTransformerFn = (spec: OpenApiDocument) => OpenApiDocument;

type OperationParameter = {
  name?: string;
  in?: string;
} & Record<string, unknown>;

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

const transformer: InputTransformerFn = (inputSchema) => ({
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
            return { ...pathItemAcc, [verb]: operation };
          }

          const safeParameters = (operation as { parameters?: unknown })
            .parameters;
          const operationParameters = Array.isArray(safeParameters)
            ? (safeParameters as OperationParameter[])
            : [];

          return {
            ...pathItemAcc,
            [verb]: {
              ...operation,
              parameters: [
                ...operationParameters.filter(
                  (p) => !(p.name === 'version' && p.in === 'path'),
                ),
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
});

export default transformer;
