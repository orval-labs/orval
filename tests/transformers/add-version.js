import { defineTransformer } from 'orval';

export default defineTransformer((inputSchema) => {
  /** @type {Record<string, Record<string, unknown>>} */
  const paths = {};

  for (const [path, pathItem] of Object.entries(inputSchema.paths)) {
    /** @type {Record<string, unknown>} */
    const nextPathItem = {};

    for (const [verb, operation] of Object.entries(pathItem)) {
      const operationObject =
        operation && typeof operation === 'object'
          ? /** @type {Record<string, unknown>} */ (operation)
          : {};
      /** @type {unknown[]} */
      const parameters = [];
      if (Array.isArray(operationObject.parameters)) {
        for (const parameter of operationObject.parameters) {
          parameters.push(/** @type {unknown} */ (parameter));
        }
      }
      parameters.push({
        name: 'version',
        in: 'path',
        required: true,
        schema: {
          type: 'number',
          default: 1,
        },
      });

      nextPathItem[verb] = {
        ...operationObject,
        parameters,
      };
    }

    paths[`/v{version}${path}`] = nextPathItem;
  }

  return {
    ...inputSchema,
    paths,
  };
});
