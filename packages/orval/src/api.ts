import {
  asyncReduce,
  buildSchemaTagMap,
  createSchemaOutputPlanForOutput,
  type ContextSpec,
  generateVerbImports,
  generateVerbsOptions,
  getOperationUrlHelperNames,
  type GeneratorApiBuilder,
  type GeneratorApiOperations,
  type GeneratorSchema,
  getFullRoute,
  getRoute,
  GetterPropType,
  isObject,
  createMutationInvalidatesFileFiller,
  createMutationInvalidatesResolver,
  getMutationInvalidatesContext,
  type GeneratorVerbOptions,
  type MutationInvalidatesConfig,
  type MutationInvalidatesContext,
  type MutationInvalidatesOperationKind,
  type NormalizedInputOptions,
  type NormalizedOutputOptions,
  type OpenApiPathItemObject,
  type GeneratorVerbsOptions,
  isInlineSchema,
  OutputClient,
  OutputMode,
  resolveRef,
  getUnknownMutationInvalidatesWarnings,
} from '@orval/core';

import {
  generateClientFooter,
  generateClientHeader,
  generateClientImports,
  generateClientTitle,
  generateExtraFiles,
  generateOperations,
} from './client';
import { logger } from './logger';

// API construction only needs Mock when an output actually emits mocks. Keep
// the resolved module for later projects without making it part of startup.
let mockModuleCache: Promise<typeof import('@orval/mock')> | undefined;

const loadMockModule = () => (mockModuleCache ??= import('@orval/mock'));

/** Tag and operation overrides only reach the verb options, not `output.override`. */
const collectMutationInvalidates = (
  rules: ReadonlyArray<MutationInvalidatesConfig | undefined>,
): MutationInvalidatesConfig => rules.flatMap((list) => list ?? []);

