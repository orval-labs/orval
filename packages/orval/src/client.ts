import type {
  ClientFileBuilder,
  ClientGeneratorsBuilder,
  ClientMockGeneratorBuilder,
  ContextSpec,
  GeneratorClientFooter,
  GeneratorClientHeader,
  GeneratorClientImports,
  GeneratorClients,
  GeneratorClientTitle,
  GeneratorOperations,
  GeneratorOptions,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
  NormalizedOutputOptions,
  OutputClientFunc,
  SchemaOutputPlan,
} from '@orval/core';
import {
  asyncReduce,
  generateDependencyImports,
  getBaseUrlRuntimeImports,
  isFunction,
  OutputClient,
  OutputMockType,
  pascal,
} from '@orval/core';

import { logger } from './logger';

const DEFAULT_CLIENT = OutputClient.AXIOS;

type GeneratorModule = { default: unknown };
type GeneratorBuilder = (...args: unknown[]) => unknown;

// Keep package references lazy so importing `orval` does not evaluate every
// supported generator. Query variants deliberately share one module.
const GENERATOR_LOADERS: Record<string, () => Promise<GeneratorModule>> = {
  axios: () => import('@orval/axios'),
  angular: () => import('@orval/angular'),
  query: () => import('@orval/query'),
  'solid-start': () => import('@orval/solid-start'),
  swr: () => import('@orval/swr'),
  'pinia-colada': () => import('@orval/pinia-colada'),
  zod: () => import('@orval/zod'),
  effect: () => import('@orval/effect'),
  hono: () => import('@orval/hono'),
  fetch: () => import('@orval/fetch'),
  mcp: () => import('@orval/mcp'),
};

// Modules are process-wide and configuration-independent, so they can be
// safely shared across projects. Builders are not: several generators capture
// values from `output` while they are created.
const moduleCache = new Map<string, GeneratorModule>();
let fullTableCache: Promise<Record<string, GeneratorModule>> | undefined;
let mockModuleCache: Promise<typeof import('@orval/mock')> | undefined;

// Scope builders to the normalized output object rather than the client name.
// A WeakMap releases completed projects and prevents one project's overrides
// (for example Angular or Pinia Colada options) leaking into another project.
const builderCache = new WeakMap<
  NormalizedOutputOptions,
  Map<string, ClientGeneratorsBuilder>
>();
const fullTableBuilderCache = new WeakMap<
  NormalizedOutputOptions,
  GeneratorClients
>();

const getCachedBuilder = (
  output: NormalizedOutputOptions,
  key: string,
): ClientGeneratorsBuilder | undefined => builderCache.get(output)?.get(key);

const setCachedBuilder = (
  output: NormalizedOutputOptions,
  key: string,
  builder: ClientGeneratorsBuilder,
): void => {
  let perProject = builderCache.get(output);
  if (!perProject) {
    perProject = new Map();
    builderCache.set(output, perProject);
  }
  perProject.set(key, builder);
};

const getGeneratorBuilder = (module: GeneratorModule): GeneratorBuilder => {
  if (typeof module.default !== 'function') {
    throw new Error('Generator module does not have a default builder export');
  }

  return module.default as GeneratorBuilder;
};

const invokeGeneratorBuilder = (
  builder: GeneratorBuilder,
  ...args: unknown[]
): GeneratorBuilder => {
  const result = builder(...args);
  if (typeof result !== 'function') {
    throw new Error('Generator module default export did not return a builder');
  }

  return result as GeneratorBuilder;
};

const getClientGeneratorsBuilder = (
  value: unknown,
): ClientGeneratorsBuilder => {
  if (
    !value ||
    typeof value !== 'object' ||
    !('client' in value) ||
    typeof value.client !== 'function'
  ) {
    throw new Error('Generator builder did not return a client builder');
  }

  return value as ClientGeneratorsBuilder;
};

const loadGeneratorModule = async (key: string): Promise<GeneratorModule> => {
  const cachedModule = moduleCache.get(key);
  if (cachedModule) {
    return cachedModule;
  }

  const loader = GENERATOR_LOADERS[key];
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  if (!loader) {
    throw new Error(`Unknown generator module: ${key}`);
  }

  const module = await loader();
  moduleCache.set(key, module);
  return module;
};

const loadFullGeneratorTable = () => {
  // Custom output functions receive every generator for backwards
  // compatibility. Cache modules only; the per-project builder table below
  // still receives the current output configuration.
  fullTableCache ??= Promise.all(
    Object.keys(GENERATOR_LOADERS).map(async (key) => [
      key,
      await loadGeneratorModule(key),
    ]),
    // oxlint-disable-next-line typescript/no-unsafe-return
  ).then((entries) => Object.fromEntries(entries));
  return fullTableCache;
};

