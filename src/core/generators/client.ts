import { OutputClient, OutputClientFunc } from '../../types';
import {
  GeneratorClientExtra,
  GeneratorClients,
  GeneratorImport,
  GeneratorOperations,
  GeneratorOptions,
  GeneratorVerbOptions,
  GeneratorVerbsOptions,
} from '../../types/generator';
import { pascal } from '../../utils/case';
import { isFunction } from '../../utils/is';
import {
  generateAngular,
  generateAngularFooter,
  generateAngularHeader,
  generateAngularTitle,
  getAngularDependencies,
} from './angular';
import {
  generateAxios,
  generateAxiosFooter,
  generateAxiosFunctions,
  generateAxiosHeader,
  generateAxiosTitle,
  getAxiosDependencies,
} from './axios';
import { generateDependencyImports } from './imports';
import { generateMSW } from './msw';
import {
  generateQuery,
  generateQueryFooter,
  generateQueryHeader,
  generateQueryTitle,
  getReactQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './query';
import {
  generateSwr,
  generateSwrFooter,
  generateSwrHeader,
  generateSwrTitle,
  getSwrDependencies,
} from './swr';

const DEFAULT_CLIENT = OutputClient.AXIOS;

export const GENERATOR_CLIENT: GeneratorClients = {
  axios: {
    client: generateAxios,
    header: generateAxiosHeader,
    dependencies: getAxiosDependencies,
    footer: generateAxiosFooter,
    title: generateAxiosTitle,
  },
  'axios-functions': {
    client: generateAxiosFunctions,
    header: (options) => generateAxiosHeader({ ...options, noFunction: true }),
    dependencies: getAxiosDependencies,
    footer: (options) => generateAxiosFooter({ ...options, noFunction: true }),
    title: generateAxiosTitle,
  },
  angular: {
    client: generateAngular,
    header: generateAngularHeader,
    dependencies: getAngularDependencies,
    footer: generateAngularFooter,
    title: generateAngularTitle,
  },
  'react-query': {
    client: generateQuery,
    header: generateQueryHeader,
    dependencies: getReactQueryDependencies,
    footer: generateQueryFooter,
    title: generateQueryTitle,
  },
  'svelte-query': {
    client: generateQuery,
    header: generateQueryHeader,
    dependencies: getSvelteQueryDependencies,
    footer: generateQueryFooter,
    title: generateQueryTitle,
  },
  'vue-query': {
    client: generateQuery,
    header: generateQueryHeader,
    dependencies: getVueQueryDependencies,
    footer: generateQueryFooter,
    title: generateQueryTitle,
  },
  swr: {
    client: generateSwr,
    header: generateSwrHeader,
    dependencies: getSwrDependencies,
    footer: generateSwrFooter,
    title: generateSwrTitle,
  },
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

export const generateClientImports = (
  client: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  implementation: string,
  imports: {
    exports: GeneratorImport[];
    dependency: string;
  }[],
  specsName: Record<string, string>,
  hasSchemaDir: boolean,
  isAllowSyntheticDefaultImports: boolean,
  hasGlobalMutator: boolean,
): string => {
  const { dependencies } = getGeneratorClient(client);
  return generateDependencyImports(
    implementation,
    [...dependencies(hasGlobalMutator), ...imports],
    specsName,
    hasSchemaDir,
    isAllowSyntheticDefaultImports,
  );
};

export const generateClientHeader = ({
  outputClient = DEFAULT_CLIENT,
  isRequestOptions,
  isGlobalMutator,
  isMutator,
  provideIn,
  hasAwaitedType,
  titles,
}: {
  outputClient?: OutputClient | OutputClientFunc;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideIn: boolean | 'root' | 'any';
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
}): GeneratorClientExtra => {
  const { header } = getGeneratorClient(outputClient);
  return {
    implementation: header({
      title: titles.implementation,
      isRequestOptions,
      isGlobalMutator,
      isMutator,
      provideIn,
      hasAwaitedType,
    }),
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter = ({
  outputClient = DEFAULT_CLIENT,
  operationNames,
  hasMutator,
  hasAwaitedType,
  titles,
}: {
  outputClient: OutputClient | OutputClientFunc;
  operationNames: string[];
  hasMutator: boolean;
  hasAwaitedType: boolean;
  titles: GeneratorClientExtra;
}): GeneratorClientExtra => {
  const { footer } = getGeneratorClient(outputClient);
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

export const generateClientTitle = ({
  outputClient = DEFAULT_CLIENT,
  title,
  customTitleFunc,
}: {
  outputClient?: OutputClient | OutputClientFunc;
  title: string;
  customTitleFunc?: (title: string) => string;
}): GeneratorClientExtra => {
  const { title: generatorTitle } = getGeneratorClient(outputClient);
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

export const generateClient = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  verbsOptions: GeneratorVerbsOptions,
  options: GeneratorOptions,
): GeneratorOperations => {
  return verbsOptions.reduce((acc, verbOption) => {
    const { client: generatorClient } = getGeneratorClient(outputClient);
    const client = generatorClient(verbOption, options, outputClient);
    const msw = generateMock(verbOption, options);

    acc[verbOption.operationId] = {
      implementation: verbOption.doc + client.implementation,
      imports: client.imports,
      implementationMSW: msw.implementation,
      importsMSW: msw.imports,
      tags: verbOption.tags,
      mutator: verbOption.mutator,
      formData: verbOption.formData,
      formUrlEncoded: verbOption.formUrlEncoded,
      operationName: verbOption.operationName,
      types: client.types,
    };

    return acc;
  }, {} as GeneratorOperations);
};