export async function getApiBuilder({
  input,
  output,
  context,
  componentSchemas,
}: {
  input: NormalizedInputOptions;
  output: NormalizedOutputOptions;
  context: ContextSpec;
  /**
   * Schemas from `components.schemas`. The caller merges them ahead of the
   * operation-derived ones. The schema→tag map needs the complete list.
   */
  componentSchemas: GeneratorSchema[];
}): Promise<GeneratorApiBuilder> {
  // The fallback callbacks preserve the builder contract for non-mock outputs
  // while avoiding an unnecessary dynamic import.
  const mock =
    output.mock.generators.length > 0 ? await loadMockModule() : undefined;
  const pathEntries: Array<{
    pathRoute: string;
    route: string;
    resolvedVerbs: OpenApiPathItemObject;
    verbsOptions: GeneratorVerbsOptions;
  }> = [];
  const reservedOperationNames = new Set<string>();
  const reservedTypeNames = new Set<string>();
  // Angular in `tags`/`tags-split` mode renders one service class per tag, so
  // its method names only need per-tag uniqueness. Its module-level
  // `httpResource` functions are named from the globally reserved `typeName`.
  // Every other client/mode emits module-level names and keeps the global set.
  const reservedMethodNamesByTag =
    output.client === OutputClient.ANGULAR &&
    (output.mode === OutputMode.TAGS || output.mode === OutputMode.TAGS_SPLIT)
      ? new Map<string, Set<string>>()
      : undefined;

  for (const [pathRoute, verbs] of Object.entries(context.spec.paths ?? {})) {
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    if (!verbs) {
      continue;
    }

    const route = getRoute(pathRoute);
    let resolvedVerbs: OpenApiPathItemObject = verbs;

    if (!isInlineSchema(verbs)) {
      const { schema }: { schema: OpenApiPathItemObject } = resolveRef(
        verbs,
        context,
      );

      resolvedVerbs = schema;
    }

    let verbsOptions = await generateVerbsOptions({
      verbs: resolvedVerbs,
      input,
      output,
      route,
      pathRoute,
      context,
      reservedOperationNames,
      reservedTypeNames,
      reservedMethodNamesByTag,
    });

    // GitHub #564 check if we want to exclude deprecated operations
    if (output.override.useDeprecatedOperations === false) {
      verbsOptions = verbsOptions.filter((verb) => !verb.deprecated);
    }

    pathEntries.push({ pathRoute, route, resolvedVerbs, verbsOptions });
  }

  // `asyncReduce` returns array-likes that `flatMap` does not spread.
  const allVerbOptions = pathEntries.flatMap(({ verbsOptions }) => [
    ...verbsOptions,
  ]);
  const allOperationNames = allVerbOptions.map(
    ({ operationName }) => operationName,
  );

  // A function needs every operation, so it is resolved here into static rules.
  const topLevelInvalidates = output.override.query.mutationInvalidates;
  const hasInvalidates = [
    topLevelInvalidates,
    ...allVerbOptions.map(({ override }) => override.query.mutationInvalidates),
  ].some(Boolean);
  const queryModule = hasInvalidates ? await import('@orval/query') : undefined;
  const kindCache = new Map<
    GeneratorVerbOptions,
    MutationInvalidatesOperationKind
  >();
  const kindOf = (verbOption: GeneratorVerbOptions) => {
    if (!queryModule) return undefined;
    if (kindCache.has(verbOption)) return kindCache.get(verbOption);

    const { verb, override, operationId, queryParams, body, props } =
      verbOption;
    const {
      isQuery,
      isMutation,
      effectiveUseQuery,
      effectiveUseSuspenseQuery,
      effectiveUseInfinite,
      effectiveUseSuspenseInfiniteQuery,
    } = queryModule.resolveQueryHookKinds({
      verb,
      query: override.query,
      operationQueryOptions: output.override.operations[operationId]?.query,
      queryParams,
      body,
      props,
      context,
    });
    // With a `queryKey` mutator, key functions are only emitted when exported.
    const hasKeyFns =
      !override.query.queryKey || !!override.query.shouldExportKeys;
    const kind: MutationInvalidatesOperationKind = isMutation
      ? 'mutation'
      : isQuery
        ? {
            plainKey:
              hasKeyFns && (effectiveUseQuery || effectiveUseSuspenseQuery),
            infiniteKey:
              hasKeyFns &&
              (effectiveUseInfinite || effectiveUseSuspenseInfiniteQuery),
          }
        : undefined;
    kindCache.set(verbOption, kind);
    return kind;
  };
  let invalidatesContext: MutationInvalidatesContext | undefined;
  const resolveRules = createMutationInvalidatesResolver(() => {
    invalidatesContext ??= getMutationInvalidatesContext(
      allVerbOptions,
      kindOf,
    );
    return invalidatesContext;
  });
  const topLevelRules = resolveRules(topLevelInvalidates);
  const verbRules = new Map(
    allVerbOptions.map((verbOption) => [
      verbOption,
      resolveRules(verbOption.override.query.mutationInvalidates),
    ]),
  );

  // Checked here because it is the only point that holds every operation of the
  // output at once: the query package sees one verb at a time and cannot tell a
  // name it does not recognise from one that belongs to another verb. The list
  // is post-filter, so a rule naming an operation dropped by
  // `useDeprecatedOperations: false` or an input filter warns too — correctly,
  // since no such operation is generated. Rules can also arrive through a tag
  // or operation override, which replaces rather than extends the top-level
  // array, so every merged list is collected and the warnings deduped.
  for (const warning of getUnknownMutationInvalidatesWarnings({
    mutationInvalidates: collectMutationInvalidates([
      ...new Set([topLevelRules, ...verbRules.values()]),
    ]),
    operationNames: allOperationNames,
  })) {
    logger.warn(warning);
  }

  const fillFiles = createMutationInvalidatesFileFiller({
    operations: allVerbOptions.map((verbOption) => {
      const kind = kindOf(verbOption);
      return {
        operationName: verbOption.operationName,
        tags: verbOption.tags,
        queryKeys: queryModule
          ? typeof kind === 'object'
            ? [
                ...(kind.plainKey ? [verbOption.operationName] : []),
                ...(kind.infiniteKey
                  ? [`${verbOption.operationName}Infinite`]
                  : []),
              ]
            : []
          : undefined,
        exportsQueryKeys: !!verbOption.override.query.shouldExportKeys,
      };
    }),
    output,
  });
  const withResolvedInvalidates = (
    verbOption: GeneratorVerbOptions,
  ): GeneratorVerbOptions => {
    const rules = verbRules.get(verbOption);
    const filled = rules && fillFiles(rules);
    if (filled === verbOption.override.query.mutationInvalidates) {
      return verbOption;
    }
    return {
      ...verbOption,
      override: {
        ...verbOption.override,
        query: { ...verbOption.override.query, mutationInvalidates: filled },
      },
    };
  };
  const resolvedPathEntries = pathEntries.map((entry) => ({
    ...entry,
    verbsOptions: [...entry.verbsOptions].map(withResolvedInvalidates),
  }));

  const helperOptions = resolvedPathEntries.flatMap(({ verbsOptions }) =>
    verbsOptions.filter(({ mutator }) => !mutator),
  );
  const helperNames = getOperationUrlHelperNames(
    allOperationNames,
    helperOptions.map(({ operationName }) => operationName),
  );
  const helperNamesByOption = new Map(
    helperOptions.map((verbOption, index) => [verbOption, helperNames[index]]),
  );

  const api = await asyncReduce(
    resolvedPathEntries,
    async (acc, { pathRoute, route, resolvedVerbs, verbsOptions }) => {
      const resolvedVerbOptions = verbsOptions.map((verbOption) => {
        const urlHelperName = helperNamesByOption.get(verbOption);
        return urlHelperName ? { ...verbOption, urlHelperName } : verbOption;
      });
      const schemas: GeneratorSchema[] = [];
      for (const {
        queryParams,
        headers,
        body,
        response,
        props,
      } of resolvedVerbOptions) {
        schemas.push(
          ...props.flatMap((param) =>
            param.type === GetterPropType.NAMED_PATH_PARAMS ? param.schema : [],
          ),
        );
        if (queryParams) {
          schemas.push(queryParams.schema, ...queryParams.deps);
        }
        if (headers) {
          schemas.push(headers.schema, ...headers.deps);
        }

        schemas.push(...body.schemas, ...response.schemas);
      }

      const fullRoute = getFullRoute(
        route,
        resolvedVerbs.servers ?? context.spec.servers,
        output.baseUrl,
      );
      acc.schemas.push(...schemas);
      for (const verbOption of resolvedVerbOptions) {
        acc.verbOptions[verbOption.operationId] = verbOption;
        acc.operationVerbOptions?.push(verbOption);
      }

      // `schemas` without `target` is a schemas-only output: keep the
      // operation-derived schemas and verb options but emit no operations.
      if (!output.target) {
        return acc;
      }
      const pathOperations = await generateOperations(
        output.client,
        resolvedVerbOptions,
        {
          route: fullRoute,
          pathRoute,
          override: output.override,
          context,
          output: output.target,
        },
        output,
      );

      for (const [key, value] of Object.entries(pathOperations)) {
        let operationKey = key;
        let counter = 1;
        while (Object.hasOwn(acc.operations, operationKey)) {
          operationKey = `${key}::${++counter}`;
        }
        acc.operations[operationKey] = value;
      }

      return acc;
    },
    {
      operations: {},
      verbOptions: {},
      operationVerbOptions: [],
      schemas: [],
    } as GeneratorApiOperations,
  );

  // Built here, and not in `writeSpecs`, because the extra files below need it.
  // Use the merged schema list: it must match `WriteSpecBuilder.schemas`.
  const schemaTagMap =
    isObject(output.schemas) && output.schemas.splitByTags
      ? buildSchemaTagMap(
          // A schemas-only output has no operations; their verb imports carry
          // the same schema references.
          output.target
            ? Object.values(api.operations).map((operation) => ({
                imports: operation.imports,
                tags: operation.tags,
              }))
            : (api.operationVerbOptions ?? []).map((verbOption) => ({
                imports: generateVerbImports(verbOption),
                tags: verbOption.tags,
              })),
          [...componentSchemas, ...api.schemas],
        )
      : undefined;

  // Built here for the same reason as the tag map: the extra files below are
  // rendered before any mode writer runs, and `writeSpecs` reads this one plan
  // off the builder rather than deriving a second.
  const schemaOutputPlan = createSchemaOutputPlanForOutput(
    [...componentSchemas, ...api.schemas],
    output,
    schemaTagMap,
  );

  // Client extra files sit next to the operations, which a schemas-only
  // output does not emit.
  const extraFiles = output.target
    ? await generateExtraFiles(
        output.client,
        api.verbOptions,
        output,
        context,
        schemaTagMap,
        schemaOutputPlan,
      )
    : [];

  return {
    operations: api.operations,
    schemas: api.schemas,
    schemaTagMap,
    schemaOutputPlan,
    verbOptions: api.verbOptions,
    operationVerbOptions: api.operationVerbOptions,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: mock?.generateMockImports ?? (() => ''),
    finalizeMockImplementation: mock?.dedupeStrictMockTypeDeclarations,
    extraFiles,
  };
}
