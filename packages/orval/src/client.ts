import angular from '@orval/angular';
import axios from '@orval/axios';
import type {
  AngularOptions,
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
} from '@orval/core';
import {
  asyncReduce,
  generateDependencyImports,
  getBaseUrlRuntimeImports,
  isFunction,
  logWarning,
  OutputClient,
  OutputMockType,
  pascal,
} from '@orval/core';
import effect from '@orval/effect';
import fetchClient from '@orval/fetch';
import hono from '@orval/hono';
import mcp from '@orval/mcp';
import * as mock from '@orval/mock';
import query from '@orval/query';
import solidStart from '@orval/solid-start';
import swr from '@orval/swr';
import zod from '@orval/zod';

const DEFAULT_CLIENT = OutputClient.AXIOS;

const getGeneratorClient = (
  outputClient: OutputClient | OutputClientFunc,
  output: NormalizedOutputOptions,
) => {
  const angularBuilder = angular() as (
    options?: AngularOptions,
  ) => ClientGeneratorsBuilder;
  const GENERATOR_CLIENT: GeneratorClients = {
    axios: axios({ type: 'axios' })(),
    'axios-functions': axios({ type: 'axios-functions' })(),
    angular: angularBuilder(output.override.angular),
    'angular-query': query({ output, type: 'angular-query' })(),
    'react-query': query({ output, type: 'react-query' })(),
    'solid-start': solidStart()(),
    'solid-query': query({ output, type: 'solid-query' })(),
    'svelte-query': query({ output, type: 'svelte-query' })(),
    'vue-query': query({ output, type: 'vue-query' })(),
    swr: swr()(),
    zod: zod()(),
    effect: effect()(),
    hono: hono()(),
    fetch: fetchClient()(),
    mcp: mcp()(),
  };

  const generator = isFunction(outputClient)
    ? outputClient(GENERATOR_CLIENT)
    : GENERATOR_CLIENT[outputClient];

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive guard for custom OutputClientFunc returning unexpected values
  if (!generator) {
    throw new Error(
      `Unknown output client provided to getGeneratorClient: ${String(outputClient)}`,
    );
  }

  return generator;
};

export const generateClientImports: GeneratorClientImports = ({
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
  const { dependencies } = getGeneratorClient(client, output);
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
          ),
          ...imports,
        ]
      : (imports as Parameters<typeof generateDependencyImports>[1]),
    projectName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

export const generateClientHeader: GeneratorClientHeader = ({
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
  const { header } = getGeneratorClient(outputClient, output);

  return {
    implementation: header
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
      : '',
    implementationMock: `export const ${titles.implementationMock} = () => [\n`,
  };
};

export const generateClientFooter: GeneratorClientFooter = ({
  outputClient,
  operationNames,
  hasMutator,
  hasAwaitedType,
  titles,
  output,
}) => {
  const { footer } = getGeneratorClient(outputClient, output);

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
      logWarning(
        '⚠️  Passing an array of strings for operations names to the footer function is deprecated and will be removed in a future major release. Please pass them in an object instead: { operationNames: string[] }.',
      );
    } else {
      implementation = footer({
        operationNames,
        title: titles.implementation,
        hasMutator,
        hasAwaitedType,
      });
    }
  } catch {
    implementation = footer({
      operationNames,
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

export const generateClientTitle: GeneratorClientTitle = ({
  outputClient = DEFAULT_CLIENT,
  title,
  customTitleFunc,
  output,
}) => {
  const { title: generatorTitle } = getGeneratorClient(outputClient, output);

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
const invokeMockGenerator = (
  verbOption: GeneratorVerbOptions,
  options: GeneratorOptions,
  entry: NonNullable<NormalizedOutputOptions['mock']['generators'][number]>,
): ClientMockGeneratorBuilder => {
  if (isFunction(entry)) {
    return entry(verbOption, {
      ...options,
      mock: entry,
    });
  }
  return mock.generateMock(verbOption, {
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
      const { client: generatorClient } = getGeneratorClient(
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
      const mockOutputs = output.mock.generators
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
        .map((entry) => {
          const generated = invokeMockGenerator(verbOption, options, entry);
          return {
            type: isFunction(entry) ? OutputMockType.MSW : entry.type,
            implementation: generated.implementation,
            imports: generated.imports,
            strictMockSchemaTypeNames: generated.strictMockSchemaTypeNames,
          };
        });

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
        fetchReviver: verbOption.fetchReviver,
      };

      return acc;
    },
    {} as GeneratorOperations,
  );
};

export const generateExtraFiles = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpec,
): Promise<ClientFileBuilder[]> => {
  const { extraFiles: generateExtraFiles } = getGeneratorClient(
    outputClient,
    output,
  );

  if (!generateExtraFiles) {
    return Promise.resolve([]);
  }

  return generateExtraFiles(verbsOptions, output, context);
};
