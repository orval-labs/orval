import cuid from 'cuid';
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
import { asyncReduce } from '../../utils/async-reduce';
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
} from './query';

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
    client: (verbOptions: GeneratorVerbOptions, options: GeneratorOptions) => {
      const { implementation, imports } = generateAxios(verbOptions, options);

      return {
        implementation: 'export ' + implementation,
        imports,
      };
    },
    header: (options: {
      title: string;
      isMutator: boolean;
      isRequestOptions: boolean;
    }) => generateAxiosHeader({ ...options, noFunction: true }),
    dependencies: getAxiosDependencies,
    footer: () => '',
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
): string => {
  const { dependencies } = getGeneratorClient(client);
  return generateDependencyImports(
    implementation,
    [...dependencies(), ...imports],
    specsName,
  );
};

export const generateClientHeader = ({
  outputClient = DEFAULT_CLIENT,
  isRequestOptions,
  title,
  customTitleFunc,
  isGlobalMutator,
  isMutator,
}: {
  outputClient?: OutputClient | OutputClientFunc;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  title: string;
  customTitleFunc?: (title: string) => string;
}): GeneratorClientExtra => {
  const titles = generateClientTitle(outputClient, title, customTitleFunc);
  const { header } = getGeneratorClient(outputClient);
  return {
    implementation: header({
      title: titles.implementation,
      isRequestOptions,
      isGlobalMutator,
      isMutator,
    }),
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  operationNames: string[],
): GeneratorClientExtra => {
  const { footer } = getGeneratorClient(outputClient);
  return {
    implementation: footer(operationNames),
    implementationMSW: `]\n`,
  };
};

export const generateClientTitle = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  title: string,
  customTitleFunc?: (title: string) => string,
) => {
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

const generateMock = async (
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
): Promise<GeneratorOperations> => {
  return asyncReduce(
    verbsOptions,
    async (acc, verbOption) => {
      const { client: generatorClient } = getGeneratorClient(outputClient);
      const client = generatorClient(verbOption, options);
      const msw = await generateMock(verbOption, options);
      const key = cuid()

      return {
        ...acc,
        [key]: {
          implementation: client.implementation,
          imports: client.imports,
          implementationMSW: msw.implementation,
          importsMSW: msw.imports,
          tags: verbOption.tags,
          mutator: verbOption.mutator,
          operationName: verbOption.operationName,
        },
      };
    },
    {} as GeneratorOperations,
  );
};