const createGeneratorClient = (
  outputClient: OutputClient,
  output: NormalizedOutputOptions,
  module: GeneratorModule,
): ClientGeneratorsBuilder => {
  const builder = getGeneratorBuilder(module);

  switch (outputClient) {
    case OutputClient.AXIOS:
    case OutputClient.AXIOS_FUNCTIONS:
      return getClientGeneratorsBuilder(
        invokeGeneratorBuilder(builder, { type: outputClient })(),
      );
    case OutputClient.ANGULAR:
      return getClientGeneratorsBuilder(
        invokeGeneratorBuilder(builder)(output.override.angular),
      );
    case OutputClient.ANGULAR_QUERY:
    case OutputClient.REACT_QUERY:
    case OutputClient.SOLID_QUERY:
    case OutputClient.SVELTE_QUERY:
    case OutputClient.VUE_QUERY:
      return getClientGeneratorsBuilder(
        invokeGeneratorBuilder(builder, { output, type: outputClient })(),
      );
    case OutputClient.SOLID_START:
    case OutputClient.SWR:
    case OutputClient.ZOD:
    case OutputClient.EFFECT:
    case OutputClient.HONO:
    case OutputClient.FETCH:
    case OutputClient.MCP:
      return getClientGeneratorsBuilder(invokeGeneratorBuilder(builder)());
    case OutputClient.PINIA_COLADA:
      return getClientGeneratorsBuilder(
        invokeGeneratorBuilder(builder, { output })(),
      );
  }
};

const getGeneratorModuleKey = (outputClient: OutputClient) => {
  // Module keys describe package ownership, while builder-cache keys retain
  // the concrete client name because each query variant has a distinct type.
  if (
    outputClient === OutputClient.ANGULAR_QUERY ||
    outputClient === OutputClient.REACT_QUERY ||
    outputClient === OutputClient.SOLID_QUERY ||
    outputClient === OutputClient.SVELTE_QUERY ||
    outputClient === OutputClient.VUE_QUERY
  ) {
    return 'query';
  }

  if (
    outputClient === OutputClient.AXIOS ||
    outputClient === OutputClient.AXIOS_FUNCTIONS
  ) {
    return 'axios';
  }

  return outputClient;
};

export const getGeneratorClient = async (
  outputClient: OutputClient | OutputClientFunc,
  output: NormalizedOutputOptions,
): Promise<ClientGeneratorsBuilder> => {
  if (!isFunction(outputClient)) {
    const cachedBuilder = getCachedBuilder(output, outputClient);
    if (cachedBuilder) {
      return cachedBuilder;
    }

    const builder = createGeneratorClient(
      outputClient,
      output,
      await loadGeneratorModule(getGeneratorModuleKey(outputClient)),
    );
    setCachedBuilder(output, outputClient, builder);
    return builder;
  }

  // Custom output functions need the full table. Its builders remain scoped to
  // this output object for the same isolation guarantees as named clients.
  let generators = fullTableBuilderCache.get(output);
  if (!generators) {
    const modules = await loadFullGeneratorTable();
    generators = {
      axios: createGeneratorClient(OutputClient.AXIOS, output, modules.axios),
      'axios-functions': createGeneratorClient(
        OutputClient.AXIOS_FUNCTIONS,
        output,
        modules.axios,
      ),
      angular: createGeneratorClient(
        OutputClient.ANGULAR,
        output,
        modules.angular,
      ),
      'angular-query': createGeneratorClient(
        OutputClient.ANGULAR_QUERY,
        output,
        modules.query,
      ),
      'react-query': createGeneratorClient(
        OutputClient.REACT_QUERY,
        output,
        modules.query,
      ),
      'solid-start': createGeneratorClient(
        OutputClient.SOLID_START,
        output,
        modules['solid-start'],
      ),
      'solid-query': createGeneratorClient(
        OutputClient.SOLID_QUERY,
        output,
        modules.query,
      ),
      'svelte-query': createGeneratorClient(
        OutputClient.SVELTE_QUERY,
        output,
        modules.query,
      ),
      'vue-query': createGeneratorClient(
        OutputClient.VUE_QUERY,
        output,
        modules.query,
      ),
      swr: createGeneratorClient(OutputClient.SWR, output, modules.swr),
      'pinia-colada': createGeneratorClient(
        OutputClient.PINIA_COLADA,
        output,
        modules['pinia-colada'],
      ),
      zod: createGeneratorClient(OutputClient.ZOD, output, modules.zod),
      effect: createGeneratorClient(
        OutputClient.EFFECT,
        output,
        modules.effect,
      ),
      hono: createGeneratorClient(OutputClient.HONO, output, modules.hono),
      fetch: createGeneratorClient(OutputClient.FETCH, output, modules.fetch),
      mcp: createGeneratorClient(OutputClient.MCP, output, modules.mcp),
    } satisfies GeneratorClients;
    fullTableBuilderCache.set(output, generators);
  }
  const generator = outputClient(generators);

  // oxlint-disable-next-line typescript/no-unnecessary-condition -- defensive guard for custom OutputClientFunc returning unexpected values
  if (!generator) {
    throw new Error(
      `Unknown output client provided to getGeneratorClient: ${String(outputClient)}`,
    );
  }

  return generator;
};

