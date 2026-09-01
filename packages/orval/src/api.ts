import {
  asyncReduce,
  buildSchemaTagMap,
  createSchemaOutputPlanForOutput,
  type ContextSpec,
  generateVerbsOptions,
  type GeneratorApiBuilder,
  type GeneratorApiOperations,
  type GeneratorSchema,
  getFullRoute,
  getRoute,
  GetterPropType,
  isObject,
  isReference,
  type NormalizedInputOptions,
  type NormalizedOutputOptions,
  type OpenApiPathItemObject,
  resolveRef,
} from '@orval/core';
import {
  dedupeStrictMockTypeDeclarations,
  generateMockImports,
} from '@orval/mock';

import {
  generateClientFooter,
  generateClientHeader,
  generateClientImports,
  generateClientTitle,
  generateExtraFiles,
  generateOperations,
} from './client';

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
  const api = await asyncReduce(
    Object.entries(context.spec.paths ?? {}),
    async (acc, [pathRoute, verbs]) => {
      if (!verbs) {
        return acc;
      }

      const route = getRoute(pathRoute);

      let resolvedVerbs: OpenApiPathItemObject = verbs;

      if (isReference(verbs)) {
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
        verbsOptions = verbsOptions.filter((verb) => {
          return !verb.deprecated;
        });
      }

      const schemas: GeneratorSchema[] = [];
      for (const {
        queryParams,
        headers,
        body,
        response,
        props,
      } of verbsOptions) {
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
        verbsOptions,
        {
          route: fullRoute,
          pathRoute,
          override: output.override,
          context,
          output: output.target,
        },
        output,
      );

      for (const verbOption of verbsOptions) {
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
    importsMock: generateMockImports,
    finalizeMockImplementation: dedupeStrictMockTypeDeclarations,
    extraFiles,
  };
}
