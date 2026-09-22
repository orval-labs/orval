import {
  asyncReduce,
  buildSchemaTagMap,
  createSchemaOutputPlanForOutput,
  type ContextSpec,
  generateVerbsOptions,
  getOperationUrlHelperNames,
  type GeneratorApiBuilder,
  type GeneratorApiOperations,
  type GeneratorSchema,
  getFullRoute,
  getRoute,
  GetterPropType,
  isObject,
  type MutationInvalidatesConfig,
  type NormalizedInputOptions,
  type NormalizedOutputOptions,
  type OpenApiPathItemObject,
  type GeneratorVerbsOptions,
  isInlineSchema,
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

/**
 * Every `mutationInvalidates` list that reaches this output: the top-level one
 * plus whatever a tag or operation override merged in. `mergeDeep` replaces the
 * array rather than concatenating, so a per-operation rule set is invisible in
 * `output.override` and has to be read off the verb options.
 */
const collectMutationInvalidates = (
  output: NormalizedOutputOptions,
  pathEntries: ReadonlyArray<{ verbsOptions: GeneratorVerbsOptions }>,
): MutationInvalidatesConfig =>
  [
    output.override.query.mutationInvalidates,
    ...pathEntries.flatMap(({ verbsOptions }) =>
      verbsOptions.map(({ override }) => override.query.mutationInvalidates),
    ),
  ].flatMap((rules) => rules ?? []);

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

  for (const [pathRoute, verbs] of Object.entries(context.spec.paths ?? {})) {
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
    });

    // GitHub #564 check if we want to exclude deprecated operations
    if (output.override.useDeprecatedOperations === false) {
      verbsOptions = verbsOptions.filter((verb) => !verb.deprecated);
    }

    pathEntries.push({ pathRoute, route, resolvedVerbs, verbsOptions });
  }

  const allOperationNames = pathEntries.flatMap(({ verbsOptions }) =>
    verbsOptions.map(({ operationName }) => operationName),
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
    mutationInvalidates: collectMutationInvalidates(output, pathEntries),
    operationNames: allOperationNames,
  })) {
    logger.warn(warning);
  }

  const helperOptions = pathEntries.flatMap(({ verbsOptions }) =>
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
    pathEntries,
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
      if (!output.target) {
        throw new Error('Output does not have a target');
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

      for (const verbOption of resolvedVerbOptions) {
        acc.verbOptions[verbOption.operationId] = verbOption;
      }
      acc.schemas.push(...schemas);
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
      schemas: [],
    } as GeneratorApiOperations,
  );

  // Built here, and not in `writeSpecs`, because the extra files below need it.
  // Use the merged schema list: it must match `WriteSpecBuilder.schemas`.
  const schemaTagMap =
    isObject(output.schemas) && output.schemas.splitByTags
      ? buildSchemaTagMap(
          Object.values(api.operations).map((operation) => ({
            imports: operation.imports,
            tags: operation.tags,
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

  const extraFiles = await generateExtraFiles(
    output.client,
    api.verbOptions,
    output,
    context,
    schemaTagMap,
    schemaOutputPlan,
  );

  return {
    operations: api.operations,
    schemas: api.schemas,
    schemaTagMap,
    schemaOutputPlan,
    verbOptions: api.verbOptions,
    title: generateClientTitle,
    header: generateClientHeader,
    footer: generateClientFooter,
    imports: generateClientImports,
    importsMock: mock?.generateMockImports ?? (() => ''),
    finalizeMockImplementation: mock?.dedupeStrictMockTypeDeclarations,
    extraFiles,
  };
}
