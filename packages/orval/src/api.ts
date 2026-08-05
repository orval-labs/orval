import {
  asyncReduce,
  buildSchemaTagMap,
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
   * Schemas derived from `components.schemas`, which the caller merges ahead
   * of the operation-derived ones. Needed here so the schema→tag map is built
   * over the complete schema list — the same list `writeSpecs` sees.
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

  // Built here, not in `writeSpecs`, because extra files are rendered during
  // API building and must route schema imports through the same map the mode
  // writers use later. Computed over the merged schema list so it matches
  // `WriteSpecBuilder.schemas` exactly — `api.schemas` alone omits every
  // component schema, which would silently collapse tag routing to flat.
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

  const extraFiles = await generateExtraFiles(
    output.client,
    api.verbOptions,
    output,
    context,
    schemaTagMap,
  );

  return {
    operations: api.operations,
    schemas: api.schemas,
    schemaTagMap,
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
