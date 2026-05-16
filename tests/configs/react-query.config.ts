import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/react-query/basic/endpoints.ts',
      schemas: '../generated/react-query/basic/model',
      client: 'react-query',
      mock: true,
      headers: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidates: {
    output: {
      target: '../generated/react-query/invalidates/endpoints.ts',
      schemas: '../generated/react-query/invalidates/model',
      client: 'react-query',
      mock: true,
      headers: true,
      override: {
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: [
                'listPets',
                // Bug 1 test: showPetById has required path param 'petId'
                // but no params mapping → should generate predicate-based
                // broad invalidation instead of broken getShowPetByIdQueryKey()
                'showPetById',
              ],
            },
            {
              onMutations: ['deletePetById'],
              invalidates: [
                'listPets',
                { query: 'showPetById', params: ['petId'] },
              ],
            },
            {
              // Issue #3152: literal string params (e.g. "@me") should be
              // emitted as string literals, not variable references.
              onMutations: ['createPets'],
              invalidates: [
                {
                  query: 'showPetById',
                  params: [{ literal: '@me' }],
                },
              ],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidatesTagsSplit: {
    output: {
      target: '../generated/react-query/invalidates-tags-split/endpoints.ts',
      schemas: '../generated/react-query/invalidates-tags-split/model',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        query: {
          mutationInvalidates: [
            {
              // Bug 2 test: createPets (pets tag) invalidates healthCheck
              // (health tag). In tags-split mode, file: './health' must
              // resolve to '../health/health', not './health'.
              onMutations: ['createPets'],
              invalidates: [{ query: 'healthCheck', file: './health' }],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidatesSplitQueryKey: {
    output: {
      target:
        '../generated/react-query/invalidates-split-query-key/endpoints.ts',
      schemas: '../generated/react-query/invalidates-split-query-key/model',
      client: 'react-query',
      override: {
        query: {
          shouldSplitQueryKey: true,
          mutationInvalidates: [
            {
              // shouldSplitQueryKey test: showPetById has required path
              // param but no params mapping → should generate partial
              // key matching with static route segments.
              onMutations: ['createPets'],
              invalidates: ['showPetById'],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Verifies that when a `mutationInvalidates` rule's `onMutations` list
  // references an operation that is forced into a Query hook via
  // `override.operations[*].query.useQuery`, the rule silently does not
  // fire (because it is wired only on Mutation hooks). Generation should
  // emit a logWarning explaining the misconfiguration. The snapshot
  // captures the resulting output: `createPets` is a Query hook with no
  // invalidation wiring, while `deletePetById` keeps its Mutation hook
  // and the invalidation wiring as usual.
  invalidatesQueryConflict: {
    output: {
      target:
        '../generated/react-query/invalidates-query-conflict/endpoints.ts',
      schemas: '../generated/react-query/invalidates-query-conflict/model',
      client: 'react-query',
      override: {
        operations: {
          createPets: {
            query: { useQuery: true },
          },
        },
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['listPets'],
            },
            {
              onMutations: ['deletePetById'],
              invalidates: ['listPets'],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Verifies that when a `mutationInvalidates` rule targets a non-GET
  // operation that has been routed to a Query hook (and thus carries the
  // verb-prefixed cache key), the broad-invalidation fallback path emits
  // a predicate / partial key that accounts for the verb prefix —
  // otherwise `queryKey[0].startsWith('/pets/')` would never match
  // `['DELETE', '/pets/${petId}']` and the invalidation would silently
  // no-op.
  invalidatesNonGetQueryTarget: {
    output: {
      target:
        '../generated/react-query/invalidates-non-get-query-target/endpoints.ts',
      schemas:
        '../generated/react-query/invalidates-non-get-query-target/model',
      client: 'react-query',
      override: {
        operations: {
          deletePetById: {
            query: { useQuery: true },
          },
        },
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['deletePetById'],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Verifies that when a non-GET operation is routed to a Query hook
  // (today via per-operation `useQuery: true`, soon globally via the fix
  // for #2376), and the user has configured a custom mutator that exports
  // a `BodyType<T>` wrapper, the generated Query helpers wrap the body
  // type with `BodyType<...>` to stay consistent with the request
  // function's signature. Without this, callers would hit a type error
  // (`CreatePetsBody` is not assignable to `BodyType<CreatePetsBody>`).
  // Closes #2376 — verifies the global `override.query.useQuery: true`
  // setting now propagates to non-GET verbs (POST/PUT/DELETE/PATCH) and
  // emits Query hooks for them, instead of being silently dropped on the
  // old `Verbs.GET ===` gate. The PR-D / PR-C / PR-B preparation PRs
  // ensure cache key collisions, custom-mutator BodyType, and
  // mutationInvalidates conflict warnings are already handled before
  // this gate is lifted.
  globalUseQueryAppliesToNonGet: {
    output: {
      target:
        '../generated/react-query/global-use-query-applies-to-non-get/endpoints.ts',
      schemas:
        '../generated/react-query/global-use-query-applies-to-non-get/model',
      client: 'react-query',
      override: {
        query: {
          useQuery: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Closes #2376 — verifies the previously-silent
  // `override.query.useMutation: false` setting now actually suppresses
  // Mutation hook generation for non-GET operations. Combined with
  // `useQuery: true`, it routes every non-GET operation to a Query hook
  // exclusively, which is the typical setup for APIs that use POST as a
  // read mechanism (e.g. complex search bodies).
  globalUseMutationFalseSuppressesMutationHooks: {
    output: {
      target:
        '../generated/react-query/global-use-mutation-false-suppresses-mutation-hooks/endpoints.ts',
      schemas:
        '../generated/react-query/global-use-mutation-false-suppresses-mutation-hooks/model',
      client: 'react-query',
      override: {
        query: {
          useQuery: true,
          useMutation: false,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Per-operation override now wins over a globally enabled hook
  // (#2376). Without this, `override.operations.<id>.query.useQuery:
  // false` was silently ignored when global `useQuery: true` was set,
  // contradicting the docs example for `override.operations` that uses
  // `useInfinite: false` to opt a single operation out.
  perOperationFalseDisablesGlobalTrue: {
    output: {
      target:
        '../generated/react-query/per-operation-false-disables-global-true/endpoints.ts',
      schemas:
        '../generated/react-query/per-operation-false-disables-global-true/model',
      client: 'react-query',
      override: {
        query: {
          useQuery: true,
        },
        operations: {
          createPets: {
            query: {
              useQuery: false,
            },
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Closes #3358 — a per-operation `override.operations.<id>.query.
  // useMutation: true` now routes a GET operation to a Mutation hook.
  // Previously the verb gate in `query-generator.ts` discarded explicit
  // `useMutation: true` for GET, so the operation stayed a Query hook —
  // the inverse asymmetry of the per-operation `useQuery: true` path
  // that already worked for non-GET verbs.
  perOperationUseMutationOnGet: {
    output: {
      target:
        '../generated/react-query/per-operation-use-mutation-on-get/endpoints.ts',
      schemas:
        '../generated/react-query/per-operation-use-mutation-on-get/model',
      client: 'react-query',
      override: {
        operations: {
          showPetById: {
            query: {
              useMutation: true,
            },
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Closes #2376 — explicit `override.query.useQuery: false` now
  // suppresses Query hook generation even for GET operations, falling
  // back to the Mutation hook (which is rarely useful for GET but is
  // the documented inverse behaviour and was previously silently
  // ignored). This is the defensive matrix entry that guards the
  // `useQuery: false` semantics.
  globalUseQueryFalseSuppressesGetQueryHooks: {
    output: {
      target:
        '../generated/react-query/global-use-query-false-suppresses-get-query-hooks/endpoints.ts',
      schemas:
        '../generated/react-query/global-use-query-false-suppresses-get-query-hooks/model',
      client: 'react-query',
      override: {
        query: {
          useQuery: false,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // The mutator deliberately uses a strict `BodyType<T> = { payload: T; metadata: ... }`
  // envelope so that any generated Query helper that still emits the raw body
  // type (rather than `BodyType<CreatePetsBody>`) would fail to compile. This
  // locks in that every user-facing surface — overload signatures, hook
  // implementation, getXxxQueryOptions, getXxxQueryKey, setQueryData /
  // getQueryData — wraps consistently with the request function's signature.
  bodyTypeWrapNonGetQuery: {
    output: {
      target:
        '../generated/react-query/body-type-wrap-non-get-query/endpoints.ts',
      schemas: '../generated/react-query/body-type-wrap-non-get-query/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/custom-client-strict-body.ts',
          name: 'customClientStrictBody',
        },
        operations: {
          createPets: {
            query: {
              useQuery: true,
              useSetQueryData: true,
              useGetQueryData: true,
            },
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidatesNonGetQueryTargetSplitKey: {
    output: {
      target:
        '../generated/react-query/invalidates-non-get-query-target-split-key/endpoints.ts',
      schemas:
        '../generated/react-query/invalidates-non-get-query-target-split-key/model',
      client: 'react-query',
      override: {
        operations: {
          deletePetById: {
            query: { useQuery: true },
          },
        },
        query: {
          shouldSplitQueryKey: true,
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['deletePetById'],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  zodSchemaResponse: {
    output: {
      target: '../generated/react-query/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/react-query/zod-schema-response/model',
      },
      mock: true,
      client: 'react-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  noContentWithDefault: {
    output: {
      target: '../generated/react-query/no-content-with-default/endpoints.ts',
      schemas: '../generated/react-query/no-content-with-default/model',
      mode: 'split',
      client: 'react-query',
      mock: {
        type: 'msw',
        delay: 0,
        useExamples: true,
      },
      headers: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/no-content-with-default.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/react-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/react-query/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'react-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/react-query/split/endpoints.ts',
      schemas: '../generated/react-query/split/model',
      mock: true,
      mode: 'split',
      client: 'react-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/react-query/tags/endpoints.ts',
      schemas: '../generated/react-query/tags/model',
      mock: true,
      mode: 'tags',
      client: 'react-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplitQueryKey: {
    output: {
      target: '../generated/react-query/split-query-key/endpoints.ts',
      schemas: '../generated/react-query/split-query-key/model',
      client: 'react-query',
      override: {
        query: {
          shouldSplitQueryKey: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreCustomMutatorOptions: {
    output: {
      target: '../generated/react-query/custom-mutator-options/endpoints.ts',
      schemas: '../generated/react-query/custom-mutator-options/model',
      client: 'react-query',
      override: {
        query: {
          mutationOptions: {
            path: '../mutators/custom-mutation.ts',
            name: 'useCustomMutation',
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetch: {
    output: {
      target: '../generated/react-query/http-client-fetch/endpoints.ts',
      schemas: '../generated/react-query/http-client-fetch/model',
      mode: 'tags-split',
      client: 'react-query',
      override: {
        fetch: {
          forceSuccessResponse: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpResponseReturnType: {
    output: {
      target:
        '../generated/react-query/http-client-fetch-with-include-http-response-return-type/endpoints.ts',
      schemas:
        '../generated/react-query/http-client-fetch-with-include-http-response-return-type/model',
      mode: 'tags-split',
      client: 'react-query',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
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
      target: '../generated/react-query/mutator/endpoints.ts',
      schemas: '../generated/react-query/mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        query: {
          useSuspenseQuery: true,
          useSuspenseInfiniteQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  customClient: {
    output: {
      target: '../generated/react-query/mutator-client/endpoints.ts',
      schemas: '../generated/react-query/mutator-client/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      headers: true,
      override: {
        mutator: {
          path: '../mutators/custom-client.ts',
          name: 'customClient',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  httpClientFetchWithCustomFetch: {
    output: {
      target:
        '../generated/react-query/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas:
        '../generated/react-query/http-client-fetch-with-custom-fetch/model',
      client: 'react-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutatorMultiArguments: {
    output: {
      target: '../generated/react-query/mutator-multi-arguments/endpoints.ts',
      schemas: '../generated/react-query/mutator-multi-arguments/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/multi-arguments.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  errorType: {
    output: {
      target: '../generated/react-query/error-type/endpoints.ts',
      schemas: '../generated/react-query/error-type/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/error-type.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  hookMutator: {
    output: {
      target: '../generated/react-query/hook-mutator-axios/endpoints.ts',
      schemas: '../generated/react-query/hook-mutator-axios/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  hookMutatorWithExtension: {
    output: {
      target:
        '../generated/react-query/hook-mutator-axios-with-extension/endpoints.ts',
      schemas:
        '../generated/react-query/hook-mutator-axios-with-extension/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
          extension: '.js',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  hookMutatorWithSecondParameter: {
    output: {
      target:
        '../generated/react-query/hook-mutator-axios-with-second-parameter/endpoints.ts',
      schemas:
        '../generated/react-query/hook-mutator-axios-with-second-parameter/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance-with-second-parameter.ts',
          name: 'useCustomInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagHookMutator: {
    output: {
      target: '../generated/react-query/tag-hook-mutator-axios/endpoints.ts',
      schemas: '../generated/react-query/tag-hook-mutator-axios/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        tags: {
          pets: {
            mutator: {
              path: '../mutators/use-custom-instance.ts',
              name: 'useCustomInstance',
            },
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  formData: {
    output: {
      target: '../generated/react-query/form-data/endpoints.ts',
      schemas: '../generated/react-query/form-data/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formDataWithHook: {
    output: {
      target: '../generated/react-query/form-data-with-hook/endpoints.ts',
      schemas: '../generated/react-query/form-data-with-hook/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formDataMutator: {
    output: {
      target: '../generated/react-query/form-data-with-mutator/endpoints.ts',
      schemas: '../generated/react-query/form-data-with-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        formData: {
          path: '../mutators/custom-form-data.ts',
          name: 'customFormData',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formUrlEncoded: {
    output: {
      target: '../generated/react-query/form-url-encoded/endpoints.ts',
      schemas: '../generated/react-query/form-url-encoded/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  formUrlEncodedMutator: {
    output: {
      target: '../generated/react-query/formUrlEncoded/endpoints.ts',
      schemas: '../generated/react-query/formUrlEncoded/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        formUrlEncoded: {
          path: '../mutators/custom-form-url-encoded.ts',
          name: 'customFormUrlEncoded',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  importFromSubdirectory: {
    output: {
      target: '../generated/react-query/importFromSubdirectory/endpoints.ts',
      schemas: '../generated/react-query/importFromSubdirectory/model',
      client: 'react-query',
      mode: 'split',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: '../specifications/import-from-subdirectory/petstore.yaml',
  },
  deprecated: {
    output: {
      target: '../generated/react-query/deprecated/endpoints.ts',
      schemas: '../generated/react-query/deprecated/model',
      client: 'react-query',
      mock: true,
      override: {
        useDeprecatedOperations: false,
      },
      clean: true,
      formatter: 'prettier',
    },
    input: '../specifications/deprecated.yaml',
  },
  mockOverride: {
    output: {
      target: '../generated/react-query/mockOverride/endpoints.ts',
      schemas: '../generated/react-query/mockOverride/model',
      client: 'react-query',
      mock: true,
      override: {
        mock: {
          arrayMin: 5,
          arrayMax: 15,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mockWithoutDelay: {
    output: {
      target: '../generated/react-query/mockWithoutDelay/endpoints.ts',
      schemas: '../generated/react-query/mockWithoutDelay/model',
      client: 'react-query',
      mock: {
        type: 'msw',
        delay: false,
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  polymorphic: {
    output: {
      target: '../generated/react-query/polymorphic/endpoints.ts',
      schemas: '../generated/react-query/polymorphic/model',
      client: 'react-query',
      mock: true,
      headers: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/polymorphic.yaml',
    },
  },
  namedParameters: {
    output: {
      target: '../generated/react-query/named-parameters/endpoints.ts',
      schemas: '../generated/react-query/named-parameters/model',
      client: 'react-query',
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
  specialCharacters: {
    output: {
      target: '../generated/react-query/special-characters/endpoints.ts',
      schemas: '../generated/react-query/special-characters/model',
      client: 'react-query',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/models-with-special-char.yaml',
    },
  },
  usePrefetchWithFunctionMutator: {
    output: {
      target:
        '../generated/react-query/use-prefetch-with-function-mutator/endpoints.ts',
      schemas:
        '../generated/react-query/use-prefetch-with-function-mutator/model',
      client: 'react-query',
      override: {
        query: {
          usePrefetch: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  usePrefetchWithHookMutator: {
    output: {
      target:
        '../generated/react-query/use-prefetch-with-hook-mutator-axios/endpoints.ts',
      schemas:
        '../generated/react-query/use-prefetch-with-hook-mutator-axios/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
        query: {
          usePrefetch: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useInvalidate: {
    output: {
      target: '../generated/react-query/use-invalidate/endpoints.ts',
      schemas: '../generated/react-query/use-invalidate/model',
      client: 'react-query',
      override: {
        query: {
          useInvalidate: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useInvalidateWithQueryOptionsMutator: {
    output: {
      target:
        '../generated/react-query/use-invalidate-with-query-options-mutator/endpoints.ts',
      schemas:
        '../generated/react-query/use-invalidate-with-query-options-mutator/model',
      client: 'react-query',
      override: {
        query: {
          useInvalidate: true,
          queryOptions: {
            path: '../mutators/custom-query-options.ts',
            name: 'customQueryOptions',
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useSetQueryData: {
    output: {
      target: '../generated/react-query/use-set-query-data/endpoints.ts',
      schemas: '../generated/react-query/use-set-query-data/model',
      client: 'react-query',
      override: {
        query: {
          useSetQueryData: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useSetQueryDataMultiParams: {
    output: {
      target:
        '../generated/react-query/use-set-query-data-multi-params/endpoints.ts',
      schemas: '../generated/react-query/use-set-query-data-multi-params/model',
      client: 'react-query',
      override: {
        query: {
          useSetQueryData: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/multi-query-params.yaml',
    },
  },
  useSetQueryDataNamedParams: {
    output: {
      target:
        '../generated/react-query/use-set-query-data-named-params/endpoints.ts',
      schemas: '../generated/react-query/use-set-query-data-named-params/model',
      client: 'react-query',
      override: {
        useNamedParameters: true,
        query: {
          useSetQueryData: true,
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
  useSetQueryDataInfinite: {
    output: {
      target:
        '../generated/react-query/use-set-query-data-infinite/endpoints.ts',
      schemas: '../generated/react-query/use-set-query-data-infinite/model',
      client: 'react-query',
      override: {
        query: {
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
          useSetQueryData: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useGetQueryData: {
    output: {
      target: '../generated/react-query/use-get-query-data/endpoints.ts',
      schemas: '../generated/react-query/use-get-query-data/model',
      client: 'react-query',
      override: {
        query: {
          useGetQueryData: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Regression for issue #3269. tags-split + msw + OpenAPI 3.1 anyOf-nullable
  // ($ref + type:null) on both response and request body. Pre-fix this emitted
  // `__Widget` references in the .msw.ts file with no matching import.
  issue3269: {
    output: {
      target: '../generated/react-query/issue-3269/endpoints.ts',
      schemas: '../generated/react-query/issue-3269/model',
      client: 'react-query',
      mode: 'tags-split',
      mock: { type: 'msw' },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3269.yaml',
    },
  },
  // Regression for issue #3066. zod schemas + tags-split + non-JSON request
  // body (multipart/form-data and application/x-www-form-urlencoded). Pre-fix
  // the endpoints imported `${OperationName}Body` from a zod schemas index
  // that never re-exported it, since `writeZodSchemasFromVerbs` only scanned
  // `application/json` bodies.
  issue3066: {
    output: {
      target: '../generated/react-query/issue-3066/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/react-query/issue-3066/model',
      },
      client: 'react-query',
      mode: 'tags-split',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3066.yaml',
    },
  },
});
