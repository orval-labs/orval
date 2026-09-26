import { defineConfig } from 'orval';

export default defineConfig({
  logLevel: 'error',
  inline: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/inline/endpoints.ts',
      schemas: '../generated/factory-methods/inline/model',
      factoryMethods: {
        mode: 'single',
      },
      clean: true,
      formatter: 'prettier',
    },
  },
  separate: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/separate/endpoints.ts',
      schemas: '../generated/factory-methods/separate/model',
      factoryMethods: {
        mode: 'split',
      },
      clean: true,
      formatter: 'prettier',
    },
  },
  combined: {
    input: '../specifications/factory-methods.yaml',
    output: {
      target: '../generated/factory-methods/combined/endpoints.ts',
      schemas: '../generated/factory-methods/combined/model',
      factoryMethods: {
        mode: 'single-split',
      },
      clean: true,
      formatter: 'prettier',
    },
  },
});
