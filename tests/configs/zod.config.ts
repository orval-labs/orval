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
            query: {
              name: 'stripNill',
              path: '../mutators/zod-preprocess.ts',
            },
            param: {
              name: 'stripNill',
              path: '../mutators/zod-preprocess.ts',
            },
            header: {
              name: 'stripNill',
              path: '../mutators/zod-preprocess.ts',
            },
            body: {
              name: 'stripNill',
              path: '../mutators/zod-preprocess.ts',
            },
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  additionalProperties: {
    output: {
      target: '../generated/zod',
      client: 'zod',
    },
    input: {
      target: '../specifications/translation.yaml',
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
  importFromSubdirectory: {
    output: {
      target: '../generated/zod/import-from-subdirectory.ts',
      client: 'zod',
    },
    input: '../specifications/import-from-subdirectory/petstore.yaml',
  },
  dateTimeOptions: {
    output: {
      target: '../generated/zod/date-time-options.ts',
      client: 'zod',
      override: {
        zod: {
          dateTimeOptions: {
            offset: true,
            precision: 3,
          },
        },
      },
    },
    input: {
      target: '../specifications/format.yaml',
    },
  },
  timeOptions: {
    output: {
      target: '../generated/zod/time-options.ts',
      client: 'zod',
      override: {
        zod: {
          timeOptions: {
            precision: -1,
          },
        },
      },
    },
    input: {
      target: '../specifications/format.yaml',
    },
  },
  enums: {
    output: {
      target: '../generated/zod/enums.ts',
      client: 'zod',
    },
    input: {
      target: '../specifications/enums.yaml',
    },
  },
  'nullable-any-of-refs': {
    output: {
      target: '../generated/zod/nullable-any-of-refs.ts',
      client: 'zod',
    },
    input: {
      target: '../specifications/nullable-any-of-refs.yaml',
    },
  },
  'nullable-oneof-enums': {
    output: {
      target: '../generated/zod/nullable-oneof-enums.ts',
      client: 'zod',
    },
    input: {
      target: '../specifications/nullable-oneof-enums.yaml',
    },
  },
  'multiline-default': {
    output: {
      target: '../generated/zod/multiline-default.ts',
      client: 'zod',
    },
    input: '../specifications/multiline-default.yaml',
  },
  pattern: {
    output: {
      target: '../generated/zod/pattern.ts',
      client: 'zod',
    },
    input: '../specifications/pattern.yaml',
  },
  'pattern-and-format': {
    output: {
      target: '../generated/zod/pattern-and-format.ts',
      client: 'zod',
    },
    input: '../specifications/pattern-and-format.yaml',
  },
  'required-default-values': {
    output: {
      target: '../generated/zod/required-default-values.ts',
      client: 'zod',
    },
    input: '../specifications/zod-required-default-values.yaml',
  },
});
