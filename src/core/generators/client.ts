import { compare } from 'compare-versions';
import { OutputClient, OutputClientFunc, PackageJson } from '../../types';
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
} from './clients/angular';
import {
  generateAxios,
  generateAxiosFooter,
  generateAxiosHeader,
  generateAxiosTitle,
  getAxiosDependencies,
} from './clients/axios';
import {
  generateQuery,
  generateQueryFooter,
  generateQueryHeader,
  generateQueryTitle,
  getReactQueryDependencies,
  getSvelteQueryDependencies,
  getVueQueryDependencies,
} from './clients/query';
import * as query3_30_0 from './clients/query/3_30_0_abort_signal';
import {
  generateSwr,
  generateSwrFooter,
  generateSwrHeader,
  generateSwrTitle,
  getSwrDependencies,
} from './clients/swr';
import { generateDependencyImports } from './imports';
import { generateMSW } from './msw';

const PACKAGE_BY_CLIENT: Record<OutputClient, string> = {
  axios: 'axios',
  'axios-functions': 'axios',
  'react-query': 'react-query',
  'vue-query': 'vue-query',
  'svelte-query': 'svelte-query',
  swr: 'swr',
  angular: 'angular',
};

const DEFAULT_CLIENT = OutputClient.AXIOS;

export const GENERATOR_CLIENT: GeneratorClients = {
  axios: {
    latest: {
      client: generateAxios,
      header: generateAxiosHeader,
      dependencies: getAxiosDependencies,
      footer: generateAxiosFooter,
      title: generateAxiosTitle,
    },
  },
  'axios-functions': {
    latest: {
      client: (
        verbOptions: GeneratorVerbOptions,
        options: GeneratorOptions,
      ) => {
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
  },
  angular: {
    latest: {
      client: generateAngular,
      header: generateAngularHeader,
      dependencies: getAngularDependencies,
      footer: generateAngularFooter,
      title: generateAngularTitle,
    },
  },
  'react-query': {
    versions: {
      '3.30.0': {
        // Before that no AbortSignal provided to queryFn
        client: query3_30_0.generateQuery,
        header: query3_30_0.generateQueryHeader,
        dependencies: query3_30_0.getReactQueryDependencies,
        footer: query3_30_0.generateQueryFooter,
        title: query3_30_0.generateQueryTitle,
      },
    },
    latest: {
      client: generateQuery,
      header: generateQueryHeader,
      dependencies: getReactQueryDependencies,
      footer: generateQueryFooter,
      title: generateQueryTitle,
    },
  },
  'svelte-query': {
    latest: {
      client: generateQuery,
      header: generateQueryHeader,
      dependencies: getSvelteQueryDependencies,
      footer: generateQueryFooter,
      title: generateQueryTitle,
    },
  },
  'vue-query': {
    latest: {
      client: generateQuery,
      header: generateQueryHeader,
      dependencies: getVueQueryDependencies,
      footer: generateQueryFooter,
      title: generateQueryTitle,
    },
  },
  swr: {
    latest: {
      client: generateSwr,
      header: generateSwrHeader,
      dependencies: getSwrDependencies,
      footer: generateSwrFooter,
      title: generateSwrTitle,
    },
  },
};

export const getGeneratorClient = (
  outputClient: OutputClient | OutputClientFunc,
  packageJson?: PackageJson,
) => {
  if (isFunction(outputClient)) {
    return outputClient(GENERATOR_CLIENT);
  }

  const packageName = PACKAGE_BY_CLIENT[outputClient];

  const version = packageJson?.dependencies?.[packageName];

  const generators = GENERATOR_CLIENT[outputClient];

  if (version && generators.versions) {
    const [, generator] =
      Object.entries(generators.versions).find(([v]) => {
        return compare(version, v, '<');
      }) || [];

    return generator ?? generators.latest;
  }

  return generators.latest;
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
  packageJson: PackageJson,
): string => {
  const { dependencies } = getGeneratorClient(client, packageJson);
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
  title,
  customTitleFunc,
  isGlobalMutator,
  isMutator,
  provideInRoot,
  provideIn,
  packageJson,
}: {
  outputClient?: OutputClient | OutputClientFunc;
  isRequestOptions: boolean;
  isMutator: boolean;
  isGlobalMutator: boolean;
  provideInRoot: boolean;
  provideIn: boolean | 'root' | 'any';
  title: string;
  customTitleFunc?: (title: string) => string;
  packageJson?: PackageJson;
}): GeneratorClientExtra => {
  const titles = generateClientTitle(
    outputClient,
    title,
    customTitleFunc,
    packageJson,
  );
  const { header } = getGeneratorClient(outputClient, packageJson);
  return {
    implementation: header({
      title: titles.implementation,
      isRequestOptions,
      isGlobalMutator,
      isMutator,
      provideInRoot,
      provideIn,
    }),
    implementationMSW: `export const ${titles.implementationMSW} = () => [\n`,
  };
};

export const generateClientFooter = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  operationNames: string[],
  packageJson?: PackageJson,
): GeneratorClientExtra => {
  const { footer } = getGeneratorClient(outputClient, packageJson);
  return {
    implementation: footer(operationNames),
    implementationMSW: `]\n`,
  };
};

export const generateClientTitle = (
  outputClient: OutputClient | OutputClientFunc = DEFAULT_CLIENT,
  title: string,
  customTitleFunc?: (title: string) => string,
  packageJson?: PackageJson,
) => {
  const { title: generatorTitle } = getGeneratorClient(
    outputClient,
    packageJson,
  );
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
      const { client: generatorClient } = getGeneratorClient(
        outputClient,
        options.packageJson,
      );
      const client = generatorClient(verbOption, options, outputClient);
      const msw = await generateMock(verbOption, options);

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
      };

      return acc;
    },
    {} as GeneratorOperations,
  );
};
