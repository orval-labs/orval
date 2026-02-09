export default (spec) => {
  const paths = Object.entries(spec.paths);
  for (const [path, pathObject] of paths) {
    const operations = Object.entries(pathObject);
    for (const [verb, operation] of operations) {
      if (operation.parameters) {
        operation.parameters.push({
          name: 'api-version',
          in: 'header',
          schema: {
            type: 'string',
          },
        });
      }
    }
  }
  return spec;
};
