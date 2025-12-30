/**
 * Transformer function for orval.
 *
 * @param {OpenAPIObject} schema
 * @return {OpenAPIObject}
 */
export default (inputSchema) => {
  const transformedPaths = {};

  Object.entries(inputSchema.paths).forEach(([path, pathItem]) => {
    const transformedPathItem = {};

    if (path === '/api/v1/user/logout') {
      // for testing special case with no parameters
      transformedPaths[path] = pathItem;
      return;
    }

    Object.entries(pathItem).forEach(([verb, operation]) => {
      transformedPathItem[verb] = {
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
      };
    });

    transformedPaths[`/v{version}${path}`] = transformedPathItem;
  });

  return {
    ...inputSchema,
    paths: transformedPaths,
  };
};
