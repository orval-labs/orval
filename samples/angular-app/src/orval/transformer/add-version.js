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

const transformer = (inputSchema) => ({
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

          const existingParameters = Array.isArray(operation.parameters)
            ? operation.parameters
            : [];

          const filteredParameters = existingParameters.filter(
            (parameter) =>
              !(
                parameter &&
                parameter.in === 'path' &&
                parameter.name === 'version'
              ),
          );

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
});

export default transformer;
