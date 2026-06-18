import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/axios/petstore/endpoints.ts',
      schemas: '../generated/axios/petstore/model',
      mock: true,
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  zodSchemaResponse: {
    output: {
      target: '../generated/axios/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/axios/zod-schema-response/model',
      },
      mock: true,
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  zodNodeNext: {
    output: {
      target: '../generated/axios/zod-nodenext/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/axios/zod-nodenext/model',
      },
      client: 'zod',
      tsconfig: {
        compilerOptions: {
          module: 'nodenext',
        },
      },
      override: {
        zod: {
          generateReusableSchemas: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/axios/mutator/endpoints.ts',
      schemas: '../generated/axios/mutator/model',
      mock: true,
      client: 'axios',
      override: {
        mutator: '../mutators/custom-client.ts',
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  multiArguments: {
    output: {
      target: '../generated/axios/multi-arguments/endpoints.ts',
      schemas: '../generated/axios/multi-arguments/model',
      mock: true,
      client: 'axios',
      override: {
        mutator: '../mutators/multi-arguments.ts',
      },
      clean: true,
      formatter: 'prettier',
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
      target: '../generated/axios/petstore-tags-split/endpoints.ts',
      schemas: '../generated/axios/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitNodeNext: {
    output: {
      target: '../generated/axios/petstore-tags-split-nodenext/endpoints.ts',
      mode: 'tags-split',
      client: 'axios',
      tsconfig: {
        compilerOptions: {
          module: 'nodenext',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitNodeNextWorkspace: {
    output: {
      target: './endpoints.ts',
      workspace: '../generated/axios/petstore-tags-split-nodenext-workspace/',
      mode: 'tags-split',
      client: 'axios',
      indexFiles: true,
      tsconfig: {
        compilerOptions: {
          module: 'nodenext',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitNodeNextMutator: {
    output: {
      target: '../generated/axios/petstore-tags-split-nodenext-mutator/endpoints.ts',
      mode: 'tags-split',
      client: 'axios',
      tsconfig: {
        compilerOptions: {
          module: 'nodenext',
        },
      },
      override: {
        mutator: '../mutators/custom-client.ts',
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitWorkspaceGeneratedExt: {
    output: {
      target: './endpoints.generated.ts',
      workspace:
        '../generated/axios/petstore-tags-split-workspace-generated-ext/',
      mode: 'tags-split',
      client: 'axios',
      indexFiles: true,
      fileExtension: '.generated.ts',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitSchemas: {
    output: {
      target:
        '../generated/axios/petstore-tags-split-schemas/endpoints.ts',
      schemas: {
        path: '../generated/axios/petstore-tags-split-schemas/model',
        type: 'typescript',
        splitByTags: true,
      },
      mock: true,
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  tagsSplitSharedModels: {
    output: {
      target:
        '../generated/axios/tags-split-shared-models/endpoints.ts',
      schemas: {
        path: '../generated/axios/tags-split-shared-models/model',
        type: 'typescript',
        splitByTags: true,
      },
      mock: true,
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/tags-split-shared.yaml',
    },
  },
  splitModeSplitSchemas: {
    output: {
      target: '../generated/axios/split-mode-split-schemas/endpoints.ts',
      schemas: {
        path: '../generated/axios/split-mode-split-schemas/model',
        type: 'typescript',
        splitByTags: true,
      },
      mode: 'split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/tags-split-shared.yaml',
    },
  },
  splitByTagsFakerSchemasNoIndex: {
    output: {
      target:
        '../generated/axios/split-by-tags-faker-schemas-no-index/endpoints.ts',
      schemas: {
        path: '../generated/axios/split-by-tags-faker-schemas-no-index/model',
        type: 'typescript',
        splitByTags: true,
      },
      indexFiles: false,
      mock: {
        generators: [{ type: 'faker', schemas: true }],
      },
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/tags-split-shared.yaml',
    },
  },
  petstoreTagsSplitZodSchemas: {
    output: {
      target:
        '../generated/axios/petstore-tags-split-zod-schemas/endpoints.ts',
      schemas: {
        path: '../generated/axios/petstore-tags-split-zod-schemas/model',
        type: 'zod',
        splitByTags: true,
      },
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTagsSplitZodReusableSchemas: {
    output: {
      target:
        '../generated/axios/petstore-tags-split-zod-reusable/endpoints.ts',
      schemas: {
        path: '../generated/axios/petstore-tags-split-zod-reusable/model',
        type: 'zod',
        splitByTags: true,
      },
      mode: 'tags-split',
      client: 'zod',
      override: {
        zod: {
          generateReusableSchemas: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/tags-split-shared.yaml',
    },
  },
  petstoreTagsSplitMutator: {
    output: {
      target: '../generated/axios/petstore-tags-split-mutator/endpoints.ts',
      schemas: '../generated/axios/petstore-tags-split-mutator/model',
      mock: true,
      mode: 'tags-split',
      client: 'axios',
      override: {
        mutator: '../mutators/custom-client.ts',
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/axios/split/endpoints.ts',
      schemas: '../generated/axios/split/model',
      mock: true,
      mode: 'split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/axios/tags/endpoints.ts',
      schemas: '../generated/axios/tags/model',
      mock: true,
      mode: 'tags',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  namedParameters: {
    output: {
      target: '../generated/axios/named-parameters/endpoints.ts',
      schemas: '../generated/axios/named-parameters/model',
      client: 'axios-functions',
      override: {
        useNamedParameters: true,
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  issue3330: {
    output: {
      target: '../generated/axios/issue-3330/endpoints.ts',
      schemas: '../generated/axios/issue-3330/model',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3330.yaml',
    },
  },
});
