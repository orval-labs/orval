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
  zod: {
    input: '../specifications/petstore.yaml',
    output: {
      client({ zod }) {
        return {
          title: zod.title,
          footer: zod.footer,
          client: zod.client,
          header: zod.header,
          dependencies: zod.dependencies,
          async extraFiles(verbOptions, output, context) {
            return [
              ...(zod.extraFiles
                ? await zod.extraFiles(verbOptions, output, context)
                : []),
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
