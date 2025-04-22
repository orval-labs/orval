import { defineConfig } from 'orval';

export default defineConfig({
  reactQuery: {
    input: '../specifications/petstore.yaml',
    output: {
      client: 'react-query',
      mode: 'tags-split',
      schemas: '../models',
      target: './will-not-exists.ts',
      workspace: '../generated/multi-client/react-query',
      indexFiles: {
        workspace(implementations) {
          return implementations.filter((impl) => !impl.includes('models'));
        },
      },
    },
  },
  fetch: {
    input: '../specifications/petstore.yaml',
    output: {
      client: 'fetch',
      mode: 'tags-split',
      schemas: '../models',
      target: './will-not-exists.ts',
      workspace: '../generated/multi-client/fetch',
      indexFiles: {
        workspace(implementations) {
          return implementations.filter((impl) => !impl.includes('models'));
        },
      },
    },
  },
  zod: {
    input: '../specifications/petstore.yaml',
    output: {
      client({ zod }) {
        return {
          client: zod.client,
          async extraFiles(_, __, context) {
            return [
              {
                path: context.output.workspace + '/extrafiles/index.ts',
                content: 'export * from "./file1";\nexport * from "./file2";\n',
                exposeIndexFile: true,
              },
              {
                path: context.output.workspace + '/extrafiles/file1.ts',
                content: 'export const extraFile1 = "extraFile1"',
              },
              {
                path: context.output.workspace + '/extrafiles/file2.ts',
                content: 'export const extraFile2 = "extraFile2"',
              },
            ];
          },
        };
      },
      mode: 'tags-split',
      schemas: '../models',
      target: './will-not-exists.ts',
      workspace: '../generated/multi-client/zod',
      indexFiles: {
        workspace(implementations) {
          return implementations.filter((impl) => !impl.includes('models'));
        },
      },
    },
  },
});
