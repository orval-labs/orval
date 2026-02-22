import angular from '@orval/angular';
import axios from '@orval/axios';
import {
  asyncReduce,
  type ClientFileBuilder,
  type ClientMockBuilder,
  type ClientMockGeneratorBuilder,
  type ContextSpec,
  generateDependencyImports,
  type GeneratorClientFooter,
  type GeneratorClientHeader,
  type GeneratorClientImports,
  type GeneratorClients,
  type GeneratorClientTitle,
  type GeneratorOperations,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GeneratorVerbsOptions,
  isFunction,
  type NormalizedOutputOptions,
  OutputClient,
  type OutputClientFunc,
  pascal,
} from '@orval/core';
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
  const GENERATOR_CLIENT: GeneratorClients = {
    axios: axios({ type: 'axios' })(),
    'axios-functions': axios({ type: 'axios-functions' })(),
    angular: angular()(),
    'angular-query': query({ output, type: 'angular-query' })(),
    'react-query': query({ output, type: 'react-query' })(),
    'solid-start': solidStart()(),
    'solid-query': query({ output, type: 'solid-query' })(),
    'svelte-query': query({ output, type: 'svelte-query' })(),
    'vue-query': query({ output, type: 'vue-query' })(),
    swr: swr()(),
    zod: zod()(),
    hono: hono()(),
    fetch: fetchClient()(),
    mcp: mcp()(),
  };

  const generator = isFunction(outputClient)
    ? outputClient(GENERATOR_CLIENT)
    : GENERATOR_CLIENT[outputClient];

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
      : imports,
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
      implementation = (footer as (operationNames: string[]) => string)(
        operationNames,
      );
      // being here means that the previous call worked
      console.warn(
        '[WARN] Passing an array of strings for operations names to the footer function is deprecated and will be removed in a future major release. Please pass them in an object instead: { operationNames: string[] }.',
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

const generateMock = (
  verbOption: GeneratorVerbOptions,
  options: GeneratorOptions,
): ClientMockGeneratorBuilder => {
  if (!options.mock) {
    return {
      implementation: {
        function: '',
        handler: '',
        handlerName: '',
      },
      imports: [],
    };
  }

  if (isFunction(options.mock)) {
    return options.mock(verbOption, options);
  }

  return mock.generateMock(
    verbOption,
    options as typeof options & {
      mock: Exclude<(typeof options)['mock'], ClientMockBuilder | undefined>;
    },
  );
};

export const generateOperations = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
  output: NormalizedOutputOptions,
): Promise<GeneratorOperations> => {
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

      const generatedMock = generateMock(verbOption, options);

      acc[verbOption.operationId] = {
        implementation: verbOption.doc + client.implementation,
        imports: client.imports,
        implementationMock: generatedMock.implementation,
        importsMock: generatedMock.imports,
        tags: verbOption.tags,
        mutator: verbOption.mutator,
        clientMutators: client.mutators,
        formData: verbOption.formData,
        formUrlEncoded: verbOption.formUrlEncoded,
        paramsSerializer: verbOption.paramsSerializer,
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
