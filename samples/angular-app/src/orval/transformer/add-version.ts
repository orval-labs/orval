import type { InputTransformerFn } from 'orval';

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

          return {
            ...pathItemAcc,
            [verb]: {
              ...operation,
              parameters: [
                ...(operation.parameters || []).filter(
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
