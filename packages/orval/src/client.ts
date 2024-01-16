import angular from '@orval/angular';
import axios from '@orval/axios';
import {
  asyncReduce,
  generateDependencyImports,
  GeneratorClientFooter,
  GeneratorClientHeader,
  GeneratorClientImports,
  GeneratorClients,
  GeneratorClientTitle,
  GeneratorOperations,
  GeneratorOptions,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
  isFunction,
  NormalizedOutputOptions,
  OutputClient,
  OutputClientFunc,
  pascal,
} from '@orval/core';
import * as mock from '@orval/mock';
import query from '@orval/query';
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
    'react-query': query({ output, type: 'react-query' })(),
    'svelte-query': query({ output, type: 'svelte-query' })(),
    'vue-query': query({ output, type: 'vue-query' })(),
    swr: swr()(),
    zod: zod()(),
  };

  const generator = isFunction(outputClient)
    ? outputClient(GENERATOR_CLIENT)
    : GENERATOR_CLIENT[outputClient];

  if (!generator) {
    throw `Oups... 🍻. Client not found: ${outputClient}`;
  }

  return generator;
};

export const generateClientImports: GeneratorClientImports = ({
  client = DEFAULT_CLIENT,
  implementation,
  imports,
  specsName,
  hasSchemaDir,
  isAllowSyntheticDefaultImports,
  hasGlobalMutator,
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
          ),
          ...imports,
        ]
      : imports,
    specsName,
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
        })
      : '',
    implementationMock: `export const ${titles.implementationMock} = () => [\n`,
  };
};

export const generateClientFooter: GeneratorClientFooter = ({
  outputClient = DEFAULT_CLIENT,
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
      implementationMock: `]\n`,
    };
  }

  let implementation: string;
  try {
    if (isFunction(outputClient)) {
      implementation = (footer as (operationNames: any) => string)(
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
  } catch (e) {
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
) => {
  if (!options.mock) {
    return {
      implementation: {
        function: '',
        handler: '',
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
      mock: Exclude<(typeof options)['mock'], Function | undefined>;
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
      const client = await generatorClient(verbOption, options, outputClient);
      const generatedMock = generateMock(verbOption, options);

      if (!client.implementation) {
        return acc;
      }

      acc[verbOption.operationId] = {
        implementation: verbOption.doc + client.implementation,
        imports: client.imports,
        // @ts-expect-error // FIXME
        implementationMock: generatedMock.implementation,
        // @ts-expect-error // FIXME
        importsMock: generatedMock.imports,
        tags: verbOption.tags,
        mutator: verbOption.mutator,
        clientMutators: client.mutators,
        formData: verbOption.formData,
        formUrlEncoded: verbOption.formUrlEncoded,
        paramsSerializer: verbOption.paramsSerializer,
        operationName: verbOption.operationName,
      };

      return acc;
    },
    {} as GeneratorOperations,
  );
};