export const generateClientImports: GeneratorClientImports = async ({
  client,
  implementation,
  imports,
  projectName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  hasGlobalMutator,
  hasTagsMutator,
  hasParamsSerializerOptions,
  packageJson,
  output,
}) => {
  const { dependencies } = await getGeneratorClient(client, output);
  return generateDependencyImports(
    implementation,
    dependencies
      ? [
          ...dependencies(
            hasGlobalMutator,
            hasParamsSerializerOptions,
            packageJson,
            output.httpClient,
            hasTagsMutator,
            output.override,
            implementation,
          ),
          ...imports,
        ]
      : (imports as Parameters<typeof generateDependencyImports>[1]),
    projectName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

export const generateClientHeader: GeneratorClientHeader = async ({
  outputClient = DEFAULT_CLIENT,
  isRequestOptions,
  isGlobalMutator,
  isMutator,
  provideIn,
  hasAwaitedType,
  titles,
  output,
  verbOptions,
  tag,
  isDefaultTagBucket,
  clientImplementation,
}) => {
  const { header } = await getGeneratorClient(outputClient, output);

  const rawHeader = header
    ? header({
        title: titles.implementation,
        isRequestOptions,
        isGlobalMutator,
        isMutator,
        provideIn,
        hasAwaitedType,
        output,
        verbOptions,
        tag,
        isDefaultTagBucket,
        clientImplementation,
      })
    : '';

  const normalizedHeader =
    typeof rawHeader === 'string' ? { implementation: rawHeader } : rawHeader;

  return {
    implementation: normalizedHeader.implementation,
    implementationMock: `export const ${titles.implementationMock} = () => [\n`,
    sharedTypes: normalizedHeader.sharedTypes,
  };
};

export const generateClientFooter: GeneratorClientFooter = async ({
  outputClient,
  operationNames,
  operations,
  hasMutator,
  hasAwaitedType,
  titles,
  output,
}) => {
  const { footer } = await getGeneratorClient(outputClient, output);

  if (!footer) {
    return {
      implementation: '',
      implementationMock: `\n]\n`,
    };
  }

  let implementation: string;
  try {
    if (isFunction(outputClient)) {
      implementation = (
        footer as unknown as (operationNames: string[]) => string
      )(operationNames);
      // being here means that the previous call worked
      logger.warn(
        'Passing an array of strings for operations names to the footer function is deprecated and will be removed in a future major release. Please pass them in an object instead: { operationNames: string[] }.',
      );
    } else {
      implementation = footer({
        operationNames,
        operations,
        title: titles.implementation,
        hasMutator,
        hasAwaitedType,
      });
    }
  } catch {
    implementation = footer({
      operationNames,
      operations,
      title: titles.implementation,
      hasMutator,
      hasAwaitedType,
    });
  }

  return {
    implementation,
    implementationMock: `]\n`,
  };
};

export const generateClientTitle: GeneratorClientTitle = async ({
  outputClient = DEFAULT_CLIENT,
  title,
  customTitleFunc,
  output,
}) => {
  const { title: generatorTitle } = await getGeneratorClient(
    outputClient,
    output,
  );

  if (!generatorTitle) {
    return {
      implementation: '',
      implementationMock: `get${pascal(title)}Mock`,
    };
  }

  if (customTitleFunc) {
    const customTitle = customTitleFunc(title);
    return {
      implementation: generatorTitle(customTitle),
      implementationMock: `get${pascal(customTitle)}Mock`,
    };
  }
  return {
    implementation: generatorTitle(title),
    implementationMock: `get${pascal(title)}Mock`,
  };
};

/**
 * Invokes the underlying mock generator (msw, faker, or a user-provided
 * ClientMockBuilder) for a single generator entry. Returns the standard
 * `ClientMockGeneratorBuilder` shape (function/handler/handlerName +
 * imports) regardless of which generator handled it.
 */
const invokeMockGenerator = async (
  verbOption: GeneratorVerbOptions,
  options: GeneratorOptions,
  entry: NonNullable<NormalizedOutputOptions['mock']['generators'][number]>,
): Promise<ClientMockGeneratorBuilder> => {
  if (isFunction(entry)) {
    return entry(verbOption, {
      ...options,
      mock: entry,
    });
  }
  // Mock support is only needed when a built-in mock generator is configured.
  // Defer its package cost for projects that do not generate mocks.
  mockModuleCache ??= import('@orval/mock');
  return (await mockModuleCache).generateMock(verbOption, {
    ...options,
    mock: entry,
  });
};

export const generateOperations = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
  output: NormalizedOutputOptions,
): Promise<GeneratorOperations> => {
  const baseUrlImports = getBaseUrlRuntimeImports(output.baseUrl);

  return asyncReduce(
    verbsOptions,
    async (acc, verbOption) => {
      const { client: generatorClient } = await getGeneratorClient(
        outputClient,
        output,
      );
      const client = await generatorClient(
        verbOption,
        options,
        outputClient,
        output,
      );

      if (!client.implementation) {
        return acc;
      }

      // Run every configured mock generator for this operation. Each entry
      // contributes its own GeneratorMockOutputFull so writers can split the
      // results across per-type output files (e.g. `.msw.ts` + `.faker.ts`).
      // Function-form entries (ClientMockBuilder) inherit the historical
      // `msw` file extension and are treated as msw outputs for downstream
      // bookkeeping.
      const mockOutputs = await Promise.all(
        output.mock.generators
          .filter((entry) => {
            // A faker entry with `operationResponses: false` opts out of the
            // per-operation `get<Op>ResponseMock` factories. The consolidated
            // schemas file (when `schemas: true`) is emitted separately and is
            // unaffected by this filter.
            if (
              !isFunction(entry) &&
              entry.type === OutputMockType.FAKER &&
              entry.operationResponses === false
            ) {
              return false;
            }
            return true;
          })
          .map(async (entry) => {
            const generated = await invokeMockGenerator(
              verbOption,
              options,
              entry,
            );
            return {
              type: isFunction(entry) ? OutputMockType.MSW : entry.type,
              implementation: generated.implementation,
              imports: generated.imports,
              strictMockSchemaTypeNames: generated.strictMockSchemaTypeNames,
              strictMockSchemaKinds: generated.strictMockSchemaKinds,
            };
          }),
      );

      const hasImplementation = client.implementation.trim().length > 0;
      const preferredOperationKey = verbOption.operationName;
      const baseOperationKey = verbOption.operationId
        ? `${verbOption.operationId}::${verbOption.operationName}`
        : verbOption.operationName;
      let operationKey = Object.hasOwn(acc, preferredOperationKey)
        ? baseOperationKey
        : preferredOperationKey;
      let collisionIndex = 1;

      while (Object.hasOwn(acc, operationKey)) {
        collisionIndex += 1;
        operationKey = `${baseOperationKey}::${collisionIndex}`;
      }

      acc[operationKey] = {
        implementation: hasImplementation
          ? (client.docComment ?? verbOption.doc) + client.implementation
          : client.implementation,
        imports: [...baseUrlImports, ...client.imports],
        mockOutputs,
        tags: verbOption.tags,
        mutator: verbOption.mutator,
        clientMutators: client.mutators,
        formData: verbOption.formData,
        formUrlEncoded: verbOption.formUrlEncoded,
        paramsSerializer: verbOption.paramsSerializer,
        paramsFilter: verbOption.paramsFilter,
        operationName: verbOption.operationName,
        urlHelperName: verbOption.urlHelperName,
        fetchReviver: verbOption.fetchReviver,
        ...(client.returnType
          ? { types: { result: client.returnType } }
          : undefined),
      };

      return acc;
    },
    {} as GeneratorOperations,
  );
};

export const generateExtraFiles = async (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
  schemaTagMap?: Map<string, string>,
  schemaOutputPlan?: SchemaOutputPlan,
): Promise<ClientFileBuilder[]> => {
  const { extraFiles: generateExtraFiles } = await getGeneratorClient(
    outputClient,
    output,
  );

  if (!generateExtraFiles) {
    return [];
  }

  return generateExtraFiles(
    verbsOptions,
    output,
    context,
    schemaTagMap,
    schemaOutputPlan,
  );
};
