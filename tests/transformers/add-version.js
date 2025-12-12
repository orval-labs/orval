/**
 * @import { OpenAPIObject } from 'openapi3-ts/oas30'
 */

/**
 * Transformer function for orval.
 *
 * @param {OpenAPIObject} schema
 * @return {OpenAPIObject}
 */
export default (inputSchema) => ({
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
});
