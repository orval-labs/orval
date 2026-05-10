import { defineConfig } from 'orval';

export default defineConfig({
  inline: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/inline/endpoints.ts',
      schemas: '../generated/factory-methods/inline/model',
      factoryMethods: {
        generate: true,
        mode: 'inline-with-schema',
      },
      clean: true,
      prettier: true,
    },
  },
  separate: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/separate/endpoints.ts',
      schemas: '../generated/factory-methods/separate/model',
      factoryMethods: {
        generate: true,
        mode: 'separate-file',
      },
      clean: true,
      prettier: true,
    },
  },
  combined: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/combined/endpoints.ts',
      schemas: '../generated/factory-methods/combined/model',
      factoryMethods: {
        generate: true,
        mode: 'combined-separate-file',
      },
      clean: true,
      prettier: true,
    },
  },
});
