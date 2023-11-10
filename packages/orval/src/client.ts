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
  OutputClient,
  OutputClientFunc,
  pascal,
} from '@orval/core';
import { generateMSW } from '@orval/msw';
import query from '@orval/query';
import swr from '@orval/swr';
import zod from '@orval/zod';

const DEFAULT_CLIENT = OutputClient.AXIOS;

export const GENERATOR_CLIENT: GeneratorClients = {
  axios: axios({ type: 'axios' })(),
  'axios-functions': axios({ type: 'axios-functions' })(),
  angular: angular()(),
  'react-query': query({ type: 'react-query' })(),
  'svelte-query': query({ type: 'svelte-query' })(),
  'vue-query': query({ type: 'vue-query' })(),
  swr: swr()(),
  zod: zod()(),
};

const getGeneratorClient = (outputClient: OutputClient | OutputClientFunc) => {
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
}) => {
  const { dependencies } = getGeneratorClient(client);
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
}) => {
  const { header } = getGeneratorClient(outputClient);
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
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter: GeneratorClientFooter = ({
  outputClient = DEFAULT_CLIENT,
  operationNames,
  hasMutator,
  hasAwaitedType,
  titles,
}) => {
  const { footer } = getGeneratorClient(outputClient);

  if (!footer) {
    return {
      implementation: '',
      implementationMSW: `]\n`,
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
    implementationMSW: `]\n`,
  };
};

export const generateClientTitle: GeneratorClientTitle = ({
  outputClient = DEFAULT_CLIENT,
  title,
  customTitleFunc,
}) => {
  const { title: generatorTitle } = getGeneratorClient(outputClient);

  if (!generatorTitle) {
    return {
      implementation: '',
      implementationMSW: `get${pascal(title)}MSW`,
    };
  }

  if (customTitleFunc) {
    const customTitle = customTitleFunc(title);
    return {
      implementation: generatorTitle(customTitle),
      implementationMSW: `get${pascal(customTitle)}MSW`,
    };
  }
  return {
    implementation: generatorTitle(title),
    implementationMSW: `get${pascal(title)}MSW`,
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

  return generateMSW(verbOption, options);
};

export const generateOperations = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
): Promise<GeneratorOperations> => {
  return asyncReduce(
    verbsOptions,
    async (acc, verbOption) => {
      const { client: generatorClient } = getGeneratorClient(outputClient);
      const client = await generatorClient(verbOption, options, outputClient);
      const msw = generateMock(verbOption, options);

      if (!client.implementation) {
        return acc;
      }

      acc[verbOption.operationId] = {
        implementation: verbOption.doc + client.implementation,
        imports: client.imports,
        implementationMSW: msw.implementation,
        importsMSW: msw.imports,
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
