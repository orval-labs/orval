export default {
  dartApi: {
    input: {
      target: 'http://localhost:8000/openapi.json',
    },
    output: {
      target: 'lib/generated/',
      client: 'dart',
      mode: 'single',
    },
  },
};
