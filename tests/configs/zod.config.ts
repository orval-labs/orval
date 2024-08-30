import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/zod',
      client: 'zod',
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
  petstore: {
    output: {
      target: '../generated/zod/petstore/endpoints.ts',
      schemas: '../generated/zod/petstore/model',
      client: 'zod',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/zod/petstore-tags-split/endpoints.ts',
      schemas: '../generated/zod/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'zod',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/zod/split/endpoints.ts',
      schemas: '../generated/zod/split/model',
      mock: true,
      mode: 'split',
      client: 'zod',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/zod/tags/endpoints.ts',
      schemas: '../generated/zod/tags/model',
      mock: true,
      mode: 'tags',
      client: 'zod',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  nestedArrays: {
    output: {
      target: '../generated/zod',
      client: 'zod',
    },
    input: {
      target: '../specifications/arrays.yaml',
    },
  },
  strictMode: {
    output: {
      target: '../generated/zod/strict-mode.ts',
      client: 'zod',
      override: {
        zod: {
          strict: {
            response: true,
            query: true,
            header: true,
            param: true,
            body: true,
          },
        },
      },
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
  coerce: {
    output: {
      target: '../generated/zod/coerce.ts',
      client: 'zod',
      override: {
        zod: {
          coerce: {
            response: true,
            query: true,
            header: true,
            param: true,
            body: true,
          },
        },
      },
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
  preprocess: {
    output: {
      target: '../generated/zod/preprocess.ts',
      client: 'zod',
      override: {
        zod: {
          preprocess: {
            response: {
              name: 'stripNill',
              path: '../mutators/zod-preprocess.ts',
            },
          },
        },
      },
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
  additionalProperties: {
    output: {
      target: '../generated/zod',
      client: 'zod',
    },
    input: {
      target: '../specifications/additional-properties.yaml',
    },
  },
  typedArraysTuplesV31: {
    output: {
      target: '../generated/zod/typed-arrays-tuples-v3-1.ts',
      client: 'zod',
    },
    input: {
      target: '../specifications/typed-arrays-tuples-v3-1.yaml',
    },
  },
});
